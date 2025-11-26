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

function parseTenderFromRow(row: any, tenderType: 'gem' | 'non_gem'): Partial<InsertTender> {
  const t247Id = findColumn(row, 't247id', 'id', 'tenderid', 'tenderno', 'tendernumber', 'refno', 'referenceno') || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    t247Id: String(t247Id),
    tenderType,
    title: findColumn(row, 'title', 'tendertitle', 'name', 'subject', 'work', 'description') || null,
    department: findColumn(row, 'department', 'dept', 'ministry', 'organization', 'org') || null,
    organization: findColumn(row, 'organization', 'org', 'company', 'buyer', 'buyerorg') || null,
    estimatedValue: parseNumber(findColumn(row, 'estimatedvalue', 'value', 'amount', 'budget', 'cost', 'estimatedcost', 'tendervalue'))?.toString() || null,
    emdAmount: parseNumber(findColumn(row, 'emd', 'emdamount', 'earnestmoney', 'earnestmoneydeposit', 'emdr', 'bidsecrurity'))?.toString() || null,
    turnoverRequirement: parseNumber(findColumn(row, 'turnover', 'turnoverrequirement', 'annualturnover', 'minturnover'))?.toString() || null,
    publishDate: parseExcelDate(findColumn(row, 'publishdate', 'publishedon', 'startdate', 'bidstartdate', 'publicationdate')),
    submissionDeadline: parseExcelDate(findColumn(row, 'submissiondeadline', 'deadline', 'duedate', 'bidenddate', 'closingdate', 'lastdate', 'bidsubmissionenddate')),
    openingDate: parseExcelDate(findColumn(row, 'openingdate', 'bidopeningdate', 'opendate')),
    eligibilityCriteria: findColumn(row, 'eligibilitycriteria', 'eligibility', 'criteria', 'qualification', 'requirements', 'qr', 'qualifyingcriteria') || null,
    checklist: findColumn(row, 'checklist', 'documents', 'requireddocuments', 'doclist', 'documentlist') || null,
    rawData: row,
  };
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
      
      if (status === 'unable_to_analyze') {
        const tenders = await storage.getTendersByStatus('unable_to_analyze');
        return res.json(tenders);
      }
      
      const tenders = await storage.getTenders();
      res.json(tenders);
    } catch (error) {
      console.error("Error fetching tenders:", error);
      res.status(500).json({ message: "Failed to fetch tenders" });
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

      // Process sheets
      const sheetTypes: { name: string; type: 'gem' | 'non_gem' }[] = [
        { name: 'gem', type: 'gem' },
        { name: 'Gem', type: 'gem' },
        { name: 'GEM', type: 'gem' },
        { name: 'non-gem', type: 'non_gem' },
        { name: 'Non-Gem', type: 'non_gem' },
        { name: 'NON-GEM', type: 'non_gem' },
        { name: 'nongem', type: 'non_gem' },
        { name: 'NonGem', type: 'non_gem' },
      ];

      for (const sheetInfo of sheetTypes) {
        const sheetName = workbook.SheetNames.find(
          name => name.toLowerCase().replace(/[-_\s]/g, '') === sheetInfo.name.toLowerCase().replace(/[-_\s]/g, '')
        );
        
        if (!sheetName) continue;
        
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        for (const row of data) {
          const tenderData = parseTenderFromRow(row, sheetInfo.type);
          
          // Check for duplicate T247 ID (corrigendum detection)
          const existingTender = await storage.getTenderByT247Id(tenderData.t247Id!);
          
          // Analyze eligibility
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
          
          if (sheetInfo.type === 'gem') {
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
        
        for (const row of data) {
          const tenderData = parseTenderFromRow(row, 'non_gem');
          
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
