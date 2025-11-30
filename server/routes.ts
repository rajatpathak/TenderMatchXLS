import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./simpleAuth";
import { analyzeEligibility, detectCorrigendumChanges } from "./eligibilityMatcher";
import { type InsertTender, tenderResultStatuses, presentationStatuses, clarificationStages } from "@shared/schema";
import { z } from "zod";

// Validation schemas for tender results
const createTenderResultSchema = z.object({
  referenceId: z.string().min(1, "Reference ID is required"),
  status: z.enum(tenderResultStatuses as [string, ...string[]], {
    errorMap: () => ({ message: "Invalid status" })
  }),
  tenderId: z.number().nullable().optional(),
});

const updateTenderResultStatusSchema = z.object({
  status: z.enum(tenderResultStatuses as [string, ...string[]], {
    errorMap: () => ({ message: "Invalid status" })
  }),
  note: z.string().optional(),
});

// Validation schemas for presentations
const departmentContactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const createPresentationSchema = z.object({
  referenceId: z.string().min(1, "Tender ID is required"),
  tenderId: z.number().nullable().optional(),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  assignedTo: z.number().min(1, "Assigned user is required"),
  departmentContacts: z.array(departmentContactSchema).optional().default([]),
  notes: z.string().optional(),
});

const updatePresentationSchema = z.object({
  referenceId: z.string().optional(),
  tenderId: z.number().nullable().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  assignedTo: z.number().optional(),
  departmentContacts: z.array(departmentContactSchema).optional(),
  notes: z.string().optional(),
});

const updatePresentationStatusSchema = z.object({
  status: z.enum(presentationStatuses as [string, ...string[]], {
    errorMap: () => ({ message: "Invalid presentation status" })
  }),
  note: z.string().optional(),
});

// Validation schemas for clarifications
const createClarificationSchema = z.object({
  referenceId: z.string().min(1, "Tender ID is required"),
  tenderId: z.number().nullable().optional(),
  clarificationDetails: z.string().min(1, "Clarification details are required"),
  assignedTo: z.number().min(1, "Assigned user is required"),
  departmentContacts: z.array(departmentContactSchema).optional().default([]),
  notes: z.string().optional(),
  submitDeadlineDate: z.string().optional(),
  submitDeadlineTime: z.string().optional(),
});

const updateClarificationSchema = z.object({
  referenceId: z.string().optional(),
  tenderId: z.number().nullable().optional(),
  clarificationDetails: z.string().optional(),
  assignedTo: z.number().optional(),
  departmentContacts: z.array(departmentContactSchema).optional(),
  notes: z.string().optional(),
  responseDetails: z.string().optional(),
  submitDeadlineDate: z.string().optional(),
  submitDeadlineTime: z.string().optional(),
});

const updateClarificationStageSchema = z.object({
  stage: z.enum(clarificationStages as [string, ...string[]], {
    errorMap: () => ({ message: "Invalid clarification stage" })
  }),
  note: z.string().optional(),
});

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
    const trimmed = value.trim();
    
    // Try DD-MM-YYYY format first (e.g., "25-12-2024" or "25/12/2024")
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // JS months are 0-indexed
      const year = parseInt(ddmmyyyyMatch[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime()) && date.getDate() === day) {
        return date;
      }
    }
    
    // Try DD-MM-YYYY HH:MM format (e.g., "25-12-2024 14:30")
    const ddmmyyyyTimeMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (ddmmyyyyTimeMatch) {
      const day = parseInt(ddmmyyyyTimeMatch[1], 10);
      const month = parseInt(ddmmyyyyTimeMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyTimeMatch[3], 10);
      const hours = parseInt(ddmmyyyyTimeMatch[4], 10);
      const minutes = parseInt(ddmmyyyyTimeMatch[5], 10);
      const seconds = ddmmyyyyTimeMatch[6] ? parseInt(ddmmyyyyTimeMatch[6], 10) : 0;
      const date = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(date.getTime()) && date.getDate() === day) {
        return date;
      }
    }
    
    // Try YYYY-MM-DD format (ISO format)
    const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (isoMatch) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // Fallback to native Date parsing
    const parsed = new Date(trimmed);
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

type TenderWithExcelFlags = Partial<InsertTender> & {
  t247Id: string;
  tenderType: 'gem' | 'non_gem';
  similarCategory: string | null;
  excelMsmeExemption: boolean;
  excelStartupExemption: boolean;
};

function getColumnByLetter(sheet: XLSX.WorkSheet, rowIdx: number, colLetter: string): any {
  const cellAddress = `${colLetter}${rowIdx}`;
  const cell = sheet[cellAddress];
  return cell ? cell.v : null;
}

function parseLakhValue(value: any): number | null {
  if (!value) return null;
  const str = String(value).toLowerCase().trim();
  
  // Match patterns like "38 Lakh(s)", "15000 lakh", "15000 lakhs", "38 Lac(s)"
  // The pattern handles: lakh, lakhs, lakh(s), lac, lacs, lac(s)
  const lakhMatch = str.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakh(?:s|\(s\))?|lac(?:s|\(s\))?)/i);
  if (lakhMatch) {
    // Remove commas from number before parsing
    // Keep value in Lakhs - DO NOT convert to Crores
    return parseFloat(lakhMatch[1].replace(/,/g, ''));
  }
  
  // Try to parse as plain number (assume it's in Lakhs)
  const numMatch = str.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
  if (numMatch) {
    // Remove commas and return as-is (assumed to be in Lakhs)
    return parseFloat(numMatch[1].replace(/,/g, ''));
  }
  
  return null;
}

function parseTenderFromRow(row: any, tenderType: 'gem' | 'non_gem', sheet?: XLSX.WorkSheet, rowIndex?: number): TenderWithExcelFlags {
  const t247Id = findColumn(row, 't247id', 'id', 'tenderid', 'tenderno', 'tendernumber', 'refno', 'referenceno') || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get REFERENCE NO for title display
  const referenceNo = findColumn(row, 'referenceno', 'refno', 'refrno', 'reference', 'referanceno');
  
  // Get the tender brief/title - try Column D first (standard location in Excel)
  let tenderBrief = null;
  if (sheet && rowIndex !== undefined) {
    tenderBrief = getColumnByLetter(sheet, rowIndex, 'D');
  }
  // Fallback to name-based lookup
  if (!tenderBrief) {
    tenderBrief = findColumn(row, 'title', 'tendertitle', 'name', 'subject', 'work', 'description', 'tenderbrief', 'brief') || null;
  }
  
  // Combine REFERENCE NO with title if both exist
  let fullTitle = tenderBrief;
  if (referenceNo && tenderBrief) {
    fullTitle = `[${referenceNo}] ${tenderBrief}`;
  } else if (referenceNo) {
    fullTitle = `[${referenceNo}]`;
  }
  
  // Get MSME/Startup exemption from specific columns based on tender type
  let msmeExemptionValue = null;
  let startupExemptionValue = null;
  
  if (sheet && rowIndex !== undefined && tenderType === 'gem') {
    // GEM: Column K for MSME Exemption, Column L for Startup Exemption
    msmeExemptionValue = getColumnByLetter(sheet, rowIndex, 'K');
    startupExemptionValue = getColumnByLetter(sheet, rowIndex, 'L');
  } else {
    // Fallback to name-based lookup
    msmeExemptionValue = findColumn(row, 'msmeexemption', 'msme', 'msmeexempted');
    startupExemptionValue = findColumn(row, 'startupexemption', 'startup', 'startupexempted');
  }
  
  // Get turnover requirement based on tender type
  let turnoverRequirement: string | null = null;
  let similarCategory: string | null = null;
  
  if (sheet && rowIndex !== undefined && tenderType === 'gem') {
    // GEM: Column S for "Minimum Average Annual Turnover of the bidder" in Lakh format
    // Store value in Lakhs exactly as in Excel
    const turnoverRaw = getColumnByLetter(sheet, rowIndex, 'S');
    const turnoverInLakhs = parseLakhValue(turnoverRaw);
    if (turnoverInLakhs !== null) {
      turnoverRequirement = turnoverInLakhs.toString();
    }
    
    // GEM: Column X for "Similar Category" (core service keywords)
    const similarCatRaw = getColumnByLetter(sheet, rowIndex, 'X');
    if (similarCatRaw) {
      similarCategory = String(similarCatRaw).trim();
    }
  } else {
    // Non-GEM or fallback: use name-based lookup
    turnoverRequirement = parseNumber(findColumn(row, 'turnover', 'turnoverrequirement', 'annualturnover', 'minturnover'))?.toString() || null;
  }
  
  // Get location - use column position based on tender type
  // Non-GEM: Column H, GEM: Column Z
  let locationValue = null;
  if (sheet && rowIndex !== undefined) {
    if (tenderType === 'non_gem') {
      locationValue = getColumnByLetter(sheet, rowIndex, 'H');
    } else if (tenderType === 'gem') {
      locationValue = getColumnByLetter(sheet, rowIndex, 'Z');
    }
  }
  // Fallback to name-based lookup if column-based didn't find anything
  if (!locationValue) {
    locationValue = findColumn(row, 'location', 'place', 'city', 'state', 'region', 'area') || null;
  }

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
    location: locationValue ? String(locationValue).trim() : null,
    estimatedValue: parseNumber(findColumn(row, 'estimatedvalue', 'value', 'amount', 'budget', 'cost', 'estimatedcost', 'tendervalue'))?.toString() || null,
    emdAmount: parseNumber(findColumn(row, 'emd', 'emdamount', 'earnestmoney', 'earnestmoneydeposit', 'emdr', 'bidsecrurity'))?.toString() || null,
    turnoverRequirement,
    publishDate: parseExcelDate(findColumn(row, 'publishdate', 'publishedon', 'startdate', 'bidstartdate', 'publicationdate')),
    submissionDeadline: parseExcelDate(findColumn(row, 'submissiondeadline', 'deadline', 'duedate', 'bidenddate', 'closingdate', 'lastdate', 'bidsubmissionenddate')),
    openingDate: parseExcelDate(findColumn(row, 'openingdate', 'bidopeningdate', 'opendate', 'bidopeningdatetime')),
    eligibilityCriteria: eligibilityCriteria ? String(eligibilityCriteria) : null,
    checklist: findColumn(row, 'checklist', 'documents', 'requireddocuments', 'doclist', 'documentlist') || null,
    rawData: row,
    // GEM-specific: Similar Category from Column X
    similarCategory,
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
  newCount: number;
  duplicateCount: number;
  corrigendumCount: number;
  totalRows: number;
  currentSheet: string;
  processedRows: number;
  startTime: number;
  status: 'processing' | 'complete' | 'error';
  message?: string;
  clients: Set<any>;
}>();

