import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { analyzeEligibility, detectCorrigendumChanges } from "./eligibilityMatcher";
import type { InsertTender } from "@shared/schema";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function parseExcelDate(value: any): Date | null {
  if (!value) return null;
  
  if (typeof value === 'number') {
    // Excel serial date
    const date = new Date((value - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  return null;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[₹$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findColumn(row: any, ...possibleNames: string[]): any {
  const normalizedPossibles = possibleNames.map(normalizeColumnName);
  
  for (const key of Object.keys(row)) {
    const normalizedKey = normalizeColumnName(key);
    if (normalizedPossibles.includes(normalizedKey)) {
      return row[key];
    }
  }
  
  // Also check for partial matches
  for (const key of Object.keys(row)) {
    const normalizedKey = normalizeColumnName(key);
    for (const possible of normalizedPossibles) {
      if (normalizedKey.includes(possible) || possible.includes(normalizedKey)) {
        return row[key];
      }
    }
  }
  
  return null;
}

function checkMsmeExemptionFromExcel(value: any): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  // Only true if explicitly "yes" or similar positive values
  return ['yes', 'y', 'true', '1', 'exempted', 'applicable'].includes(str);
}

function checkStartupExemptionFromExcel(value: any): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  // Only true if explicitly "yes" or similar positive values
  return ['yes', 'y', 'true', '1', 'exempted', 'applicable'].includes(str);
}

interface TenderWithExcelFlags extends Partial<InsertTender> {
  excelMsmeExemption: boolean;
  excelStartupExemption: boolean;
}

function getColumnByLetter(sheet: XLSX.WorkSheet, rowIdx: number, colLetter: string): any {
  const cellAddress = `${colLetter}${rowIdx}`;
  const cell = sheet[cellAddress];
  return cell ? cell.v : null;
}

function parseTenderFromRow(row: any, tenderType: 'gem' | 'non_gem', sheet?: XLSX.WorkSheet, rowIndex?: number): TenderWithExcelFlags {
  const t247Id = findColumn(row, 't247id', 'id', 'tenderid', 'tenderno', 'tendernumber', 'refno', 'referenceno') || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get REFERENCE NO for title display
  const referenceNo = findColumn(row, 'referenceno', 'refno', 'refrno', 'reference', 'referanceno');
  
  // Get the tender brief/title
  const tenderBrief = findColumn(row, 'title', 'tendertitle', 'name', 'subject', 'work', 'description', 'tenderbrief', 'brief') || null;
  
  // Combine REFERENCE NO with title if both exist
  let fullTitle = tenderBrief;
  if (referenceNo && tenderBrief) {
    fullTitle = `[${referenceNo}] ${tenderBrief}`;
  } else if (referenceNo) {
    fullTitle = `[${referenceNo}]`;
  }
  
  // Get MSME/Startup exemption directly from Excel columns
  const msmeExemptionValue = findColumn(row, 'msmeexemption', 'msme', 'msmeexempted');
  const startupExemptionValue = findColumn(row, 'startupexemption', 'startup', 'startupexempted');
  
  // Get eligibility criteria - use column position based on tender type
  // Non-GEM: Column N, GEM: Column AU
  let eligibilityCriteria = null;
  if (sheet && rowIndex !== undefined) {
    if (tenderType === 'non_gem') {
      // Column N for Non-GEM eligibility criteria
      eligibilityCriteria = getColumnByLetter(sheet, rowIndex, 'N');
    } else if (tenderType === 'gem') {
      // Column AU for GEM eligibility criteria
      eligibilityCriteria = getColumnByLetter(sheet, rowIndex, 'AU');
    }
  }
  
  // Fallback to name-based lookup if column-based didn't find anything
  if (!eligibilityCriteria) {
    eligibilityCriteria = findColumn(row, 'eligibilitycriteria', 'eligibility', 'criteria', 'qualification', 'requirements', 'qr', 'qualifyingcriteria') || null;
  }
  
  return {
    t247Id: String(t247Id),
    tenderType,
    title: fullTitle,
    department: findColumn(row, 'department', 'dept', 'ministry') || null,
    organization: findColumn(row, 'organization', 'org', 'company', 'buyer', 'buyerorg') || null,
    estimatedValue: parseNumber(findColumn(row, 'estimatedvalue', 'value', 'amount', 'budget', 'cost', 'estimatedcost', 'tendervalue'))?.toString() || null,
    emdAmount: parseNumber(findColumn(row, 'emd', 'emdamount', 'earnestmoney', 'earnestmoneydeposit', 'emdr', 'bidsecrurity'))?.toString() || null,
    turnoverRequirement: parseNumber(findColumn(row, 'turnover', 'turnoverrequirement', 'annualturnover', 'minturnover'))?.toString() || null,
    publishDate: parseExcelDate(findColumn(row, 'publishdate', 'publishedon', 'startdate', 'bidstartdate', 'publicationdate')),
    submissionDeadline: parseExcelDate(findColumn(row, 'submissiondeadline', 'deadline', 'duedate', 'bidenddate', 'closingdate', 'lastdate', 'bidsubmissionenddate')),
    openingDate: parseExcelDate(findColumn(row, 'openingdate', 'bidopeningdate', 'opendate', 'bidopeningdatetime')),
    eligibilityCriteria: eligibilityCriteria ? String(eligibilityCriteria) : null,
    checklist: findColumn(row, 'checklist', 'documents', 'requireddocuments', 'doclist', 'documentlist') || null,
    rawData: row,
    // Excel exemption flags
    excelMsmeExemption: checkMsmeExemptionFromExcel(msmeExemptionValue),
    excelStartupExemption: checkStartupExemptionFromExcel(startupExemptionValue),
  };
}

// Store for upload progress tracking
const uploadProgressStore = new Map<number, {
  gemCount: number;
  nonGemCount: number;
  failedCount: number;
  totalRows: number;
  currentSheet: string;
  processedRows: number;
  startTime: number;
  status: 'processing' | 'complete' | 'error';
  message?: string;
  clients: Set<any>;
}>();

function sendProgressUpdate(uploadId: number) {
  const progress = uploadProgressStore.get(uploadId);
  if (!progress) return;

  const elapsed = (Date.now() - progress.startTime) / 1000;
  const rowsPerSecond = progress.processedRows / Math.max(elapsed, 0.1);
  const remainingRows = progress.totalRows - progress.processedRows;
  const estimatedTimeRemaining = remainingRows / Math.max(rowsPerSecond, 0.1);

  const data = {
    type: progress.status,
    gemCount: progress.gemCount,
    nonGemCount: progress.nonGemCount,
    failedCount: progress.failedCount,
    totalRows: progress.totalRows,
    currentSheet: progress.currentSheet,
    processedRows: progress.processedRows,
    estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
    message: progress.message,
  };

  const message = `data: ${JSON.stringify(data)}\n\n`;
  progress.clients.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      // Client disconnected
    }
  });
}

