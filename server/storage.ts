import {
  users,
  tenders,
  excelUploads,
  companyCriteria,
  corrigendumChanges,
  tenderDocuments,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tender operations
  getTenders(): Promise<Tender[]>;
  getTenderById(id: number): Promise<Tender | undefined>;
  getTenderByT247Id(t247Id: string): Promise<Tender | undefined>;
  getTendersByStatus(status: string): Promise<Tender[]>;
  getCorrigendumTenders(): Promise<(Tender & { changes: CorrigendumChange[] })[]>;
  createTender(tender: InsertTender): Promise<Tender>;
  updateTender(id: number, tender: Partial<InsertTender>): Promise<Tender | undefined>;
  
  // Excel upload operations
  getExcelUploads(): Promise<ExcelUpload[]>;
  createExcelUpload(upload: InsertExcelUpload): Promise<ExcelUpload>;
  updateExcelUpload(id: number, upload: Partial<InsertExcelUpload>): Promise<ExcelUpload | undefined>;
  
  // Company criteria operations
  getCompanyCriteria(): Promise<CompanyCriteria | undefined>;
  upsertCompanyCriteria(criteria: InsertCompanyCriteria): Promise<CompanyCriteria>;
  
  // Corrigendum operations
  createCorrigendumChange(change: InsertCorrigendumChange): Promise<CorrigendumChange>;
  getChangesForTender(tenderId: number): Promise<CorrigendumChange[]>;
  
  // Document operations
  createTenderDocument(doc: InsertTenderDocument): Promise<TenderDocument>;
  getDocumentsForTender(tenderId: number): Promise<TenderDocument[]>;
  updateTenderDocument(id: number, doc: Partial<InsertTenderDocument>): Promise<TenderDocument | undefined>;
  
  // Stats
  getStats(): Promise<{ total: number; fullMatch: number; pendingAnalysis: number; todayUploads: number }>;
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
  async getStats(): Promise<{ total: number; fullMatch: number; pendingAnalysis: number; notEligible: number; todayUploads: number }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders);
    
    const [fullMatchResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(eq(tenders.matchPercentage, 100));
    
    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(eq(tenders.analysisStatus, "unable_to_analyze"));
    
    const [notEligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(eq(tenders.analysisStatus, "not_eligible"));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todayResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(excelUploads)
      .where(sql`${excelUploads.uploadedAt} >= ${today}`);
    
    return {
      total: Number(totalResult?.count || 0),
      fullMatch: Number(fullMatchResult?.count || 0),
      pendingAnalysis: Number(pendingResult?.count || 0),
      notEligible: Number(notEligibleResult?.count || 0),
      todayUploads: Number(todayResult?.count || 0),
    };
  }
}

export const storage = new DatabaseStorage();