// Store for re-analyze progress tracking
const reanalyzeProgressStore = {
  isRunning: false,
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  startTime: 0,
  status: 'idle' as 'idle' | 'running' | 'complete' | 'error',
  message: '',
  clients: new Set<any>(),
};

function sendReanalyzeProgress() {
  const elapsed = (Date.now() - reanalyzeProgressStore.startTime) / 1000;
  const rowsPerSecond = reanalyzeProgressStore.processed / Math.max(elapsed, 0.1);
  const remainingRows = reanalyzeProgressStore.total - reanalyzeProgressStore.processed;
  const estimatedTimeRemaining = remainingRows / Math.max(rowsPerSecond, 0.1);

  const data = {
    type: reanalyzeProgressStore.status,
    total: reanalyzeProgressStore.total,
    processed: reanalyzeProgressStore.processed,
    updated: reanalyzeProgressStore.updated,
    skipped: reanalyzeProgressStore.skipped,
    errors: reanalyzeProgressStore.errors,
    estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
    message: reanalyzeProgressStore.message,
  };

  const message = `data: ${JSON.stringify(data)}\n\n`;
  reanalyzeProgressStore.clients.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      // Client disconnected
    }
  });
}

async function reanalyzeAllTendersAsync() {
  try {
    const criteria = await storage.getCompanyCriteria();
    const negativeKeywords = await storage.getNegativeKeywords();
    const allTenders = await storage.getTenders();
    
    reanalyzeProgressStore.total = allTenders.length;
    reanalyzeProgressStore.processed = 0;
    reanalyzeProgressStore.updated = 0;
    reanalyzeProgressStore.skipped = 0;
    reanalyzeProgressStore.errors = 0;
    reanalyzeProgressStore.startTime = Date.now();
    reanalyzeProgressStore.status = 'running';
    
    sendReanalyzeProgress();
    
    for (const tender of allTenders) {
      try {
        if (tender.isManualOverride) {
          reanalyzeProgressStore.skipped++;
        } else {
          const result = analyzeEligibility(
            tender,
            criteria!,
            negativeKeywords,
            tender.isMsmeExempted || false,
            tender.isStartupExempted || false,
            tender.similarCategory || null
          );
          
          await storage.updateTender(tender.id, {
            matchPercentage: result.matchPercentage,
            isMsmeExempted: result.isMsmeExempted,
            isStartupExempted: result.isStartupExempted,
            tags: result.tags,
            analysisStatus: result.analysisStatus,
            eligibilityStatus: result.eligibilityStatus,
            notRelevantKeyword: result.notRelevantKeyword,
          });
          
          reanalyzeProgressStore.updated++;
        }
      } catch (err) {
        console.error(`Error re-analyzing tender ${tender.id}:`, err);
        reanalyzeProgressStore.errors++;
      }
      
      reanalyzeProgressStore.processed++;
      
      // Send progress update every 5 items or if less than 20 total
      if (reanalyzeProgressStore.processed % 5 === 0 || allTenders.length < 20) {
        sendReanalyzeProgress();
      }
    }
    
    // Also check for missed deadlines
    await storage.updateMissedDeadlines();
    
    reanalyzeProgressStore.status = 'complete';
    reanalyzeProgressStore.message = `Re-analyzed ${reanalyzeProgressStore.updated} tenders (${reanalyzeProgressStore.skipped} skipped, ${reanalyzeProgressStore.errors} errors)`;
    sendReanalyzeProgress();
    
  } catch (error: any) {
    console.error('Error in background re-analyze:', error);
    reanalyzeProgressStore.status = 'error';
    reanalyzeProgressStore.message = error.message || 'Re-analyze failed';
    sendReanalyzeProgress();
  } finally {
    reanalyzeProgressStore.isRunning = false;
  }
}