async function processExcelAsync(workbook: XLSX.WorkBook, uploadId: number, userId: string) {
  const progress = uploadProgressStore.get(uploadId);
  if (!progress) return;

  try {
    // Get company criteria for matching
    let criteria = await storage.getCompanyCriteria();
    if (!criteria) {
      criteria = await storage.upsertCompanyCriteria({
        turnoverCr: "4",
        projectTypes: ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
        updatedBy: userId,
      });
    }

    let gemCount = 0;
    let nonGemCount = 0;
    let failedCount = 0;

    // Process all sheets
    for (const sheetName of workbook.SheetNames) {
      const normalizedName = sheetName.toLowerCase().replace(/[-_\s]/g, '');
      
      // Determine tender type from sheet name
      let tenderType: 'gem' | 'non_gem' = 'non_gem';
      if (normalizedName.includes('gem') && !normalizedName.includes('nongem') && !normalizedName.includes('non')) {
        tenderType = 'gem';
      }
      
      progress.currentSheet = sheetName;
      sendProgressUpdate(uploadId);
      
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const excelRowIndex = i + 2;
          const tenderData = parseTenderFromRow(row, tenderType, sheet, excelRowIndex);
          
          // Check for duplicate T247 ID (corrigendum detection)
          const existingTender = await storage.getTenderByT247Id(tenderData.t247Id!);
          
          // Use Excel exemption flags if available
          const excelMsme = tenderData.excelMsmeExemption;
          const excelStartup = tenderData.excelStartupExemption;
          
          // Analyze eligibility
          const matchResult = analyzeEligibility(tenderData, criteria!, excelMsme, excelStartup);
          
          // Remove temporary Excel fields before inserting
          const { excelMsmeExemption, excelStartupExemption, ...tenderInsertData } = tenderData;
          
          const fullTenderData: InsertTender = {
            ...tenderInsertData,
            uploadId,
            matchPercentage: matchResult.matchPercentage,
            isMsmeExempted: matchResult.isMsmeExempted,
            isStartupExempted: matchResult.isStartupExempted,
            tags: matchResult.tags,
            analysisStatus: matchResult.analysisStatus,
            isCorrigendum: !!existingTender,
            originalTenderId: existingTender?.id || null,
          };
          
          const createdTender = await storage.createTender(fullTenderData);
          
          // If this is a corrigendum, detect and save changes
          if (existingTender) {
            const changes = detectCorrigendumChanges(existingTender, createdTender);
            for (const change of changes) {
              await storage.createCorrigendumChange({
                tenderId: createdTender.id,
                originalTenderId: existingTender.id,
                fieldName: change.fieldName,
                oldValue: change.oldValue,
                newValue: change.newValue,
              });
            }
          }
          
          if (tenderType === 'gem') {
            gemCount++;
            progress.gemCount = gemCount;
          } else {
            nonGemCount++;
            progress.nonGemCount = nonGemCount;
          }
        } catch (err) {
          console.error('Error processing row:', err);
          failedCount++;
          progress.failedCount = failedCount;
        }
        
        progress.processedRows++;
        
        // Send update every 5 rows or on every row if less than 20 total
        if (progress.processedRows % 5 === 0 || progress.totalRows < 20) {
          sendProgressUpdate(uploadId);
        }
      }
    }

    // Update upload record with counts
    await storage.updateExcelUpload(uploadId, {
      totalTenders: gemCount + nonGemCount,
      gemCount,
      nonGemCount,
    });

    // Mark as complete
    progress.status = 'complete';
    progress.gemCount = gemCount;
    progress.nonGemCount = nonGemCount;
    progress.failedCount = failedCount;
    sendProgressUpdate(uploadId);

    // Clean up after a delay
    setTimeout(() => {
      uploadProgressStore.delete(uploadId);
    }, 60000);

  } catch (error: any) {
    console.error('Error processing Excel:', error);
    progress.status = 'error';
    progress.message = error.message || 'Processing failed';
    sendProgressUpdate(uploadId);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Stats endpoint
  app.get('/api/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Tenders endpoints
  app.get('/api/tenders', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      
      if (status === 'unable_to_analyze' || status === 'not_eligible') {
        const tenders = await storage.getTendersByStatus(status);
        return res.json(tenders);
      }
      
      const tenders = await storage.getTenders();
      res.json(tenders);
    } catch (error) {
      console.error("Error fetching tenders:", error);
      res.status(500).json({ message: "Failed to fetch tenders" });
    }
  });

  // Get not eligible tenders (separate endpoint for clarity)
  app.get('/api/tenders/not-eligible', isAuthenticated, async (req, res) => {
    try {
      const tenders = await storage.getTendersByStatus('not_eligible');
      res.json(tenders);
    } catch (error) {
      console.error("Error fetching not eligible tenders:", error);
      res.status(500).json({ message: "Failed to fetch not eligible tenders" });
    }
  });

  app.get('/api/tenders/corrigendum', isAuthenticated, async (req, res) => {
    try {
      const corrigendums = await storage.getCorrigendumTenders();
      res.json(corrigendums);
    } catch (error) {
      console.error("Error fetching corrigendums:", error);
      res.status(500).json({ message: "Failed to fetch corrigendums" });
    }
  });

  app.get('/api/tenders/:id', isAuthenticated, async (req, res) => {
    try {
      const tender = await storage.getTenderById(parseInt(req.params.id));
      if (!tender) {
        return res.status(404).json({ message: "Tender not found" });
      }
      res.json(tender);
    } catch (error) {
      console.error("Error fetching tender:", error);
      res.status(500).json({ message: "Failed to fetch tender" });
    }
  });

  // SSE endpoint for upload progress
  app.get('/api/upload-progress/:uploadId', isAuthenticated, (req, res) => {
    const uploadId = parseInt(req.params.uploadId);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const progress = uploadProgressStore.get(uploadId);
    if (progress) {
      progress.clients.add(res);
      sendProgressUpdate(uploadId);
      
      req.on('close', () => {
        progress.clients.delete(res);
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Upload not found' })}\n\n`);
      res.end();
    }
  });

  // Excel upload with progress endpoint
  app.post('/api/upload-with-progress', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      // Count total rows across all sheets
      let totalRows = 0;
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        totalRows += data.length;
      }

      // Create upload record
      const uploadRecord = await storage.createExcelUpload({
        fileName: req.file.originalname,
        uploadedBy: userId,
        totalTenders: 0,
        gemCount: 0,
        nonGemCount: 0,
      });

      // Initialize progress tracking
      uploadProgressStore.set(uploadRecord.id, {
        gemCount: 0,
        nonGemCount: 0,
        failedCount: 0,
        totalRows,
        currentSheet: '',
        processedRows: 0,
        startTime: Date.now(),
        status: 'processing',
        clients: new Set(),
      });

      // Return immediately with upload ID so client can connect to SSE
      res.json({ uploadId: uploadRecord.id });

      // Process in background
      processExcelAsync(workbook, uploadRecord.id, userId);

    } catch (error) {
      console.error("Error starting upload:", error);
      res.status(500).json({ message: "Failed to start upload" });
    }
  });

  // Excel upload endpoint
  app.post('/api/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      // Create upload record
      const uploadRecord = await storage.createExcelUpload({
        fileName: req.file.originalname,
        uploadedBy: userId,
        totalTenders: 0,
        gemCount: 0,
        nonGemCount: 0,
      });

      // Get company criteria for matching
      let criteria = await storage.getCompanyCriteria();
      if (!criteria) {
        // Create default criteria
        criteria = await storage.upsertCompanyCriteria({
          turnoverCr: "4",
          projectTypes: ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
          updatedBy: userId,
        });
      }

      let gemCount = 0;
      let nonGemCount = 0;
      const processedTenders: any[] = [];

      // Process all sheets
      for (const sheetName of workbook.SheetNames) {
        const normalizedName = sheetName.toLowerCase().replace(/[-_\s]/g, '');
        
        // Determine tender type from sheet name
        let tenderType: 'gem' | 'non_gem' = 'non_gem';
        if (normalizedName.includes('gem') && !normalizedName.includes('nongem') && !normalizedName.includes('non')) {
          tenderType = 'gem';
        }
        
        console.log(`Processing sheet: ${sheetName} as ${tenderType}`);
        
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        console.log(`Found ${data.length} rows in sheet ${sheetName}`);
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          // Row index in Excel is 1-based, and first row is header, so data row 0 is Excel row 2
          const excelRowIndex = i + 2;
          const tenderData = parseTenderFromRow(row, tenderType, sheet, excelRowIndex);
          
          // Check for duplicate T247 ID (corrigendum detection)
          const existingTender = await storage.getTenderByT247Id(tenderData.t247Id!);
          
          // Use Excel exemption flags if available, otherwise analyze from text
          const excelMsme = tenderData.excelMsmeExemption;
          const excelStartup = tenderData.excelStartupExemption;
          
          // Analyze eligibility with Excel exemption flags
          const matchResult = analyzeEligibility(tenderData, criteria!, excelMsme, excelStartup);
          
          // Remove temporary Excel fields before inserting
          const { excelMsmeExemption, excelStartupExemption, ...tenderInsertData } = tenderData;
          
          const fullTenderData: InsertTender = {
            ...tenderInsertData,
            uploadId: uploadRecord.id,
            matchPercentage: matchResult.matchPercentage,
            isMsmeExempted: matchResult.isMsmeExempted,
            isStartupExempted: matchResult.isStartupExempted,
            tags: matchResult.tags,
            analysisStatus: matchResult.analysisStatus,
            isCorrigendum: !!existingTender,
            originalTenderId: existingTender?.id || null,
          };
          
          const createdTender = await storage.createTender(fullTenderData);
          
          // If this is a corrigendum, detect and save changes
          if (existingTender) {
            const changes = detectCorrigendumChanges(existingTender, createdTender);
            for (const change of changes) {
              await storage.createCorrigendumChange({
                tenderId: createdTender.id,
                originalTenderId: existingTender.id,
                fieldName: change.fieldName,
                oldValue: change.oldValue,
                newValue: change.newValue,
              });
            }
          }
          
          if (tenderType === 'gem') {
            gemCount++;
          } else {
            nonGemCount++;
          }
          
          processedTenders.push(createdTender);
        }
      }

      // If no standard sheets found, try to process the first sheet
      if (processedTenders.length === 0 && workbook.SheetNames.length > 0) {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const excelRowIndex = i + 2;
          const tenderData = parseTenderFromRow(row, 'non_gem', sheet, excelRowIndex);
          
          const existingTender = await storage.getTenderByT247Id(tenderData.t247Id!);
          const matchResult = analyzeEligibility(tenderData, criteria!);
          
          const fullTenderData: InsertTender = {
            ...tenderData,
            uploadId: uploadRecord.id,
            matchPercentage: matchResult.matchPercentage,
            isMsmeExempted: matchResult.isMsmeExempted,
            isStartupExempted: matchResult.isStartupExempted,
            tags: matchResult.tags,
            analysisStatus: matchResult.analysisStatus,
            isCorrigendum: !!existingTender,
            originalTenderId: existingTender?.id || null,
          };
          
          const createdTender = await storage.createTender(fullTenderData);
          
          if (existingTender) {
            const changes = detectCorrigendumChanges(existingTender, createdTender);
            for (const change of changes) {
              await storage.createCorrigendumChange({
                tenderId: createdTender.id,
                originalTenderId: existingTender.id,
                fieldName: change.fieldName,
                oldValue: change.oldValue,
                newValue: change.newValue,
              });
            }
          }
          
          nonGemCount++;
          processedTenders.push(createdTender);
        }
      }

      // Update upload record with counts
      await storage.updateExcelUpload(uploadRecord.id, {
        totalTenders: gemCount + nonGemCount,
        gemCount,
        nonGemCount,
      });

      res.json({
        success: true,
        uploadId: uploadRecord.id,
        totalTenders: gemCount + nonGemCount,
        gemCount,
        nonGemCount,
      });
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).json({ message: "Failed to process file" });
    }
  });

  // PDF upload for unable to analyze tenders
  app.post('/api/tenders/upload-pdf', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { tenderId } = req.body;
      if (!tenderId) {
        return res.status(400).json({ message: "Tender ID required" });
      }

      const tender = await storage.getTenderById(parseInt(tenderId));
      if (!tender) {
        return res.status(404).json({ message: "Tender not found" });
      }

      // Extract text from PDF
      const pdfData = await pdfParse(req.file.buffer);
      const extractedText = pdfData.text;

      // Save document
      const doc = await storage.createTenderDocument({
        tenderId: tender.id,
        fileName: req.file.originalname,
        fileType: 'pdf',
        extractedText,
      });

      // Re-analyze with extracted text
      let criteria = await storage.getCompanyCriteria();
      if (!criteria) {
        criteria = await storage.upsertCompanyCriteria({
          turnoverCr: "4",
          projectTypes: ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
        });
      }

      const matchResult = analyzeEligibility(
        {
          ...tender,
          eligibilityCriteria: [tender.eligibilityCriteria, extractedText].filter(Boolean).join('\n'),
        },
        criteria
      );

      // Update tender with new analysis
      await storage.updateTender(tender.id, {
        eligibilityCriteria: [tender.eligibilityCriteria, extractedText].filter(Boolean).join('\n'),
        matchPercentage: matchResult.matchPercentage,
        isMsmeExempted: matchResult.isMsmeExempted,
        isStartupExempted: matchResult.isStartupExempted,
        tags: matchResult.tags,
        analysisStatus: 'analyzed',
      });

      // Update document
      await storage.updateTenderDocument(doc.id, { processedAt: new Date() });

      res.json({ success: true, matchResult });
    } catch (error) {
      console.error("Error processing PDF:", error);
      res.status(500).json({ message: "Failed to process PDF" });
    }
  });

  // Upload history
  app.get('/api/uploads', isAuthenticated, async (req, res) => {
    try {
      const uploads = await storage.getExcelUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  // Company criteria endpoints
  app.get('/api/company-criteria', isAuthenticated, async (req, res) => {
    try {
      let criteria = await storage.getCompanyCriteria();
      if (!criteria) {
        // Return default criteria
        criteria = {
          id: 1,
          turnoverCr: "4",
          projectTypes: ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
          updatedAt: new Date(),
          updatedBy: null,
        };
      }
      res.json(criteria);
    } catch (error) {
      console.error("Error fetching criteria:", error);
      res.status(500).json({ message: "Failed to fetch criteria" });
    }
  });

  app.put('/api/company-criteria', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { turnoverCr, projectTypes } = req.body;

      const criteria = await storage.upsertCompanyCriteria({
        turnoverCr: turnoverCr || "4",
        projectTypes: projectTypes || ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
        updatedBy: userId,
      });

      // Re-analyze all tenders with new criteria
      const tenders = await storage.getTenders();
      for (const tender of tenders) {
        const matchResult = analyzeEligibility(tender, criteria);
        await storage.updateTender(tender.id, {
          matchPercentage: matchResult.matchPercentage,
          isMsmeExempted: matchResult.isMsmeExempted,
          isStartupExempted: matchResult.isStartupExempted,
          tags: matchResult.tags,
        });
      }

      res.json(criteria);
    } catch (error) {
      console.error("Error updating criteria:", error);
      res.status(500).json({ message: "Failed to update criteria" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
