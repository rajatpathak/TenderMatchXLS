import {
  users,
  tenders,
  excelUploads,
  companyCriteria,
  corrigendumChanges,
  tenderDocuments,
  negativeKeywords,
  type User,
  type UpsertUser,
  type Tender,
  type InsertTender,
  type ExcelUpload,
  type InsertExcelUpload,
  type CompanyCriteria,
  type InsertCompanyCriteria,
  type CorrigendumChange,
  type InsertCorrigendumChange,
  type TenderDocument,
  type InsertTenderDocument,
  type NegativeKeyword,
  type InsertNegativeKeyword,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tender operations
  getTenders(): Promise<Tender[]>;
  getTenderById(id: number): Promise<Tender | undefined>;
  getTenderByT247Id(t247Id: string): Promise<Tender | undefined>;
  getTendersByStatus(status: string): Promise<Tender[]>;
  getTendersByEligibilityStatus(status: string): Promise<Tender[]>;
  getCorrigendumTenders(): Promise<(Tender & { changes: CorrigendumChange[] })[]>;
  createTender(tender: InsertTender): Promise<Tender>;
  updateTender(id: number, tender: Partial<InsertTender>): Promise<Tender | undefined>;
  updateTenderOverride(id: number, overrideData: {
    overrideStatus: string;
    overrideReason: string;
    overrideComment?: string;
    overrideBy?: string;
  }): Promise<Tender | undefined>;
  
  // Excel upload operations
  getExcelUploads(): Promise<ExcelUpload[]>;
  createExcelUpload(upload: InsertExcelUpload): Promise<ExcelUpload>;
  updateExcelUpload(id: number, upload: Partial<InsertExcelUpload>): Promise<ExcelUpload | undefined>;
  
  // Company criteria operations
  getCompanyCriteria(): Promise<CompanyCriteria | undefined>;
  upsertCompanyCriteria(criteria: InsertCompanyCriteria): Promise<CompanyCriteria>;
  
  // Negative keywords operations
  getNegativeKeywords(): Promise<NegativeKeyword[]>;
  createNegativeKeyword(keyword: InsertNegativeKeyword): Promise<NegativeKeyword>;
  deleteNegativeKeyword(id: number): Promise<void>;
  
  // Corrigendum operations
  createCorrigendumChange(change: InsertCorrigendumChange): Promise<CorrigendumChange>;
  getChangesForTender(tenderId: number): Promise<CorrigendumChange[]>;
  
  // Document operations
  createTenderDocument(doc: InsertTenderDocument): Promise<TenderDocument>;
  getDocumentsForTender(tenderId: number): Promise<TenderDocument[]>;
  updateTenderDocument(id: number, doc: Partial<InsertTenderDocument>): Promise<TenderDocument | undefined>;
  
  // Stats
  getStats(): Promise<{ 
    total: number; 
    eligible: number;
    notRelevant: number;
    notEligible: number; 
    manualReview: number;
    missed: number;
    corrigendum: number;
    todayUploads: number;
  }>;
  
  // Missed deadline operations
  getMissedTenders(): Promise<Tender[]>;
  updateMissedDeadlines(): Promise<{ updated: number; restored: number }>;
  
  // Data management
  deleteAllData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Tender operations
  async getTenders(): Promise<Tender[]> {
    return db.select().from(tenders).orderBy(desc(tenders.matchPercentage), desc(tenders.createdAt));
  }

  async getTenderById(id: number): Promise<Tender | undefined> {
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id));
    return tender;
  }

  async getTenderByT247Id(t247Id: string): Promise<Tender | undefined> {
    const [tender] = await db
      .select()
      .from(tenders)
      .where(and(eq(tenders.t247Id, t247Id), eq(tenders.isCorrigendum, false)))
      .orderBy(desc(tenders.createdAt))
      .limit(1);
    return tender;
  }

  async getTendersByStatus(status: string): Promise<Tender[]> {
    return db
      .select()
      .from(tenders)
      .where(eq(tenders.analysisStatus, status))
      .orderBy(desc(tenders.createdAt));
  }

  async getCorrigendumTenders(): Promise<(Tender & { changes: CorrigendumChange[] })[]> {
    const corrigendumTenders = await db
      .select()
      .from(tenders)
      .where(eq(tenders.isCorrigendum, true))
      .orderBy(desc(tenders.createdAt));
    
    const result = await Promise.all(
      corrigendumTenders.map(async (tender) => {
        const changes = await db
          .select()
          .from(corrigendumChanges)
          .where(eq(corrigendumChanges.tenderId, tender.id));
        return { ...tender, changes };
      })
    );
    
    return result;
  }

  async createTender(tender: InsertTender): Promise<Tender> {
    const [created] = await db.insert(tenders).values(tender).returning();
    return created;
  }

  async updateTender(id: number, tender: Partial<InsertTender>): Promise<Tender | undefined> {
    const [updated] = await db
      .update(tenders)
      .set(tender)
      .where(eq(tenders.id, id))
      .returning();
    return updated;
  }

  async getTendersByEligibilityStatus(status: string): Promise<Tender[]> {
    // Check for manual overrides first, then system status
    // Exclude missed tenders from regular status queries
    return db
      .select()
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, false),
          or(
            // Match override status if manually overridden
            and(eq(tenders.isManualOverride, true), eq(tenders.overrideStatus, status)),
            // Match eligibility status if not overridden
            and(eq(tenders.isManualOverride, false), eq(tenders.eligibilityStatus, status))
          )
        )
      )
      .orderBy(desc(tenders.matchPercentage), desc(tenders.createdAt));
  }

  async updateTenderOverride(id: number, overrideData: {
    overrideStatus: string;
    overrideReason: string;
    overrideComment?: string;
    overrideBy?: string;
  }): Promise<Tender | undefined> {
    const [updated] = await db
      .update(tenders)
      .set({
        isManualOverride: true,
        overrideStatus: overrideData.overrideStatus,
        overrideReason: overrideData.overrideReason,
        overrideComment: overrideData.overrideComment || null,
        overrideBy: overrideData.overrideBy || null,
        overrideAt: new Date(),
      })
      .where(eq(tenders.id, id))
      .returning();
    return updated;
  }

  // Excel upload operations
  async getExcelUploads(): Promise<ExcelUpload[]> {
    return db.select().from(excelUploads).orderBy(desc(excelUploads.uploadedAt));
  }

  async createExcelUpload(upload: InsertExcelUpload): Promise<ExcelUpload> {
    const [created] = await db.insert(excelUploads).values(upload).returning();
    return created;
  }

  async updateExcelUpload(id: number, upload: Partial<InsertExcelUpload>): Promise<ExcelUpload | undefined> {
    const [updated] = await db
      .update(excelUploads)
      .set(upload)
      .where(eq(excelUploads.id, id))
      .returning();
    return updated;
  }

  // Company criteria operations
  async getCompanyCriteria(): Promise<CompanyCriteria | undefined> {
    const [criteria] = await db.select().from(companyCriteria).where(eq(companyCriteria.id, 1));
    return criteria;
  }

  async upsertCompanyCriteria(criteria: InsertCompanyCriteria): Promise<CompanyCriteria> {
    const [result] = await db
      .insert(companyCriteria)
      .values({ ...criteria, id: 1 })
      .onConflictDoUpdate({
        target: companyCriteria.id,
        set: {
          ...criteria,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Negative keywords operations
  async getNegativeKeywords(): Promise<NegativeKeyword[]> {
    return db.select().from(negativeKeywords).orderBy(desc(negativeKeywords.createdAt));
  }

  async createNegativeKeyword(keyword: InsertNegativeKeyword): Promise<NegativeKeyword> {
    const [created] = await db.insert(negativeKeywords).values(keyword).returning();
    return created;
  }

  async deleteNegativeKeyword(id: number): Promise<void> {
    await db.delete(negativeKeywords).where(eq(negativeKeywords.id, id));
  }

  // Corrigendum operations
  async createCorrigendumChange(change: InsertCorrigendumChange): Promise<CorrigendumChange> {
    const [created] = await db.insert(corrigendumChanges).values(change).returning();
    return created;
  }

  async getChangesForTender(tenderId: number): Promise<CorrigendumChange[]> {
    return db.select().from(corrigendumChanges).where(eq(corrigendumChanges.tenderId, tenderId));
  }

  // Document operations
  async createTenderDocument(doc: InsertTenderDocument): Promise<TenderDocument> {
    const [created] = await db.insert(tenderDocuments).values(doc).returning();
    return created;
  }

  async getDocumentsForTender(tenderId: number): Promise<TenderDocument[]> {
    return db.select().from(tenderDocuments).where(eq(tenderDocuments.tenderId, tenderId));
  }

  async updateTenderDocument(id: number, doc: Partial<InsertTenderDocument>): Promise<TenderDocument | undefined> {
    const [updated] = await db
      .update(tenderDocuments)
      .set({ ...doc, processedAt: new Date() })
      .where(eq(tenderDocuments.id, id))
      .returning();
    return updated;
  }

  // Stats
  async getStats(): Promise<{ 
    total: number; 
    eligible: number;
    notRelevant: number;
    notEligible: number; 
    manualReview: number;
    missed: number;
    corrigendum: number;
    todayUploads: number;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders);
    
    // Count eligible tenders (considering manual overrides, excluding missed)
    const [eligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, false),
          or(
            and(eq(tenders.isManualOverride, false), eq(tenders.eligibilityStatus, "eligible")),
            and(eq(tenders.isManualOverride, true), eq(tenders.overrideStatus, "eligible"))
          )
        )
      );
    
    // Count not relevant tenders (excluding missed)
    const [notRelevantResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, false),
          or(
            and(eq(tenders.isManualOverride, false), eq(tenders.eligibilityStatus, "not_relevant")),
            and(eq(tenders.isManualOverride, true), eq(tenders.overrideStatus, "not_relevant"))
          )
        )
      );
    
    // Count not eligible tenders (excluding missed)
    const [notEligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, false),
          or(
            and(eq(tenders.isManualOverride, false), eq(tenders.eligibilityStatus, "not_eligible")),
            and(eq(tenders.isManualOverride, true), eq(tenders.overrideStatus, "not_eligible"))
          )
        )
      );
    
    // Count manual review tenders (excluding missed)
    const [manualReviewResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, false),
          eq(tenders.eligibilityStatus, "manual_review")
        )
      );
    
    // Count missed tenders
    const [missedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(eq(tenders.isMissed, true));
    
    // Count corrigendum tenders
    const [corrigendumResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(eq(tenders.isCorrigendum, true));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todayResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(excelUploads)
      .where(sql`${excelUploads.uploadedAt} >= ${today}`);
    
    return {
      total: Number(totalResult?.count || 0),
      eligible: Number(eligibleResult?.count || 0),
      notRelevant: Number(notRelevantResult?.count || 0),
      notEligible: Number(notEligibleResult?.count || 0),
      manualReview: Number(manualReviewResult?.count || 0),
      missed: Number(missedResult?.count || 0),
      corrigendum: Number(corrigendumResult?.count || 0),
      todayUploads: Number(todayResult?.count || 0),
    };
  }

  // Missed deadline operations
  async getMissedTenders(): Promise<Tender[]> {
    return db
      .select()
      .from(tenders)
      .where(eq(tenders.isMissed, true))
      .orderBy(desc(tenders.submissionDeadline));
  }

  async updateMissedDeadlines(): Promise<{ updated: number; restored: number }> {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    let updated = 0;
    let restored = 0;
    
    // Find all tenders where deadline has passed but not marked as missed
    const passedDeadline = await db
      .select()
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, false),
          sql`${tenders.submissionDeadline} IS NOT NULL`,
          sql`${tenders.submissionDeadline} < ${now}`
        )
      );
    
    for (const tender of passedDeadline) {
      // Get effective status (override or eligibility)
      const currentStatus = tender.isManualOverride ? tender.overrideStatus : tender.eligibilityStatus;
      
      await db
        .update(tenders)
        .set({
          isMissed: true,
          previousEligibilityStatus: currentStatus,
          missedAt: new Date(),
        })
        .where(eq(tenders.id, tender.id));
      updated++;
    }
    
    // Find tenders marked as missed but with a future deadline (deadline was updated)
    const futureDeadline = await db
      .select()
      .from(tenders)
      .where(
        and(
          eq(tenders.isMissed, true),
          sql`${tenders.submissionDeadline} IS NOT NULL`,
          sql`${tenders.submissionDeadline} >= ${now}`
        )
      );
    
    for (const tender of futureDeadline) {
      await db
        .update(tenders)
        .set({
          isMissed: false,
          missedAt: null,
          // Keep previousEligibilityStatus for reference
        })
        .where(eq(tenders.id, tender.id));
      restored++;
    }
    
    return { updated, restored };
  }

  // Data management
  async deleteAllData(): Promise<void> {
    // Delete in order to respect foreign key constraints
    await db.delete(corrigendumChanges);
    await db.delete(tenderDocuments);
    await db.delete(tenders);
    await db.delete(excelUploads);
    // Note: We keep negative keywords and company criteria as they are settings
  }
}

export const storage = new DatabaseStorage();