function sendProgressUpdate(uploadId: number) {
  const progress = uploadProgressStore.get(uploadId);
  if (!progress) return;

  const elapsed = (Date.now() - progress.startTime) / 1000;
  const rowsPerSecond = progress.processedRows / Math.max(elapsed, 0.1);
  const remainingRows = progress.totalRows - progress.processedRows;
  const estimatedTimeRemaining = remainingRows / Math.max(rowsPerSecond, 0.1);
  const percentComplete = Math.round((progress.processedRows / Math.max(progress.totalRows, 1)) * 100);

  const data = {
    type: progress.status,
    gemCount: progress.gemCount,
    nonGemCount: progress.nonGemCount,
    newCount: progress.newCount,
    duplicateCount: progress.duplicateCount,
    corrigendumCount: progress.corrigendumCount,
    failedCount: progress.failedCount,
    totalRows: progress.totalRows,
    currentSheet: progress.currentSheet,
    processedRows: progress.processedRows,
    percentComplete,
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
  if (!progress) {
    console.error(`[Upload ${uploadId}] Progress store not found!`);
    return;
  }

  console.log(`[Upload ${uploadId}] Starting background processing with ${progress.totalRows} total rows`);

  try {
    // Get company criteria and keywords once
    let criteria = await storage.getCompanyCriteria();
    if (!criteria) {
      criteria = await storage.upsertCompanyCriteria({
        turnoverCr: "4",
        projectTypes: ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
        updatedBy: userId,
      });
    }
    const negativeKeywords = await storage.getNegativeKeywords();

    let gemCount = 0;
    let nonGemCount = 0;
    let failedCount = 0;
    let newCount = 0;
    let duplicateCount = 0;
    let corrigendumCount = 0;
    let processedCount = 0;
    let totalRows = 0;

    // Process all sheets row by row
    for (const sheetName of workbook.SheetNames) {
      try {
        const normalizedName = sheetName.toLowerCase().replace(/[-_\s]/g, '');
        const tenderType: 'gem' | 'non_gem' = (normalizedName.includes('gem') && !normalizedName.includes('nongem') && !normalizedName.includes('non')) ? 'gem' : 'non_gem';
        
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        totalRows += data.length;
        console.log(`[Upload ${uploadId}] Sheet "${sheetName}": ${data.length} rows (${tenderType})`);
        
        for (let i = 0; i < data.length; i++) {
          try {
            const row = data[i];
            const rowIndex = i + 2;
            
            try {
              const tenderData = parseTenderFromRow(row, tenderType, sheet, rowIndex);
              if (!tenderData?.t247Id) {
                if (i < 5) console.log(`[Upload ${uploadId}] Row ${rowIndex}: No T247ID - skipped`);
                failedCount++;
                continue;
              }

              try {
                const existingTender = await storage.getTenderByT247Id(tenderData.t247Id);
                const matchResult = analyzeEligibility(tenderData, criteria, negativeKeywords, tenderData.excelMsmeExemption, tenderData.excelStartupExemption, tenderData.similarCategory);
                const { excelMsmeExemption, excelStartupExemption, similarCategory, ...tenderInsertData } = tenderData;

                if (existingTender) {
                  const changes = detectCorrigendumChanges(existingTender, tenderInsertData);
                  if (changes.length > 0) {
                    await storage.updateTender(existingTender.id, {
                      ...tenderInsertData,
                      uploadId,
                      matchPercentage: matchResult.matchPercentage,
                      isMsmeExempted: matchResult.isMsmeExempted,
                      isStartupExempted: matchResult.isStartupExempted,
                      tags: matchResult.tags,
                      analysisStatus: matchResult.analysisStatus,
                      eligibilityStatus: existingTender.isManualOverride ? existingTender.eligibilityStatus : matchResult.eligibilityStatus,
                      notRelevantKeyword: matchResult.notRelevantKeyword,
                      isCorrigendum: true,
                      isMissed: false,
                      missedAt: null,
                    });
                    
                    for (const change of changes) {
                      await storage.createCorrigendumChange({
                        tenderId: existingTender.id,
                        originalTenderId: existingTender.id,
                        fieldName: change.fieldName,
                        oldValue: change.oldValue,
                        newValue: change.newValue,
                      });
                    }
                    corrigendumCount++;
                  } else {
                    duplicateCount++;
                  }
                } else {
                  await storage.createTender({
                    ...tenderInsertData,
                    uploadId,
                    matchPercentage: matchResult.matchPercentage,
                    isMsmeExempted: matchResult.isMsmeExempted,
                    isStartupExempted: matchResult.isStartupExempted,
                    tags: matchResult.tags,
                    analysisStatus: matchResult.analysisStatus,
                    eligibilityStatus: matchResult.eligibilityStatus,
                    notRelevantKeyword: matchResult.notRelevantKeyword,
                    isCorrigendum: false,
                    originalTenderId: null,
                  });
                  newCount++;
                }

                if (tenderType === 'gem') gemCount++;
                else nonGemCount++;

                processedCount++;
              } catch (dbErr) {
                console.error(`[Upload ${uploadId}] DB Error on row ${rowIndex} (T247: ${tenderData?.t247Id}):`, (dbErr as any).message);
                failedCount++;
              }
            } catch (parseErr) {
              console.error(`[Upload ${uploadId}] Parse Error on row ${rowIndex}:`, (parseErr as any).message);
              failedCount++;
            }
          } catch (err) {
            console.error(`[Upload ${uploadId}] Row error:`, (err as any).message);
            failedCount++;
          }

          // Update progress every 10 rows for real-time visibility
          if (processedCount % 10 === 0) {
            progress.processedRows = processedCount;
            progress.gemCount = gemCount;
            progress.nonGemCount = nonGemCount;
            progress.newCount = newCount;
            progress.duplicateCount = duplicateCount;
            progress.corrigendumCount = corrigendumCount;
            sendProgressUpdate(uploadId);
          }
        }
      } catch (sheetErr) {
        console.error(`[Upload ${uploadId}] Sheet "${sheetName}" error:`, (sheetErr as any).message);
      }
    }

    console.log(`[Upload ${uploadId}] Finished processing all sheets. Updating database...`);

    // Final update to database
    await storage.updateExcelUpload(uploadId, {
      totalTenders: gemCount + nonGemCount,
      gemCount,
      nonGemCount,
      duplicateCount,
      corrigendumCount,
      newCount,
    });

    // Mark as complete
    progress.status = 'complete';
    progress.processedRows = totalRows;
    progress.gemCount = gemCount;
    progress.nonGemCount = nonGemCount;
    progress.newCount = newCount;
    progress.duplicateCount = duplicateCount;
    progress.corrigendumCount = corrigendumCount;
    sendProgressUpdate(uploadId);
    
    console.log(`[Upload ${uploadId}] ✅ COMPLETE: ${processedCount}/${totalRows} processed | New: ${newCount}, Duplicate: ${duplicateCount}, Corrigendum: ${corrigendumCount}, Failed: ${failedCount}`);

    setTimeout(() => uploadProgressStore.delete(uploadId), 300000);
  } catch (error: any) {
    console.error(`[Upload ${uploadId}] ❌ FATAL ERROR:`, error);
    progress.status = 'error';
    progress.message = error.message || 'Processing failed';
    sendProgressUpdate(uploadId);
    setTimeout(() => uploadProgressStore.delete(uploadId), 5000);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth
  await setupAuth(app);

  // Delete all data endpoint
  app.delete('/api/data/all', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAllData();
      res.json({ success: true, message: "All data deleted successfully" });
    } catch (error) {
      console.error("Error deleting data:", error);
      res.status(500).json({ message: "Failed to delete data" });
    }
  });
  
  // Cleanup duplicate tenders endpoint
  app.post('/api/tenders/cleanup-duplicates', isAuthenticated, async (req, res) => {
    try {
      const result = await storage.cleanupDuplicateTenders();
      res.json({ 
        success: true, 
        message: `Removed ${result.duplicatesRemoved} duplicate tenders`,
        ...result 
      });
    } catch (error) {
      console.error("Error cleaning up duplicates:", error);
      res.status(500).json({ message: "Failed to cleanup duplicates" });
    }
  });

  // Re-analyze all tenders with updated eligibility logic (background processing)
  app.post('/api/tenders/reanalyze', isAuthenticated, async (req, res) => {
    try {
      // Check if already running
      if (reanalyzeProgressStore.isRunning) {
        return res.status(409).json({ 
          message: "Re-analysis is already in progress",
          status: reanalyzeProgressStore.status 
        });
      }
      
      reanalyzeProgressStore.isRunning = true;
      reanalyzeProgressStore.status = 'running';
      reanalyzeProgressStore.message = '';
      
      // Return immediately, process in background
      res.json({ 
        success: true, 
        message: "Re-analysis started in background" 
      });
      
      // Start background processing
      reanalyzeAllTendersAsync();
      
    } catch (error) {
      console.error("Error starting re-analyze:", error);
      res.status(500).json({ message: "Failed to start re-analyze" });
    }
  });
  
  // SSE endpoint for re-analyze progress
  app.get('/api/reanalyze-progress', isAuthenticated, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    reanalyzeProgressStore.clients.add(res);
    
    // Send current status immediately
    sendReanalyzeProgress();
    
    req.on('close', () => {
      reanalyzeProgressStore.clients.delete(res);
    });
  });
  
  // Get re-analyze status (non-SSE)
  app.get('/api/reanalyze-status', isAuthenticated, (req, res) => {
    res.json({
      isRunning: reanalyzeProgressStore.isRunning,
      status: reanalyzeProgressStore.status,
      total: reanalyzeProgressStore.total,
      processed: reanalyzeProgressStore.processed,
      updated: reanalyzeProgressStore.updated,
      skipped: reanalyzeProgressStore.skipped,
      errors: reanalyzeProgressStore.errors,
      message: reanalyzeProgressStore.message,
    });
  });
  
  // Missed tenders endpoints
  app.get('/api/tenders/missed', isAuthenticated, async (req, res) => {
    try {
      // First update missed status based on deadlines
      await storage.updateMissedDeadlines();
      const tenders = await storage.getMissedTenders();
      res.json(tenders);
    } catch (error) {
      console.error("Error fetching missed tenders:", error);
      res.status(500).json({ message: "Failed to fetch missed tenders" });
    }
  });
  
  // Update missed deadlines manually
  app.post('/api/tenders/update-missed', isAuthenticated, async (req, res) => {
    try {
      const result = await storage.updateMissedDeadlines();
      res.json({ 
        success: true, 
        updated: result.updated,
        restored: result.restored,
        message: `Marked ${result.updated} as missed, restored ${result.restored}` 
      });
    } catch (error) {
      console.error("Error updating missed deadlines:", error);
      res.status(500).json({ message: "Failed to update missed deadlines" });
    }
  });

  // Fix dates by re-parsing from raw_data (DD-MM-YYYY format)
  app.post('/api/tenders/fix-dates', isAuthenticated, async (req, res) => {
    try {
      const allTenders = await storage.getTenders();
      let fixed = 0;
      let errors = 0;
      
      for (const tender of allTenders) {
        try {
          if (!tender.rawData) continue;
          
          const rawData = typeof tender.rawData === 'string' 
            ? JSON.parse(tender.rawData) 
            : tender.rawData;
          
          // Find deadline field in raw data
          const deadlineValue = rawData['Deadline'] || rawData['deadline'] || 
                               rawData['Submission Deadline'] || rawData['submissiondeadline'] ||
                               rawData['Due Date'] || rawData['duedate'] ||
                               rawData['Bid End Date'] || rawData['bidenddate'] ||
                               rawData['Last Date'] || rawData['lastdate'];
          
          if (deadlineValue) {
            const newDeadline = parseExcelDate(deadlineValue);
            
            if (newDeadline && tender.submissionDeadline) {
              const existingDate = new Date(tender.submissionDeadline);
              
              // Check if dates are different (day and month might be swapped)
              if (newDeadline.getTime() !== existingDate.getTime()) {
                await storage.updateTender(tender.id, {
                  submissionDeadline: newDeadline,
                });
                fixed++;
              }
            }
          }
        } catch (err) {
          errors++;
          console.error(`Error fixing date for tender ${tender.t247Id}:`, err);
        }
      }
      
      // After fixing dates, update missed status
      await storage.updateMissedDeadlines();
      
      res.json({ 
        success: true, 
        fixed,
        errors,
        total: allTenders.length,
        message: `Fixed ${fixed} tender dates (${errors} errors)` 
      });
    } catch (error) {
      console.error("Error fixing dates:", error);
      res.status(500).json({ message: "Failed to fix dates" });
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

  // Get unique locations
  app.get('/api/tenders/locations', isAuthenticated, async (req, res) => {
    try {
      const locations = await storage.getUniqueLocations();
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
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

  // Get corrigendum changes for a tender
  app.get('/api/tenders/:id/corrigendum-changes', isAuthenticated, async (req, res) => {
    try {
      const changes = await storage.getChangesForTender(parseInt(req.params.id));
      res.json(changes);
    } catch (error) {
      console.error("Error fetching corrigendum changes:", error);
      res.status(500).json({ message: "Failed to fetch corrigendum changes" });
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

  // Excel upload endpoint - uses background processing for real-time progress
  app.post('/api/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.id;
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
        newCount: 0,
        duplicateCount: 0,
        corrigendumCount: 0,
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
      const userId = req.user.id;
      const { turnoverCr, projectTypes } = req.body;

      const criteria = await storage.upsertCompanyCriteria({
        turnoverCr: turnoverCr || "4",
        projectTypes: projectTypes || ['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment'],
        updatedBy: userId,
      });

      // Re-analyze all tenders with new criteria
      const negativeKeywords = await storage.getNegativeKeywords();
      const tenders = await storage.getTenders();
      for (const tender of tenders) {
        // Skip if manually overridden
        if (tender.isManualOverride) continue;
        
        const matchResult = analyzeEligibility(tender, criteria, negativeKeywords);
        await storage.updateTender(tender.id, {
          matchPercentage: matchResult.matchPercentage,
          isMsmeExempted: matchResult.isMsmeExempted,
          isStartupExempted: matchResult.isStartupExempted,
          tags: matchResult.tags,
          eligibilityStatus: matchResult.eligibilityStatus,
          notRelevantKeyword: matchResult.notRelevantKeyword,
        });
      }

      res.json(criteria);
    } catch (error) {
      console.error("Error updating criteria:", error);
      res.status(500).json({ message: "Failed to update criteria" });
    }
  });

  // Negative keywords endpoints
  app.get('/api/negative-keywords', isAuthenticated, async (req, res) => {
    try {
      const keywords = await storage.getNegativeKeywords();
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching negative keywords:", error);
      res.status(500).json({ message: "Failed to fetch negative keywords" });
    }
  });

  app.post('/api/negative-keywords', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { keyword, description } = req.body;

      if (!keyword || !keyword.trim()) {
        return res.status(400).json({ message: "Keyword is required" });
      }

      const created = await storage.createNegativeKeyword({
        keyword: keyword.trim(),
        description: description || null,
        createdBy: userId || null,
      });

      // Re-analyze all tenders to mark matching ones as not relevant
      const criteria = await storage.getCompanyCriteria();
      const negativeKeywords = await storage.getNegativeKeywords();
      const tenders = await storage.getTenders();
      
      for (const tender of tenders) {
        // Skip if manually overridden
        if (tender.isManualOverride) continue;
        
        const matchResult = analyzeEligibility(tender, criteria!, negativeKeywords);
        if (matchResult.eligibilityStatus !== tender.eligibilityStatus) {
          await storage.updateTender(tender.id, {
            eligibilityStatus: matchResult.eligibilityStatus,
            notRelevantKeyword: matchResult.notRelevantKeyword,
            matchPercentage: matchResult.matchPercentage,
          });
        }
      }

      res.json(created);
    } catch (error: any) {
      console.error("Error creating negative keyword:", error);
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ message: "This keyword already exists" });
      }
      res.status(500).json({ message: "Failed to create negative keyword" });
    }
  });

  app.delete('/api/negative-keywords/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteNegativeKeyword(id);
      
      // Re-analyze tenders that were marked as not relevant due to this keyword
      const criteria = await storage.getCompanyCriteria();
      const negativeKeywords = await storage.getNegativeKeywords();
      const tenders = await storage.getTenders();
      
      for (const tender of tenders) {
        if (tender.isManualOverride) continue;
        
        const matchResult = analyzeEligibility(tender, criteria!, negativeKeywords);
        await storage.updateTender(tender.id, {
          eligibilityStatus: matchResult.eligibilityStatus,
          notRelevantKeyword: matchResult.notRelevantKeyword,
          matchPercentage: matchResult.matchPercentage,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting negative keyword:", error);
      res.status(500).json({ message: "Failed to delete negative keyword" });
    }
  });

  // Get tenders by eligibility status
  app.get('/api/tenders/status/:status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.params;
      if (!['eligible', 'not_eligible', 'not_relevant', 'manual_review', 'missed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // For missed status, use the dedicated missed tenders method
      if (status === 'missed') {
        await storage.updateMissedDeadlines();
        const tenders = await storage.getMissedTenders();
        return res.json(tenders);
      }
      
      const tenders = await storage.getTendersByEligibilityStatus(status);
      res.json(tenders);
    } catch (error) {
      console.error("Error fetching tenders by status:", error);
      res.status(500).json({ message: "Failed to fetch tenders" });
    }
  });

  // Manual override endpoint
  app.post('/api/tenders/:id/override', isAuthenticated, async (req: any, res) => {
    try {
      const tenderId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub;
      const { overrideStatus, overrideReason, overrideComment } = req.body;

      if (!overrideStatus || !['not_eligible', 'not_relevant'].includes(overrideStatus)) {
        return res.status(400).json({ message: "Invalid override status. Must be 'not_eligible' or 'not_relevant'" });
      }

      if (!overrideReason) {
        return res.status(400).json({ message: "Override reason is required" });
      }

      // Get tender first to include T247 ID in audit log
      const existingTender = await storage.getTenderById(tenderId);
      if (!existingTender) {
        return res.status(404).json({ message: "Tender not found" });
      }

      const tender = await storage.updateTenderOverride(tenderId, {
        overrideStatus,
        overrideReason,
        overrideComment: overrideComment || null,
        overrideBy: userId || null,
      });

      if (!tender) {
        return res.status(404).json({ message: "Tender not found" });
      }

      // Log the override action for MIS reporting
      try {
        const user = req.user;
        await storage.createAuditLog({
          action: 'override',
          category: 'tender',
          userId: user?.id?.toString() || userId || '0',
          userName: user?.claims?.email || user?.claims?.sub || userId || 'unknown',
          targetId: tenderId.toString(),
          targetName: existingTender.t247Id || `Tender #${tenderId}`,
          details: JSON.stringify({
            overrideStatus,
            overrideReason,
            overrideComment,
            tenderId,
            t247Id: existingTender.t247Id,
          }),
        });
      } catch (logError) {
        console.error("Error logging override action:", logError);
      }

      res.json(tender);
    } catch (error) {
      console.error("Error overriding tender:", error);
      res.status(500).json({ message: "Failed to override tender" });
    }
  });

  // Undo manual override
  app.delete('/api/tenders/:id/override', isAuthenticated, async (req, res) => {
    try {
      const tenderId = parseInt(req.params.id);
      
      // Reset override and re-analyze
      const criteria = await storage.getCompanyCriteria();
      const negativeKeywords = await storage.getNegativeKeywords();
      const tender = await storage.getTenderById(tenderId);
      
      if (!tender) {
        return res.status(404).json({ message: "Tender not found" });
      }

      const matchResult = analyzeEligibility(tender, criteria!, negativeKeywords);
      
      const updated = await storage.updateTender(tenderId, {
        isManualOverride: false,
        overrideStatus: null,
        overrideReason: null,
        overrideComment: null,
        overrideBy: null,
        overrideAt: null,
        eligibilityStatus: matchResult.eligibilityStatus,
        notRelevantKeyword: matchResult.notRelevantKeyword,
        matchPercentage: matchResult.matchPercentage,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error removing override:", error);
      res.status(500).json({ message: "Failed to remove override" });
    }
  });

  // ==========================================
  // TEAM MANAGEMENT & WORKFLOW ROUTES
  // ==========================================

  app.get('/api/me/team-member', isAuthenticated, async (req: any, res) => {
    const user = req.user;
    res.json({
      id: user.teamMemberId || 1,
      username: user.username,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      isActive: true
    });
  });

  app.get('/api/team-members', isAuthenticated, async (req, res) => {
    try {
      const members = await storage.getTeamMembers();
      // Don't send password hashes to client
      const safeMembersData = members.map(({ password, ...rest }) => rest);
      res.json(safeMembersData);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.get('/api/team-members/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const member = await storage.getTeamMemberById(id);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      const { password, ...safeMember } = member;
      res.json(safeMember);
    } catch (error) {
      console.error("Error fetching team member:", error);
      res.status(500).json({ message: "Failed to fetch team member" });
    }
  });

  app.post('/api/team-members', isAuthenticated, async (req: any, res) => {
    try {
      const { username, password, email, fullName, role } = req.body;
      
      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "Username, password, and full name are required" });
      }

      // Check if username already exists
      const existing = await storage.getTeamMemberByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      const member = await storage.createTeamMember({
        username,
        password: hashedPassword,
        email: email || null,
        fullName,
        role: role || 'bidder',
        isActive: true,
        createdBy: null, // Could link to current user if needed
      });

      const { password: _, ...safeMember } = member;
      res.json(safeMember);
    } catch (error: any) {
      console.error("Error creating team member:", error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Username or email already exists" });
      }
      res.status(500).json({ message: "Failed to create team member" });
    }
  });

  app.put('/api/team-members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, password, email, fullName, role, isActive } = req.body;
      
      const updateData: any = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      // Only hash password if it's being updated
      if (password) {
        const bcrypt = await import('bcrypt');
        updateData.password = await bcrypt.hash(password, 10);
      }

      const member = await storage.updateTeamMember(id, updateData);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      
      const { password: _, ...safeMember } = member;
      res.json(safeMember);
    } catch (error: any) {
      console.error("Error updating team member:", error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Username or email already exists" });
      }
      res.status(500).json({ message: "Failed to update team member" });
    }
  });

  app.delete('/api/team-members/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTeamMember(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting team member:", error);
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });

  // Tender Assignment Routes
  app.get('/api/assignments', isAuthenticated, async (req, res) => {
    try {
      const { stage, priority, assignee } = req.query;
      let assignments = await storage.getTenderAssignments();
      
      // Apply filters if provided
      if (stage && stage !== 'all') {
        assignments = assignments.filter(a => a.currentStage === stage);
      }
      if (priority && priority !== 'all') {
        assignments = assignments.filter(a => a.priority === priority);
      }
      if (assignee && assignee !== 'all') {
        assignments = assignments.filter(a => a.assignedTo === parseInt(assignee as string));
      }
      
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.get('/api/assignments/my', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role === 'admin') {
        const assignments = await storage.getTenderAssignments();
        return res.json(assignments);
      }
      const assignments = await storage.getAssignmentsByUserId(user.teamMemberId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.get('/api/assignments/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const assignments = await storage.getAssignmentsByUserId(userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching user assignments:", error);
      res.status(500).json({ message: "Failed to fetch user assignments" });
    }
  });

  app.get('/api/tenders/:id/assignment', isAuthenticated, async (req, res) => {
    try {
      const tenderId = parseInt(req.params.id);
      const assignment = await storage.getAssignmentByTenderId(tenderId);
      res.json(assignment || null);
    } catch (error) {
      console.error("Error fetching tender assignment:", error);
      res.status(500).json({ message: "Failed to fetch tender assignment" });
    }
  });

  app.post('/api/assignments', isAuthenticated, async (req, res) => {
    try {
      const { tenderId, assignedTo, assignedBy, priority, notes } = req.body;
      
      if (!tenderId || !assignedTo || !assignedBy) {
        return res.status(400).json({ message: "Tender ID, assignee, and assigner are required" });
      }

      const existingAssignment = await storage.getAssignmentByTenderId(tenderId);
      if (existingAssignment?.isActive) {
        return res.status(409).json({ message: "Tender already assigned" });
      }

      const assignment = await storage.createTenderAssignment({
        tenderId,
        assignedTo,
        assignedBy,
        priority: priority || 'normal',
        notes: notes || null,
        isActive: true,
      });

      // Record initial workflow history
      await storage.createWorkflowHistory({
        assignmentId: assignment.id,
        fromStage: null,
        toStage: 'assigned',
        changedBy: assignedBy,
        note: 'Tender assigned',
      });

      // Log tender assignment
      try {
        const user = (req as any).user;
        const tender = await storage.getTenderById(tenderId);
        await storage.createAuditLog({
          action: 'assign',
          category: 'workflow',
          userId: user?.id || 0,
          userName: user?.username || user?.email || 'unknown',
          targetType: 'tender_assignment',
          targetId: assignment.id.toString(),
          targetName: tender?.t247Id || 'Unknown',
          details: JSON.stringify({ tenderId, assignedTo, assignedBy, priority }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log assignment:", e);
      }

      res.json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  app.put('/api/assignments/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assignedTo, priority, notes } = req.body;
      
      const updateData: any = {};
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (priority !== undefined) updateData.priority = priority;
      if (notes !== undefined) updateData.notes = notes;

      const assignment = await storage.updateTenderAssignment(id, updateData);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      console.error("Error updating assignment:", error);
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  app.delete('/api/assignments/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTenderAssignment(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Workflow Stage Update Route
  app.post('/api/assignments/:id/stage', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { stage, changedBy, note } = req.body;
      
      if (!stage || !changedBy) {
        return res.status(400).json({ message: "Stage and changedBy are required" });
      }

      const validStages = ['assigned', 'in_progress', 'ready_for_review', 'submitted'];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ message: "Invalid stage. Must be one of: " + validStages.join(', ') });
      }

      const assignment = await storage.updateAssignmentStage(id, stage, changedBy, note);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Log workflow stage change
      try {
        const user = (req as any).user;
        await storage.createAuditLog({
          action: 'status_change',
          category: 'workflow',
          userId: user?.id || 0,
          userName: user?.username || user?.email || 'unknown',
          targetType: 'tender_assignment',
          targetId: id.toString(),
          targetName: `Stage: ${stage}`,
          details: JSON.stringify({ fromStage: 'previous', toStage: stage, note }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log stage change:", e);
      }

      res.json(assignment);
    } catch (error) {
      console.error("Error updating assignment stage:", error);
      res.status(500).json({ message: "Failed to update assignment stage" });
    }
  });

  // Workflow History Route
  app.get('/api/assignments/:id/history', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getWorkflowHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching workflow history:", error);
      res.status(500).json({ message: "Failed to fetch workflow history" });
    }
  });

  // Bidding Submissions Routes
  app.get('/api/submissions', isAuthenticated, async (req, res) => {
    try {
      const submissions = await storage.getBiddingSubmissions();
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.post('/api/submissions', isAuthenticated, async (req, res) => {
    try {
      const { tenderId, assignmentId, submittedBy, submittedBudget, submissionDate, portalReferenceNumber, notes } = req.body;
      
      if (!tenderId || !assignmentId || !submittedBy || !submittedBudget || !submissionDate) {
        return res.status(400).json({ message: "Tender ID, assignment ID, submitter, budget, and date are required" });
      }

      const submission = await storage.createBiddingSubmission({
        tenderId,
        assignmentId,
        submittedBy,
        submittedBudget: submittedBudget.toString(),
        submissionDate: new Date(submissionDate),
        portalReferenceNumber: portalReferenceNumber || null,
        notes: notes || null,
      });

      // Record workflow history
      await storage.createWorkflowHistory({
        assignmentId,
        fromStage: 'ready_for_review',
        toStage: 'submitted',
        changedBy: submittedBy,
        note: `Submitted to portal with budget: ${submittedBudget} Lakhs`,
      });

      // Log submission
      try {
        const user = (req as any).user;
        const tender = await storage.getTenderById(tenderId);
        await storage.createAuditLog({
          action: 'submit',
          category: 'workflow',
          userId: user?.id || 0,
          userName: user?.username || user?.email || 'unknown',
          targetType: 'bidding_submission',
          targetId: submission.id.toString(),
          targetName: tender?.t247Id || 'Unknown',
          details: JSON.stringify({ budget: submittedBudget, portal: portalReferenceNumber }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log submission:", e);
      }

      res.json(submission);
    } catch (error) {
      console.error("Error creating submission:", error);
      res.status(500).json({ message: "Failed to create submission" });
    }
  });

  // Workflow Stats Route
  app.get('/api/workflow-stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getWorkflowStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching workflow stats:", error);
      res.status(500).json({ message: "Failed to fetch workflow stats" });
    }
  });

  // Audit Log Routes (Admin only)
  app.get('/api/audit-logs', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const user = req.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const { category, action, limit } = req.query;
      const logs = await storage.getAuditLogs({
        category: category as string,
        action: action as string,
        limit: limit ? parseInt(limit as string) : 100,
      });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ===============================
  // TENDER RESULTS ROUTES
  // ===============================

  // Get all tender results with history
  app.get('/api/tender-results', isAuthenticated, async (req, res) => {
    try {
      const results = await storage.getTenderResults();
      res.json(results);
    } catch (error) {
      console.error("Error fetching tender results:", error);
      res.status(500).json({ message: "Failed to fetch tender results" });
    }
  });

  // Get single tender result by ID
  app.get('/api/tender-results/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.getTenderResultById(id);
      if (!result) {
        return res.status(404).json({ message: "Tender result not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching tender result:", error);
      res.status(500).json({ message: "Failed to fetch tender result" });
    }
  });

  // Search tender references for autocomplete
  app.get('/api/tender-references/search', isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      const results = await storage.searchTenderReferences(query || '');
      res.json(results);
    } catch (error) {
      console.error("Error searching tender references:", error);
      res.status(500).json({ message: "Failed to search tender references" });
    }
  });

  // Create new tender result
  app.post('/api/tender-results', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Validate request body with Zod
      const validationResult = createTenderResultSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const { referenceId, status, tenderId } = validationResult.data;

      // Check if result already exists for this reference
      const existing = await storage.getTenderResultByReferenceId(referenceId);
      if (existing) {
        return res.status(400).json({ 
          message: "A result already exists for this reference ID. Use the update endpoint instead.",
          existingId: existing.id
        });
      }

      // Require valid team member ID - if not available, get the first team member as fallback
      let updatedBy = user?.teamMemberId;
      if (!updatedBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          updatedBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available to assign this action" });
        }
      }

      const result = await storage.createTenderResult({
        referenceId,
        currentStatus: status,
        tenderId: tenderId || null,
        updatedBy,
      });

      // Log the action
      try {
        await storage.createAuditLog({
          action: 'create',
          category: 'tender_result',
          userId: user?.id?.toString() || '0',
          userName: user?.username || user?.email || 'unknown',
          targetType: 'tender_result',
          targetId: result.id.toString(),
          targetName: referenceId,
          details: JSON.stringify({ status }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log tender result creation:", e);
      }

      res.json(result);
    } catch (error) {
      console.error("Error creating tender result:", error);
      res.status(500).json({ message: "Failed to create tender result" });
    }
  });

  // Update tender result status
  app.patch('/api/tender-results/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user;
      
      // Validate request body with Zod
      const validationResult = updateTenderResultStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const { status, note } = validationResult.data;

      // Require valid team member ID - if not available, get the first team member as fallback
      let updatedBy = user?.teamMemberId;
      if (!updatedBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          updatedBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available to assign this action" });
        }
      }

      const result = await storage.updateTenderResultStatus(id, status, updatedBy, note);
      if (!result) {
        return res.status(404).json({ message: "Tender result not found" });
      }

      // Log the status update
      try {
        await storage.createAuditLog({
          action: 'status_change',
          category: 'tender_result',
          userId: user?.id?.toString() || '0',
          userName: user?.username || user?.email || 'unknown',
          targetType: 'tender_result',
          targetId: id.toString(),
          targetName: result.referenceId,
          details: JSON.stringify({ newStatus: status, note }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log tender result status change:", e);
      }

      // Get the full result with history
      const fullResult = await storage.getTenderResultById(id);
      res.json(fullResult);
    } catch (error) {
      console.error("Error updating tender result status:", error);
      res.status(500).json({ message: "Failed to update tender result status" });
    }
  });

  // Get history for a specific tender result
  app.get('/api/tender-results/:id/history', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getTenderResultHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching tender result history:", error);
      res.status(500).json({ message: "Failed to fetch tender result history" });
    }
  });

  // ===============================
  // PRESENTATION ROUTES
  // ===============================

  // Get today's presentations for the current user (for notifications)
  // Note: This route MUST be before /:id route to avoid "today" being captured as an ID
  app.get('/api/presentations/today', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Check if user is an admin (either from session role or team member role)
      const isSessionAdmin = user.role === 'admin';
      
      // Get the team member record for the current user
      const teamMember = await storage.getTeamMemberByUsername(user.id);
      
      // Determine if user is admin and their team member ID
      const isAdmin = isSessionAdmin || (teamMember?.role === 'admin');
      const teamMemberId = teamMember?.id ?? 0;
      
      // Admins get all today's presentations, non-admins get only assigned ones
      const presentations = await storage.getTodaysPresentationsForUser(teamMemberId, isAdmin);
      
      res.json(presentations);
    } catch (error) {
      console.error("Error fetching today's presentations:", error);
      res.status(500).json({ message: "Failed to fetch today's presentations" });
    }
  });

  // Get all presentations
  app.get('/api/presentations', isAuthenticated, async (req, res) => {
    try {
      const presentations = await storage.getPresentations();
      res.json(presentations);
    } catch (error) {
      console.error("Error fetching presentations:", error);
      res.status(500).json({ message: "Failed to fetch presentations" });
    }
  });

  // Get presentation by ID
  app.get('/api/presentations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const presentation = await storage.getPresentationById(id);
      if (!presentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }
      res.json(presentation);
    } catch (error) {
      console.error("Error fetching presentation:", error);
      res.status(500).json({ message: "Failed to fetch presentation" });
    }
  });

  // Get presentations by reference ID
  app.get('/api/presentations/by-reference/:referenceId', isAuthenticated, async (req, res) => {
    try {
      const referenceId = decodeURIComponent(req.params.referenceId);
      const presentations = await storage.getPresentationsByReferenceId(referenceId);
      res.json(presentations);
    } catch (error) {
      console.error("Error fetching presentations by reference:", error);
      res.status(500).json({ message: "Failed to fetch presentations" });
    }
  });

  // Create new presentation (with optional file upload)
  app.post('/api/presentations', isAuthenticated, upload.single('document'), async (req: any, res) => {
    try {
      const user = req.user;
      const file = req.file;
      
      // Parse JSON body fields if they come as strings (from FormData)
      let bodyData = req.body;
      if (typeof req.body.departmentContacts === 'string') {
        try {
          bodyData = {
            ...req.body,
            departmentContacts: JSON.parse(req.body.departmentContacts),
            tenderId: req.body.tenderId ? parseInt(req.body.tenderId) : null,
            assignedTo: parseInt(req.body.assignedTo),
          };
        } catch (e) {
          bodyData = req.body;
        }
      }
      
      const validationResult = createPresentationSchema.safeParse(bodyData);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;

      // Get team member ID for createdBy
      let createdBy = user?.teamMemberId;
      if (!createdBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          createdBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available" });
        }
      }

      const presentation = await storage.createPresentation({
        referenceId: data.referenceId,
        tenderId: data.tenderId || null,
        scheduledDate: new Date(data.scheduledDate),
        scheduledTime: data.scheduledTime,
        assignedTo: data.assignedTo,
        departmentContacts: data.departmentContacts || [],
        notes: data.notes || null,
        createdBy,
        documentFile: file ? file.path : null,
      });

      // Log the action
      try {
        await storage.createAuditLog({
          action: 'create',
          category: 'presentation',
          userId: user?.id?.toString() || '0',
          userName: user?.username || user?.email || 'unknown',
          targetType: 'presentation',
          targetId: presentation.id.toString(),
          targetName: data.referenceId,
          details: JSON.stringify({ scheduledDate: data.scheduledDate, scheduledTime: data.scheduledTime }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log presentation creation:", e);
      }

      const fullPresentation = await storage.getPresentationById(presentation.id);
      res.json(fullPresentation);
    } catch (error) {
      console.error("Error creating presentation:", error);
      res.status(500).json({ message: "Failed to create presentation" });
    }
  });

  // Update presentation
  app.patch('/api/presentations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const validationResult = updatePresentationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;
      const updateData: any = { ...data };
      
      if (data.scheduledDate) {
        updateData.scheduledDate = new Date(data.scheduledDate);
      }

      const presentation = await storage.updatePresentation(id, updateData);
      if (!presentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }

      const fullPresentation = await storage.getPresentationById(presentation.id);
      res.json(fullPresentation);
    } catch (error) {
      console.error("Error updating presentation:", error);
      res.status(500).json({ message: "Failed to update presentation" });
    }
  });

  // Update presentation status
  app.patch('/api/presentations/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user;
      
      // Get the presentation to check authorization
      const existingPresentation = await storage.getPresentationById(id);
      if (!existingPresentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }
      
      // Authorization: Admin/Manager can always update, assigned user can update their own
      const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
      const isAssigned = user?.teamMemberId && existingPresentation.assignedTo === user.teamMemberId;
      
      if (!isAdminOrManager && !isAssigned) {
        return res.status(403).json({ message: "Only admin, manager, or assigned team member can update status" });
      }
      
      const validationResult = updatePresentationStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const { status, note } = validationResult.data;

      let changedBy = user?.teamMemberId;
      if (!changedBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          changedBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available" });
        }
      }

      const presentation = await storage.updatePresentationStatus(id, status, changedBy, note);
      if (!presentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }

      const fullPresentation = await storage.getPresentationById(presentation.id);
      res.json(fullPresentation);
    } catch (error) {
      console.error("Error updating presentation status:", error);
      res.status(500).json({ message: "Failed to update presentation status" });
    }
  });

  // Upload presentation file
  app.post('/api/presentations/:id/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // For now, store the file info (in production, save to disk/cloud storage)
      const filePath = `presentations/${id}_${Date.now()}_${req.file.originalname}`;

      let changedBy = user?.teamMemberId;
      if (!changedBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          changedBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available" });
        }
      }

      const presentation = await storage.uploadPresentationFile(id, filePath, changedBy);
      if (!presentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }

      const fullPresentation = await storage.getPresentationById(presentation.id);
      res.json(fullPresentation);
    } catch (error) {
      console.error("Error uploading presentation file:", error);
      res.status(500).json({ message: "Failed to upload presentation file" });
    }
  });

  // Delete presentation
  app.delete('/api/presentations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePresentation(id);
      res.json({ message: "Presentation deleted successfully" });
    } catch (error) {
      console.error("Error deleting presentation:", error);
      res.status(500).json({ message: "Failed to delete presentation" });
    }
  });

  // ===============================
  // CLARIFICATION ROUTES
  // ===============================

  // Get today's clarifications for the current user (for notifications)
  // Note: This route MUST be before /:id route to avoid "today" being captured as an ID
  app.get('/api/clarifications/today', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Check if user is an admin (either from session role or team member role)
      const isSessionAdmin = user.role === 'admin';
      
      // Get the team member record for the current user
      const teamMember = await storage.getTeamMemberByUsername(user.id);
      
      // Determine if user is admin and their team member ID
      const isAdmin = isSessionAdmin || (teamMember?.role === 'admin');
      const teamMemberId = teamMember?.id ?? 0;
      
      // Admins get all today's clarifications, non-admins get only assigned ones
      const clarifications = await storage.getTodaysClarificationsForUser(teamMemberId, isAdmin);
      
      res.json(clarifications);
    } catch (error) {
      console.error("Error fetching today's clarifications:", error);
      res.status(500).json({ message: "Failed to fetch today's clarifications" });
    }
  });

  // Get all clarifications
  app.get('/api/clarifications', isAuthenticated, async (req, res) => {
    try {
      const clarifications = await storage.getClarifications();
      res.json(clarifications);
    } catch (error) {
      console.error("Error fetching clarifications:", error);
      res.status(500).json({ message: "Failed to fetch clarifications" });
    }
  });

  // Get clarification by ID
  app.get('/api/clarifications/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const clarification = await storage.getClarificationById(id);
      if (!clarification) {
        return res.status(404).json({ message: "Clarification not found" });
      }
      res.json(clarification);
    } catch (error) {
      console.error("Error fetching clarification:", error);
      res.status(500).json({ message: "Failed to fetch clarification" });
    }
  });

  // Get clarifications by reference ID
  app.get('/api/clarifications/by-reference/:referenceId', isAuthenticated, async (req, res) => {
    try {
      const referenceId = decodeURIComponent(req.params.referenceId);
      const clarifications = await storage.getClarificationsByReferenceId(referenceId);
      res.json(clarifications);
    } catch (error) {
      console.error("Error fetching clarifications by reference:", error);
      res.status(500).json({ message: "Failed to fetch clarifications" });
    }
  });

  // Create new clarification (with optional file upload)
  app.post('/api/clarifications', isAuthenticated, upload.single('document'), async (req: any, res) => {
    try {
      const user = req.user;
      const file = req.file;
      
      // Parse JSON body fields if they come as strings (from FormData)
      let bodyData = req.body;
      if (typeof req.body.departmentContacts === 'string') {
        try {
          bodyData = {
            ...req.body,
            departmentContacts: JSON.parse(req.body.departmentContacts),
            tenderId: req.body.tenderId ? parseInt(req.body.tenderId) : null,
            assignedTo: parseInt(req.body.assignedTo),
          };
        } catch (e) {
          bodyData = req.body;
        }
      }
      
      const validationResult = createClarificationSchema.safeParse(bodyData);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;

      // Get team member ID for createdBy
      let createdBy = user?.teamMemberId;
      if (!createdBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          createdBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available" });
        }
      }

      const clarification = await storage.createClarification({
        referenceId: data.referenceId,
        tenderId: data.tenderId || null,
        clarificationDetails: data.clarificationDetails,
        assignedTo: data.assignedTo,
        departmentContacts: data.departmentContacts || [],
        notes: data.notes || null,
        createdBy,
        submitDeadlineDate: data.submitDeadlineDate ? new Date(data.submitDeadlineDate) : null,
        submitDeadlineTime: data.submitDeadlineTime || null,
        documentFile: file ? file.path : null,
      });

      // Log the action
      try {
        await storage.createAuditLog({
          action: 'create',
          category: 'clarification',
          userId: user?.id?.toString() || '0',
          userName: user?.username || user?.email || 'unknown',
          targetType: 'clarification',
          targetId: clarification.id.toString(),
          targetName: data.referenceId,
          details: JSON.stringify({ clarificationDetails: data.clarificationDetails }),
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log clarification creation:", e);
      }

      const fullClarification = await storage.getClarificationById(clarification.id);
      res.json(fullClarification);
    } catch (error) {
      console.error("Error creating clarification:", error);
      res.status(500).json({ message: "Failed to create clarification" });
    }
  });

  // Update clarification
  app.patch('/api/clarifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const validationResult = updateClarificationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;
      
      // Convert date string to Date object if present
      const updateData: any = { ...data };
      if (data.submitDeadlineDate) {
        updateData.submitDeadlineDate = new Date(data.submitDeadlineDate);
      }
      
      const clarification = await storage.updateClarification(id, updateData);
      if (!clarification) {
        return res.status(404).json({ message: "Clarification not found" });
      }

      const fullClarification = await storage.getClarificationById(clarification.id);
      res.json(fullClarification);
    } catch (error) {
      console.error("Error updating clarification:", error);
      res.status(500).json({ message: "Failed to update clarification" });
    }
  });

  // Update clarification stage
  app.patch('/api/clarifications/:id/stage', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user;
      
      // Get the clarification to check authorization
      const existingClarification = await storage.getClarificationById(id);
      if (!existingClarification) {
        return res.status(404).json({ message: "Clarification not found" });
      }
      
      // Authorization: Admin/Manager can always update, assigned user can update their own
      const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
      const isAssigned = user?.teamMemberId && existingClarification.assignedTo === user.teamMemberId;
      
      if (!isAdminOrManager && !isAssigned) {
        return res.status(403).json({ message: "Only admin, manager, or assigned team member can update stage" });
      }
      
      const validationResult = updateClarificationStageSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const { stage, note } = validationResult.data;

      let changedBy = user?.teamMemberId;
      if (!changedBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          changedBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available" });
        }
      }

      const clarification = await storage.updateClarificationStage(id, stage, changedBy, note);
      if (!clarification) {
        return res.status(404).json({ message: "Clarification not found" });
      }

      const fullClarification = await storage.getClarificationById(clarification.id);
      res.json(fullClarification);
    } catch (error) {
      console.error("Error updating clarification stage:", error);
      res.status(500).json({ message: "Failed to update clarification stage" });
    }
  });

  // Submit clarification with file upload
  app.post('/api/clarifications/:id/submit', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user;
      const file = req.file;
      const { stage, note } = req.body;
      
      // Get the clarification to check authorization
      const existingClarification = await storage.getClarificationById(id);
      if (!existingClarification) {
        return res.status(404).json({ message: "Clarification not found" });
      }
      
      // Authorization: Admin/Manager can always submit, assigned user can submit their own
      const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
      const isAssigned = user?.teamMemberId && existingClarification.assignedTo === user.teamMemberId;
      
      if (!isAdminOrManager && !isAssigned) {
        return res.status(403).json({ message: "Only admin, manager, or assigned team member can submit clarification" });
      }
      
      let changedBy = user?.teamMemberId;
      if (!changedBy) {
        const members = await storage.getTeamMembers();
        if (members.length > 0) {
          changedBy = members[0].id;
        } else {
          return res.status(400).json({ message: "No team members available" });
        }
      }

      // Update clarification with file and stage
      const updateData: any = {
        currentStage: stage || 'submitted',
        submittedAt: new Date().toISOString(),
      };
      
      if (file) {
        updateData.submissionFile = file.path;
      }
      
      const clarification = await storage.updateClarification(id, updateData);
      
      // Add history entry
      await storage.updateClarificationStage(id, stage || 'submitted', changedBy, note);

      const fullClarification = await storage.getClarificationById(id);
      res.json(fullClarification);
    } catch (error) {
      console.error("Error submitting clarification:", error);
      res.status(500).json({ message: "Failed to submit clarification" });
    }
  });

  // Delete clarification
  app.delete('/api/clarifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClarification(id);
      res.json({ message: "Clarification deleted successfully" });
    } catch (error) {
      console.error("Error deleting clarification:", error);
      res.status(500).json({ message: "Failed to delete clarification" });
    }
  });

  // ===============================
  // UNIFIED TENDER ACTIVITY OVERVIEW
  // ===============================

  // Get all activities for a tender reference ID
  app.get('/api/tender-activity/:referenceId', isAuthenticated, async (req, res) => {
    try {
      const referenceId = decodeURIComponent(req.params.referenceId);
      const overview = await storage.getTenderActivityOverview(referenceId);
      res.json(overview);
    } catch (error) {
      console.error("Error fetching tender activity overview:", error);
      res.status(500).json({ message: "Failed to fetch tender activity overview" });
    }
  });

  // ===============================
  // MIS REPORTS
  // ===============================

  // Get MIS report for a specific team member
  app.get('/api/mis-report/team-member/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const teamMemberId = parseInt(req.params.id);
      
      // Non-admins can only view their own report
      if (user.role !== 'admin' && user.role !== 'manager' && user.teamMemberId !== teamMemberId) {
        return res.status(403).json({ message: "You can only view your own report" });
      }
      
      // Parse date range from query params (default to last 7 days)
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate)
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      const report = await storage.getMISReportForTeamMember(teamMemberId, startDate, endDate);
      res.json(report);
    } catch (error) {
      console.error("Error fetching MIS report:", error);
      res.status(500).json({ message: "Failed to fetch MIS report" });
    }
  });

  // Get MIS report for current user (my report)
  app.get('/api/mis-report/me', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Parse date range from query params (default to last 7 days)
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate)
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      // If user has a team member record, use that for full report
      if (user.teamMemberId) {
        const report = await storage.getMISReportForTeamMember(user.teamMemberId, startDate, endDate);
        res.json(report);
      } else {
        // For users without team member records (like admin), query by username
        const report = await storage.getMISReportForUser(user.username, user.role, startDate, endDate);
        res.json(report);
      }
    } catch (error) {
      console.error("Error fetching my MIS report:", error);
      res.status(500).json({ message: "Failed to fetch MIS report" });
    }
  });

  // Get MIS report for all team members (admin/manager only)
  app.get('/api/mis-report/all', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ message: "Only admins and managers can view all team reports" });
      }
      
      // Parse date range from query params (default to last 7 days)
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate)
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      const reports = await storage.getMISReportForAllTeamMembers(startDate, endDate);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching all team MIS reports:", error);
      res.status(500).json({ message: "Failed to fetch team MIS reports" });
    }
  });

  // Download MIS report as CSV
  app.get('/api/mis-report/download/:type', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const type = req.params.type; // 'me' or 'all'
      
      // Parse date range from query params (default to last 7 days)
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate)
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      let csvContent = '';
      let filename = '';
      
      if (type === 'me') {
        if (!user.teamMemberId) {
          return res.status(400).json({ message: "No team member associated with this user" });
        }
        
        const report = await storage.getMISReportForTeamMember(user.teamMemberId, startDate, endDate);
        
        // Generate CSV for individual report
        csvContent = 'MIS Report - ' + report.teamMember.fullName + '\n';
        csvContent += 'Period: ' + startDate.toISOString().split('T')[0] + ' to ' + endDate.toISOString().split('T')[0] + '\n\n';
        
        csvContent += 'Summary\n';
        csvContent += 'Metric,Count\n';
        csvContent += 'Tenders Marked Not Relevant,' + report.summary.tendersMarkedNotRelevant + '\n';
        csvContent += 'Tenders Marked Not Eligible,' + report.summary.tendersMarkedNotEligible + '\n';
        csvContent += 'Tenders Assigned,' + report.summary.tendersAssigned + '\n';
        csvContent += 'Tenders Submitted,' + report.summary.tendersSubmitted + '\n';
        csvContent += 'Tenders Reviewed,' + report.summary.tendersReviewed + '\n';
        csvContent += 'Clarifications Created,' + report.summary.clarificationsCreated + '\n';
        csvContent += 'Clarifications Submitted,' + report.summary.clarificationsSubmitted + '\n';
        csvContent += 'Presentations Scheduled,' + report.summary.presentationsScheduled + '\n';
        csvContent += 'Presentations Completed,' + report.summary.presentationsCompleted + '\n';
        csvContent += 'Results Recorded,' + report.summary.resultsRecorded + '\n\n';
        
        csvContent += 'Daily Breakdown\n';
        csvContent += 'Date,Not Relevant,Not Eligible,Assigned,Submitted,Reviewed,Clarifications,Presentations\n';
        report.dailyBreakdown.forEach(day => {
          csvContent += `${day.date},${day.notRelevant},${day.notEligible},${day.assigned},${day.submitted},${day.reviewed},${day.clarifications},${day.presentations}\n`;
        });
        
        filename = `MIS_Report_${report.teamMember.username}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;
      } else if (type === 'all') {
        if (user.role !== 'admin' && user.role !== 'manager') {
          return res.status(403).json({ message: "Only admins and managers can download team reports" });
        }
        
        const reports = await storage.getMISReportForAllTeamMembers(startDate, endDate);
        
        // Generate CSV for all team members
        csvContent = 'Team MIS Report\n';
        csvContent += 'Period: ' + startDate.toISOString().split('T')[0] + ' to ' + endDate.toISOString().split('T')[0] + '\n\n';
        
        csvContent += 'Team Member,Role,Not Relevant,Not Eligible,Assigned,Submitted,Reviewed,Clarifications Created,Clarifications Submitted,Presentations Scheduled,Presentations Completed,Results Recorded,Total Actions\n';
        reports.forEach(r => {
          csvContent += `"${r.teamMemberName}",${r.role},${r.summary.tendersMarkedNotRelevant},${r.summary.tendersMarkedNotEligible},${r.summary.tendersAssigned},${r.summary.tendersSubmitted},${r.summary.tendersReviewed},${r.summary.clarificationsCreated},${r.summary.clarificationsSubmitted},${r.summary.presentationsScheduled},${r.summary.presentationsCompleted},${r.summary.resultsRecorded},${r.summary.totalActions}\n`;
        });
        
        filename = `Team_MIS_Report_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;
      } else {
        return res.status(400).json({ message: "Invalid report type" });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error downloading MIS report:", error);
      res.status(500).json({ message: "Failed to download MIS report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
