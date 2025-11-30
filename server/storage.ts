import {
  users,
  tenders,
  excelUploads,
  companyCriteria,
  corrigendumChanges,
  tenderDocuments,
  negativeKeywords,
  teamMembers,
  tenderAssignments,
  biddingSubmissions,
  workflowHistory,
  auditLogs,
  tenderResults,
  tenderResultHistory,
  presentations,
  presentationHistory,
  clarifications,
  clarificationHistory,
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
  type TeamMember,
  type InsertTeamMember,
  type TenderAssignment,
  type InsertTenderAssignment,
  type BiddingSubmission,
  type InsertBiddingSubmission,
  type WorkflowHistory,
  type InsertWorkflowHistory,
  type AuditLog,
  type InsertAuditLog,
  type TenderResult,
  type InsertTenderResult,
  type TenderResultHistory,
  type InsertTenderResultHistory,
  type TenderResultWithHistory,
  type Presentation,
  type InsertPresentation,
  type PresentationHistory,
  type InsertPresentationHistory,
  type PresentationWithDetails,
  type Clarification,
  type InsertClarification,
  type ClarificationHistory,
  type InsertClarificationHistory,
  type ClarificationWithDetails,
  type TenderActivityOverview,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, gte, lt } from "drizzle-orm";

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
  
  // Get unique locations
  getUniqueLocations(): Promise<string[]>;
  
  // Missed deadline operations
  getMissedTenders(): Promise<Tender[]>;
  updateMissedDeadlines(): Promise<{ updated: number; restored: number }>;
  
  // Data management
  deleteAllData(): Promise<void>;
  cleanupDuplicateTenders(): Promise<{ duplicatesRemoved: number; tenderIdsAffected: string[] }>;
  
  // Team member operations
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMemberById(id: number): Promise<TeamMember | undefined>;
  getTeamMemberByUsername(username: string): Promise<TeamMember | undefined>;
  getTeamMemberByEmail(email: string): Promise<TeamMember | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: number, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: number): Promise<void>;
  updateTeamMemberLastLogin(id: number): Promise<void>;
  
  // Tender assignment operations
  getTenderAssignments(): Promise<(TenderAssignment & { tender?: Tender; assignee?: TeamMember; assigner?: TeamMember })[]>;
  getAssignmentByTenderId(tenderId: number): Promise<TenderAssignment | undefined>;
  getAssignmentsByUserId(userId: number): Promise<(TenderAssignment & { tender?: Tender })[]>;
  createTenderAssignment(assignment: InsertTenderAssignment): Promise<TenderAssignment>;
  updateTenderAssignment(id: number, assignment: Partial<InsertTenderAssignment>): Promise<TenderAssignment | undefined>;
  updateAssignmentStage(id: number, stage: string, changedBy: number, note?: string): Promise<TenderAssignment | undefined>;
  deleteTenderAssignment(id: number): Promise<void>;
  
  // Bidding submission operations
  getBiddingSubmissions(): Promise<(BiddingSubmission & { tender?: Tender; assignment?: TenderAssignment; submitter?: TeamMember })[]>;
  createBiddingSubmission(submission: InsertBiddingSubmission): Promise<BiddingSubmission>;
  
  // Workflow history operations
  getWorkflowHistory(assignmentId: number): Promise<WorkflowHistory[]>;
  createWorkflowHistory(history: InsertWorkflowHistory): Promise<WorkflowHistory>;
  
  // Workflow stats
  getWorkflowStats(): Promise<{ 
    assigned: number; 
    inProgress: number; 
    readyForReview: number; 
    submitted: number;
    totalBudget: number;
  }>;
  
  // Audit log operations
  getAuditLogs(filters?: { category?: string; action?: string; limit?: number }): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Tender result operations
  getTenderResults(): Promise<TenderResultWithHistory[]>;
  getTenderResultById(id: number): Promise<TenderResultWithHistory | undefined>;
  getTenderResultByReferenceId(referenceId: string): Promise<TenderResultWithHistory | undefined>;
  createTenderResult(result: InsertTenderResult): Promise<TenderResult>;
  updateTenderResultStatus(id: number, status: string, updatedBy: number, note?: string): Promise<TenderResult | undefined>;
  getTenderResultHistory(tenderResultId: number): Promise<TenderResultHistory[]>;
  searchTenderReferences(query: string): Promise<{ referenceId: string; title?: string; tenderId?: number }[]>;
  
  // Presentation operations
  getPresentations(): Promise<PresentationWithDetails[]>;
  getPresentationById(id: number): Promise<PresentationWithDetails | undefined>;
  getPresentationsByReferenceId(referenceId: string): Promise<PresentationWithDetails[]>;
  createPresentation(presentation: InsertPresentation): Promise<Presentation>;
  updatePresentation(id: number, presentation: Partial<InsertPresentation>): Promise<Presentation | undefined>;
  updatePresentationStatus(id: number, status: string, changedBy: number, note?: string): Promise<Presentation | undefined>;
  uploadPresentationFile(id: number, filePath: string, changedBy: number): Promise<Presentation | undefined>;
  deletePresentation(id: number): Promise<void>;
  getTodaysPresentationsForUser(userId: number, isAdmin: boolean): Promise<PresentationWithDetails[]>;
  
  // Clarification operations
  getClarifications(): Promise<ClarificationWithDetails[]>;
  getClarificationById(id: number): Promise<ClarificationWithDetails | undefined>;
  getClarificationsByReferenceId(referenceId: string): Promise<ClarificationWithDetails[]>;
  createClarification(clarification: InsertClarification): Promise<Clarification>;
  updateClarification(id: number, clarification: Partial<InsertClarification>): Promise<Clarification | undefined>;
  updateClarificationStage(id: number, stage: string, changedBy: number, note?: string): Promise<Clarification | undefined>;
  deleteClarification(id: number): Promise<void>;
  getTodaysClarificationsForUser(userId: number, isAdmin: boolean): Promise<ClarificationWithDetails[]>;
  
  // Unified tender activity overview
  getTenderActivityOverview(referenceId: string): Promise<TenderActivityOverview | undefined>;
  
  // MIS Report operations
  getMISReportForTeamMember(teamMemberId: number, startDate: Date, endDate: Date): Promise<{
    teamMember: TeamMember;
    summary: {
      tendersMarkedNotRelevant: number;
      tendersMarkedNotEligible: number;
      tendersAssigned: number;
      tendersSubmitted: number;
      tendersReviewed: number;
      clarificationsCreated: number;
      clarificationsSubmitted: number;
      presentationsScheduled: number;
      presentationsCompleted: number;
      resultsRecorded: number;
      resultsL1: number;
      resultsAwarded: number;
      resultsLost: number;
      resultsCancelled: number;
      winRatio: number;
    };
    dailyBreakdown: {
      date: string;
      notRelevant: number;
      notEligible: number;
      assigned: number;
      submitted: number;
      reviewed: number;
      clarifications: number;
      presentations: number;
      l1: number;
      awarded: number;
      notRelevantIds: string[];
      notEligibleIds: string[];
      assignedIds: string[];
      submittedIds: string[];
      reviewedIds: string[];
      clarificationIds: string[];
      presentationIds: string[];
      l1Ids: string[];
      awardedIds: string[];
    }[];
  }>;
  
  getMISReportForAllTeamMembers(startDate: Date, endDate: Date): Promise<{
    teamMemberId: number;
    teamMemberName: string;
    role: string;
    summary: {
      tendersMarkedNotRelevant: number;
      tendersMarkedNotEligible: number;
      tendersAssigned: number;
      tendersSubmitted: number;
      tendersReviewed: number;
      clarificationsCreated: number;
      clarificationsSubmitted: number;
      presentationsScheduled: number;
      presentationsCompleted: number;
      resultsRecorded: number;
      resultsL1: number;
      resultsAwarded: number;
      resultsLost: number;
      resultsCancelled: number;
      winRatio: number;
      totalActions: number;
    };
  }[]>;
  
  getMISReportForUser(username: string, role: string, startDate: Date, endDate: Date): Promise<{
    user: { username: string; role: string };
    summary: {
      tendersMarkedNotRelevant: number;
      tendersMarkedNotEligible: number;
      tendersAssigned: number;
      tendersSubmitted: number;
      tendersReviewed: number;
      clarificationsCreated: number;
      clarificationsSubmitted: number;
      presentationsScheduled: number;
      presentationsCompleted: number;
      resultsRecorded: number;
      resultsL1: number;
      resultsAwarded: number;
      resultsLost: number;
      resultsCancelled: number;
      winRatio: number;
    };
    dailyBreakdown: {
      date: string;
      notRelevant: number;
      notEligible: number;
      assigned: number;
      submitted: number;
      reviewed: number;
      clarifications: number;
      presentations: number;
      l1: number;
      awarded: number;
      notRelevantIds: string[];
      notEligibleIds: string[];
      assignedIds: string[];
      submittedIds: string[];
      reviewedIds: string[];
      clarificationIds: string[];
      presentationIds: string[];
      l1Ids: string[];
      awardedIds: string[];
    }[];
  }>;
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
    // Get the most recent tender with this T247 ID (regardless of corrigendum status)
    const [tender] = await db
      .select()
      .from(tenders)
      .where(eq(tenders.t247Id, t247Id))
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

  // Get unique locations
  async getUniqueLocations(): Promise<string[]> {
    const results = await db
      .selectDistinct({ location: tenders.location })
      .from(tenders)
      .where(sql`${tenders.location} IS NOT NULL AND ${tenders.location} != ''`)
      .orderBy(tenders.location);
    return results
      .map(r => r.location)
      .filter((loc): loc is string => loc !== null && loc !== undefined)
      .sort();
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
    // Delete in order to respect foreign key constraints (children first, then parents)
    await db.delete(workflowHistory);
    await db.delete(biddingSubmissions);
    await db.delete(tenderAssignments);
    await db.delete(corrigendumChanges);
    await db.delete(tenderDocuments);
    await db.delete(tenders);
    await db.delete(excelUploads);
    // Note: We keep negative keywords and company criteria as they are settings
  }
  
  // Cleanup duplicate tenders by T247 ID (keep the most recent one)
  async cleanupDuplicateTenders(): Promise<{ duplicatesRemoved: number; tenderIdsAffected: string[] }> {
    // First, find all duplicate T247 IDs
    const duplicates = await db
      .select({
        t247Id: tenders.t247Id,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(tenders)
      .groupBy(tenders.t247Id)
      .having(sql`COUNT(*) > 1`);
    
    let duplicatesRemoved = 0;
    const tenderIdsAffected: string[] = [];
    
    for (const dup of duplicates) {
      // Get all tenders with this T247 ID, ordered by createdAt desc
      const tendersWithId = await db
        .select()
        .from(tenders)
        .where(eq(tenders.t247Id, dup.t247Id))
        .orderBy(desc(tenders.createdAt));
      
      // Keep the first (most recent) one, delete the rest
      for (let i = 1; i < tendersWithId.length; i++) {
        const oldTender = tendersWithId[i];
        
        // Delete related corrigendum changes first (both tenderId and originalTenderId)
        await db.delete(corrigendumChanges).where(eq(corrigendumChanges.tenderId, oldTender.id));
        await db.delete(corrigendumChanges).where(eq(corrigendumChanges.originalTenderId, oldTender.id));
        
        // Delete related documents
        await db.delete(tenderDocuments).where(eq(tenderDocuments.tenderId, oldTender.id));
        
        // Delete the tender
        await db.delete(tenders).where(eq(tenders.id, oldTender.id));
        duplicatesRemoved++;
      }
      
      tenderIdsAffected.push(dup.t247Id);
      
      // Mark the remaining tender as corrigendum if there were duplicates
      if (tendersWithId.length > 1) {
        await db
          .update(tenders)
          .set({ isCorrigendum: true })
          .where(eq(tenders.id, tendersWithId[0].id));
      }
    }
    
    return { duplicatesRemoved, tenderIdsAffected };
  }

  // Team member operations
  async getTeamMembers(): Promise<TeamMember[]> {
    return db.select().from(teamMembers).orderBy(desc(teamMembers.createdAt));
  }

  async getTeamMemberById(id: number): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return member;
  }

  async getTeamMemberByUsername(username: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.username, username));
    return member;
  }

  async getTeamMemberByEmail(email: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.email, email));
    return member;
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async updateTeamMember(id: number, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [updated] = await db
      .update(teamMembers)
      .set(member)
      .where(eq(teamMembers.id, id))
      .returning();
    return updated;
  }

  async deleteTeamMember(id: number): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  async updateTeamMemberLastLogin(id: number): Promise<void> {
    await db
      .update(teamMembers)
      .set({ lastLoginAt: new Date() })
      .where(eq(teamMembers.id, id));
  }

  // Tender assignment operations
  async getTenderAssignments(): Promise<(TenderAssignment & { tender?: Tender; assignee?: TeamMember; assigner?: TeamMember })[]> {
    const assignments = await db
      .select()
      .from(tenderAssignments)
      .where(eq(tenderAssignments.isActive, true))
      .orderBy(desc(tenderAssignments.assignedAt));
    
    const result = await Promise.all(
      assignments.map(async (assignment) => {
        const [tender] = await db.select().from(tenders).where(eq(tenders.id, assignment.tenderId));
        const [assignee] = await db.select().from(teamMembers).where(eq(teamMembers.id, assignment.assignedTo));
        const [assigner] = await db.select().from(teamMembers).where(eq(teamMembers.id, assignment.assignedBy));
        return { ...assignment, tender, assignee, assigner };
      })
    );
    
    return result;
  }

  async getAssignmentByTenderId(tenderId: number): Promise<TenderAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(tenderAssignments)
      .where(and(eq(tenderAssignments.tenderId, tenderId), eq(tenderAssignments.isActive, true)));
    return assignment;
  }

  async getAssignmentsByUserId(userId: number): Promise<(TenderAssignment & { tender?: Tender })[]> {
    const assignments = await db
      .select()
      .from(tenderAssignments)
      .where(and(eq(tenderAssignments.assignedTo, userId), eq(tenderAssignments.isActive, true)))
      .orderBy(desc(tenderAssignments.assignedAt));
    
    const result = await Promise.all(
      assignments.map(async (assignment) => {
        const [tender] = await db.select().from(tenders).where(eq(tenders.id, assignment.tenderId));
        return { ...assignment, tender };
      })
    );
    
    return result;
  }

  async createTenderAssignment(assignment: InsertTenderAssignment): Promise<TenderAssignment> {
    // Deactivate any existing assignment for this tender
    await db
      .update(tenderAssignments)
      .set({ isActive: false })
      .where(eq(tenderAssignments.tenderId, assignment.tenderId));
    
    const [created] = await db.insert(tenderAssignments).values(assignment).returning();
    return created;
  }

  async updateTenderAssignment(id: number, assignment: Partial<InsertTenderAssignment>): Promise<TenderAssignment | undefined> {
    const [updated] = await db
      .update(tenderAssignments)
      .set(assignment)
      .where(eq(tenderAssignments.id, id))
      .returning();
    return updated;
  }

  async updateAssignmentStage(id: number, stage: string, changedBy: number, note?: string): Promise<TenderAssignment | undefined> {
    const [assignment] = await db.select().from(tenderAssignments).where(eq(tenderAssignments.id, id));
    if (!assignment) return undefined;
    
    // Record history
    await db.insert(workflowHistory).values({
      assignmentId: id,
      fromStage: assignment.currentStage,
      toStage: stage,
      changedBy,
      note,
    });
    
    // Update assignment
    const [updated] = await db
      .update(tenderAssignments)
      .set({ currentStage: stage, stageUpdatedAt: new Date() })
      .where(eq(tenderAssignments.id, id))
      .returning();
    
    return updated;
  }

  async deleteTenderAssignment(id: number): Promise<void> {
    await db.update(tenderAssignments).set({ isActive: false }).where(eq(tenderAssignments.id, id));
  }

  // Bidding submission operations
  async getBiddingSubmissions(): Promise<(BiddingSubmission & { tender?: Tender; assignment?: TenderAssignment; submitter?: TeamMember })[]> {
    const submissions = await db
      .select()
      .from(biddingSubmissions)
      .orderBy(desc(biddingSubmissions.submissionDate));
    
    const result = await Promise.all(
      submissions.map(async (submission) => {
        const [tender] = await db.select().from(tenders).where(eq(tenders.id, submission.tenderId));
        const [assignment] = await db.select().from(tenderAssignments).where(eq(tenderAssignments.id, submission.assignmentId));
        const [submitter] = await db.select().from(teamMembers).where(eq(teamMembers.id, submission.submittedBy));
        return { ...submission, tender, assignment, submitter };
      })
    );
    
    return result;
  }

  async createBiddingSubmission(submission: InsertBiddingSubmission): Promise<BiddingSubmission> {
    const [created] = await db.insert(biddingSubmissions).values(submission).returning();
    
    // Update the assignment stage to 'submitted'
    await db
      .update(tenderAssignments)
      .set({ currentStage: 'submitted', stageUpdatedAt: new Date() })
      .where(eq(tenderAssignments.id, submission.assignmentId));
    
    return created;
  }

  // Workflow history operations
  async getWorkflowHistory(assignmentId: number): Promise<WorkflowHistory[]> {
    return db
      .select()
      .from(workflowHistory)
      .where(eq(workflowHistory.assignmentId, assignmentId))
      .orderBy(desc(workflowHistory.createdAt));
  }

  async createWorkflowHistory(history: InsertWorkflowHistory): Promise<WorkflowHistory> {
    const [created] = await db.insert(workflowHistory).values(history).returning();
    return created;
  }

  // Workflow stats
  async getWorkflowStats(): Promise<{ 
    assigned: number; 
    inProgress: number; 
    readyForReview: number; 
    submitted: number;
    totalBudget: number;
  }> {
    const [assignedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderAssignments)
      .where(and(eq(tenderAssignments.isActive, true), eq(tenderAssignments.currentStage, 'assigned')));
    
    const [inProgressResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderAssignments)
      .where(and(eq(tenderAssignments.isActive, true), eq(tenderAssignments.currentStage, 'in_progress')));
    
    const [readyForReviewResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderAssignments)
      .where(and(eq(tenderAssignments.isActive, true), eq(tenderAssignments.currentStage, 'ready_for_review')));
    
    const [submittedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderAssignments)
      .where(and(eq(tenderAssignments.isActive, true), eq(tenderAssignments.currentStage, 'submitted')));
    
    const [budgetResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(submitted_budget), 0)` })
      .from(biddingSubmissions);
    
    return {
      assigned: Number(assignedResult?.count || 0),
      inProgress: Number(inProgressResult?.count || 0),
      readyForReview: Number(readyForReviewResult?.count || 0),
      submitted: Number(submittedResult?.count || 0),
      totalBudget: Number(budgetResult?.total || 0),
    };
  }

  // Audit log operations
  async getAuditLogs(filters?: { category?: string; action?: string; limit?: number }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(auditLogs.category, filters.category));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const result = await query.orderBy(desc(auditLogs.createdAt)).limit(filters?.limit || 100);
    return result;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Tender result operations
  async getTenderResults(): Promise<TenderResultWithHistory[]> {
    const results = await db
      .select()
      .from(tenderResults)
      .orderBy(desc(tenderResults.updatedAt));
    
    const enriched = await Promise.all(
      results.map(async (result) => {
        const history = await db
          .select()
          .from(tenderResultHistory)
          .where(eq(tenderResultHistory.tenderResultId, result.id))
          .orderBy(desc(tenderResultHistory.timestamp));
        
        const historyWithMembers = await Promise.all(
          history.map(async (h) => {
            const [member] = await db
              .select()
              .from(teamMembers)
              .where(eq(teamMembers.id, h.updatedBy));
            return { ...h, updatedByMember: member };
          })
        );
        
        const [updatedByMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, result.updatedBy));
        
        let tender: Tender | undefined;
        if (result.tenderId) {
          const [t] = await db
            .select()
            .from(tenders)
            .where(eq(tenders.id, result.tenderId));
          tender = t;
        }
        
        return {
          ...result,
          history: historyWithMembers,
          updatedByMember,
          tender,
        };
      })
    );
    
    return enriched;
  }

  async getTenderResultById(id: number): Promise<TenderResultWithHistory | undefined> {
    const [result] = await db
      .select()
      .from(tenderResults)
      .where(eq(tenderResults.id, id));
    
    if (!result) return undefined;
    
    const history = await db
      .select()
      .from(tenderResultHistory)
      .where(eq(tenderResultHistory.tenderResultId, result.id))
      .orderBy(desc(tenderResultHistory.timestamp));
    
    const historyWithMembers = await Promise.all(
      history.map(async (h) => {
        const [member] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, h.updatedBy));
        return { ...h, updatedByMember: member };
      })
    );
    
    const [updatedByMember] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, result.updatedBy));
    
    let tender: Tender | undefined;
    if (result.tenderId) {
      const [t] = await db
        .select()
        .from(tenders)
        .where(eq(tenders.id, result.tenderId));
      tender = t;
    }
    
    return {
      ...result,
      history: historyWithMembers,
      updatedByMember,
      tender,
    };
  }

  async getTenderResultByReferenceId(referenceId: string): Promise<TenderResultWithHistory | undefined> {
    const [result] = await db
      .select()
      .from(tenderResults)
      .where(eq(tenderResults.referenceId, referenceId));
    
    if (!result) return undefined;
    
    return this.getTenderResultById(result.id);
  }

  async createTenderResult(result: InsertTenderResult): Promise<TenderResult> {
    const [created] = await db.insert(tenderResults).values(result).returning();
    
    // Create initial history entry
    await db.insert(tenderResultHistory).values({
      tenderResultId: created.id,
      status: result.currentStatus,
      updatedBy: result.updatedBy,
    });
    
    return created;
  }

  async updateTenderResultStatus(id: number, status: string, updatedBy: number, note?: string): Promise<TenderResult | undefined> {
    const [updated] = await db
      .update(tenderResults)
      .set({ 
        currentStatus: status, 
        updatedBy, 
        updatedAt: new Date() 
      })
      .where(eq(tenderResults.id, id))
      .returning();
    
    if (!updated) return undefined;
    
    // Create history entry for this status change
    await db.insert(tenderResultHistory).values({
      tenderResultId: id,
      status,
      updatedBy,
      note,
    });
    
    return updated;
  }

  async getTenderResultHistory(tenderResultId: number): Promise<TenderResultHistory[]> {
    return db
      .select()
      .from(tenderResultHistory)
      .where(eq(tenderResultHistory.tenderResultId, tenderResultId))
      .orderBy(desc(tenderResultHistory.timestamp));
  }

  async searchTenderReferences(query: string): Promise<{ referenceId: string; title?: string; tenderId?: number }[]> {
    if (!query || query.length < 2) return [];
    
    // Search in existing tenders by t247Id OR title (including GEM reference in title)
    const matchingTenders = await db
      .select({
        t247Id: tenders.t247Id,
        title: tenders.title,
        tenderId: tenders.id,
      })
      .from(tenders)
      .where(or(
        sql`${tenders.t247Id} ILIKE ${'%' + query + '%'}`,
        sql`${tenders.title} ILIKE ${'%' + query + '%'}`
      ))
      .limit(15);
    
    // Extract Tender ID from title if present (any text inside first brackets)
    return matchingTenders.map(t => {
      let tenderId = t.t247Id;
      const title = t.title || '';
      
      // Try to extract Tender ID from title brackets - matches [anything] at the start
      const bracketMatch = title.match(/^\s*\[?\s*:?\s*([^\]]+)\s*\]/);
      if (bracketMatch) {
        tenderId = bracketMatch[1].trim();
      }
      
      return {
        referenceId: tenderId,
        title: title || undefined,
        tenderId: t.tenderId,
      };
    });
  }

  // ===============================
  // PRESENTATION OPERATIONS
  // ===============================
  
  async getPresentations(): Promise<PresentationWithDetails[]> {
    const results = await db
      .select()
      .from(presentations)
      .orderBy(desc(presentations.scheduledDate));
    
    return Promise.all(results.map(async (p) => this.enrichPresentation(p)));
  }

  async getPresentationById(id: number): Promise<PresentationWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(presentations)
      .where(eq(presentations.id, id));
    
    if (!result) return undefined;
    return this.enrichPresentation(result);
  }

  async getPresentationsByReferenceId(referenceId: string): Promise<PresentationWithDetails[]> {
    const results = await db
      .select()
      .from(presentations)
      .where(eq(presentations.referenceId, referenceId))
      .orderBy(desc(presentations.scheduledDate));
    
    return Promise.all(results.map(async (p) => this.enrichPresentation(p)));
  }

  private async enrichPresentation(p: Presentation): Promise<PresentationWithDetails> {
    const [assignee] = await db.select().from(teamMembers).where(eq(teamMembers.id, p.assignedTo));
    const [creator] = await db.select().from(teamMembers).where(eq(teamMembers.id, p.createdBy));
    
    let tender: Tender | undefined;
    if (p.tenderId) {
      const [t] = await db.select().from(tenders).where(eq(tenders.id, p.tenderId));
      tender = t;
    }
    
    const history = await db
      .select()
      .from(presentationHistory)
      .where(eq(presentationHistory.presentationId, p.id))
      .orderBy(desc(presentationHistory.timestamp));
    
    const historyWithMembers = await Promise.all(
      history.map(async (h) => {
        const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, h.changedBy));
        return { ...h, changedByMember: member };
      })
    );
    
    return {
      ...p,
      assignee,
      creator,
      tender,
      history: historyWithMembers,
    };
  }

  async createPresentation(presentation: InsertPresentation): Promise<Presentation> {
    const [created] = await db.insert(presentations).values(presentation).returning();
    
    // Create initial history entry
    await db.insert(presentationHistory).values({
      presentationId: created.id,
      action: 'created',
      newStatus: 'scheduled',
      changedBy: presentation.createdBy,
    });
    
    return created;
  }

  async updatePresentation(id: number, presentation: Partial<InsertPresentation>): Promise<Presentation | undefined> {
    const [updated] = await db
      .update(presentations)
      .set({ ...presentation, updatedAt: new Date() })
      .where(eq(presentations.id, id))
      .returning();
    
    return updated;
  }

  async updatePresentationStatus(id: number, status: string, changedBy: number, note?: string): Promise<Presentation | undefined> {
    const [existing] = await db.select().from(presentations).where(eq(presentations.id, id));
    if (!existing) return undefined;
    
    const [updated] = await db
      .update(presentations)
      .set({ status, updatedAt: new Date() })
      .where(eq(presentations.id, id))
      .returning();
    
    // Create history entry
    await db.insert(presentationHistory).values({
      presentationId: id,
      action: 'status_changed',
      previousStatus: existing.status,
      newStatus: status,
      changedBy,
      note,
    });
    
    return updated;
  }

  async uploadPresentationFile(id: number, filePath: string, changedBy: number): Promise<Presentation | undefined> {
    const [updated] = await db
      .update(presentations)
      .set({ 
        presentationFile: filePath, 
        presentationUploadedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(presentations.id, id))
      .returning();
    
    if (updated) {
      await db.insert(presentationHistory).values({
        presentationId: id,
        action: 'file_uploaded',
        changedBy,
        note: `Uploaded file: ${filePath}`,
      });
    }
    
    return updated;
  }

  async deletePresentation(id: number): Promise<void> {
    await db.delete(presentationHistory).where(eq(presentationHistory.presentationId, id));
    await db.delete(presentations).where(eq(presentations.id, id));
  }

  async getTodaysPresentationsForUser(userId: number, isAdmin: boolean): Promise<PresentationWithDetails[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get all presentations scheduled for today
    const results = await db
      .select()
      .from(presentations)
      .where(
        and(
          gte(presentations.scheduledDate, today),
          lt(presentations.scheduledDate, tomorrow),
          eq(presentations.status, 'scheduled')
        )
      )
      .orderBy(presentations.scheduledTime);
    
    // Filter by user access: admin sees all, regular users see only their assigned ones
    const filteredResults = isAdmin 
      ? results 
      : results.filter(p => p.assignedTo === userId);
    
    return Promise.all(filteredResults.map(async (p) => this.enrichPresentation(p)));
  }

  // ===============================
  // CLARIFICATION OPERATIONS
  // ===============================
  
  async getClarifications(): Promise<ClarificationWithDetails[]> {
    const results = await db
      .select()
      .from(clarifications)
      .orderBy(desc(clarifications.createdAt));
    
    return Promise.all(results.map(async (c) => this.enrichClarification(c)));
  }

  async getClarificationById(id: number): Promise<ClarificationWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(clarifications)
      .where(eq(clarifications.id, id));
    
    if (!result) return undefined;
    return this.enrichClarification(result);
  }

  async getClarificationsByReferenceId(referenceId: string): Promise<ClarificationWithDetails[]> {
    const results = await db
      .select()
      .from(clarifications)
      .where(eq(clarifications.referenceId, referenceId))
      .orderBy(desc(clarifications.createdAt));
    
    return Promise.all(results.map(async (c) => this.enrichClarification(c)));
  }

  private async enrichClarification(c: Clarification): Promise<ClarificationWithDetails> {
    const [assignee] = await db.select().from(teamMembers).where(eq(teamMembers.id, c.assignedTo));
    const [creator] = await db.select().from(teamMembers).where(eq(teamMembers.id, c.createdBy));
    
    let tender: Tender | undefined;
    if (c.tenderId) {
      const [t] = await db.select().from(tenders).where(eq(tenders.id, c.tenderId));
      tender = t;
    }
    
    const history = await db
      .select()
      .from(clarificationHistory)
      .where(eq(clarificationHistory.clarificationId, c.id))
      .orderBy(desc(clarificationHistory.timestamp));
    
    const historyWithMembers = await Promise.all(
      history.map(async (h) => {
        const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, h.changedBy));
        return { ...h, changedByMember: member };
      })
    );
    
    return {
      ...c,
      assignee,
      creator,
      tender,
      history: historyWithMembers,
    };
  }

  async createClarification(clarification: InsertClarification): Promise<Clarification> {
    const [created] = await db.insert(clarifications).values(clarification).returning();
    
    // Create initial history entry
    await db.insert(clarificationHistory).values({
      clarificationId: created.id,
      toStage: 'pending',
      changedBy: clarification.createdBy,
    });
    
    return created;
  }

  async updateClarification(id: number, clarification: Partial<InsertClarification>): Promise<Clarification | undefined> {
    const [updated] = await db
      .update(clarifications)
      .set({ ...clarification, updatedAt: new Date() })
      .where(eq(clarifications.id, id))
      .returning();
    
    return updated;
  }

  async updateClarificationStage(id: number, stage: string, changedBy: number, note?: string): Promise<Clarification | undefined> {
    const [existing] = await db.select().from(clarifications).where(eq(clarifications.id, id));
    if (!existing) return undefined;
    
    const updateData: Partial<Clarification> = { 
      currentStage: stage, 
      stageUpdatedAt: new Date(),
      updatedAt: new Date() 
    };
    
    // If stage is 'responded', set responseDate
    if (stage === 'responded') {
      updateData.responseDate = new Date();
    }
    
    const [updated] = await db
      .update(clarifications)
      .set(updateData)
      .where(eq(clarifications.id, id))
      .returning();
    
    // Create history entry
    await db.insert(clarificationHistory).values({
      clarificationId: id,
      fromStage: existing.currentStage,
      toStage: stage,
      changedBy,
      note,
    });
    
    return updated;
  }

  async deleteClarification(id: number): Promise<void> {
    await db.delete(clarificationHistory).where(eq(clarificationHistory.clarificationId, id));
    await db.delete(clarifications).where(eq(clarifications.id, id));
  }

  async getTodaysClarificationsForUser(userId: number, isAdmin: boolean): Promise<ClarificationWithDetails[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get all clarifications with today's submit deadline that are not yet submitted
    const results = await db
      .select()
      .from(clarifications)
      .where(
        and(
          gte(clarifications.submitDeadlineDate, today),
          lt(clarifications.submitDeadlineDate, tomorrow),
          or(
            eq(clarifications.currentStage, 'pending'),
            eq(clarifications.currentStage, 'in_progress')
          )
        )
      )
      .orderBy(clarifications.submitDeadlineTime);
    
    // Filter by user access: admin sees all, regular users see only their assigned ones
    const filteredResults = isAdmin 
      ? results 
      : results.filter(c => c.assignedTo === userId);
    
    return Promise.all(filteredResults.map(async (c) => this.enrichClarification(c)));
  }

  // ===============================
  // UNIFIED TENDER ACTIVITY OVERVIEW
  // ===============================
  
  async getTenderActivityOverview(referenceId: string): Promise<TenderActivityOverview | undefined> {
    // Find the tender by extracted reference ID in title or t247Id
    const matchingTenders = await db
      .select()
      .from(tenders)
      .where(or(
        eq(tenders.t247Id, referenceId),
        sql`${tenders.title} ILIKE ${'%[' + referenceId + ']%'}`
      ))
      .orderBy(desc(tenders.createdAt))
      .limit(1);
    
    const tender = matchingTenders[0];
    
    // Get all related data by referenceId
    const [
      relatedPresentations,
      relatedClarifications,
      relatedResults
    ] = await Promise.all([
      this.getPresentationsByReferenceId(referenceId),
      this.getClarificationsByReferenceId(referenceId),
      db.select().from(tenderResults).where(eq(tenderResults.referenceId, referenceId))
    ]);
    
    // Get enriched results
    const enrichedResults = await Promise.all(
      relatedResults.map(r => this.getTenderResultById(r.id))
    );
    
    // Get assignments if tender exists
    let assignments: (TenderAssignment & { assignee?: TeamMember; assigner?: TeamMember })[] = [];
    let submissions: (BiddingSubmission & { submitter?: TeamMember })[] = [];
    
    if (tender) {
      const tenderAssignmentsList = await db
        .select()
        .from(tenderAssignments)
        .where(eq(tenderAssignments.tenderId, tender.id));
      
      assignments = await Promise.all(
        tenderAssignmentsList.map(async (a) => {
          const [assignee] = await db.select().from(teamMembers).where(eq(teamMembers.id, a.assignedTo));
          const [assigner] = await db.select().from(teamMembers).where(eq(teamMembers.id, a.assignedBy));
          return { ...a, assignee, assigner };
        })
      );
      
      const submissionsList = await db
        .select()
        .from(biddingSubmissions)
        .where(eq(biddingSubmissions.tenderId, tender.id));
      
      submissions = await Promise.all(
        submissionsList.map(async (s) => {
          const [submitter] = await db.select().from(teamMembers).where(eq(teamMembers.id, s.submittedBy));
          return { ...s, submitter };
        })
      );
    }
    
    return {
      tender,
      referenceId,
      assignments,
      results: enrichedResults.filter(Boolean) as TenderResultWithHistory[],
      presentations: relatedPresentations,
      clarifications: relatedClarifications,
      submissions,
    };
  }

  // ===============================
  // MIS REPORT OPERATIONS
  // ===============================
  
  async getMISReportForTeamMember(teamMemberId: number, startDate: Date, endDate: Date): Promise<{
    teamMember: TeamMember;
    summary: {
      tendersMarkedNotRelevant: number;
      tendersMarkedNotEligible: number;
      tendersAssigned: number;
      tendersSubmitted: number;
      tendersReviewed: number;
      clarificationsCreated: number;
      clarificationsSubmitted: number;
      presentationsScheduled: number;
      presentationsCompleted: number;
      resultsRecorded: number;
      resultsL1: number;
      resultsAwarded: number;
      resultsLost: number;
      resultsCancelled: number;
      winRatio: number;
    };
    dailyBreakdown: {
      date: string;
      notRelevant: number;
      notEligible: number;
      assigned: number;
      submitted: number;
      reviewed: number;
      clarifications: number;
      presentations: number;
      l1: number;
      awarded: number;
      notRelevantIds: string[];
      notEligibleIds: string[];
      assignedIds: string[];
      submittedIds: string[];
      reviewedIds: string[];
      clarificationIds: string[];
      presentationIds: string[];
      l1Ids: string[];
      awardedIds: string[];
    }[];
  }> {
    const [teamMember] = await db.select().from(teamMembers).where(eq(teamMembers.id, teamMemberId));
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    // Get all audit logs for this user within date range
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userName, teamMember.username),
        gte(auditLogs.createdAt, startDate),
        lt(auditLogs.createdAt, endDate)
      ));

    // Helper function to extract tender ID from log
    const extractTenderId = (log: typeof logs[0]): string => {
      if (log.targetName) return log.targetName;
      if (log.targetId) return log.targetId;
      if (log.details) {
        try {
          const details = JSON.parse(log.details);
          return details.t247Id || details.tenderId?.toString() || details.referenceId || '';
        } catch {
          return '';
        }
      }
      return '';
    };

    // Count activities by category/action
    const notRelevantCount = logs.filter(l => l.action === 'override' && l.details?.includes('not_relevant')).length;
    const notEligibleCount = logs.filter(l => l.action === 'override' && l.details?.includes('not_eligible')).length;
    
    // Get assignments created by or assigned to this user
    const assignmentLogs = logs.filter(l => (l.action === 'assign' || l.action === 'create') && l.category === 'assignment');
    
    // Get submissions
    const submissionLogs = logs.filter(l => l.action === 'submit' || (l.action === 'stage_change' && l.details?.includes('submitted')));
    
    // Get reviews (stage changes to ready_for_review or approval actions)
    const reviewLogs = logs.filter(l => l.action === 'review' || (l.action === 'stage_change' && l.details?.includes('ready_for_review')));
    
    // Get clarifications created by this user
    const clarificationCreateLogs = logs.filter(l => l.action === 'create' && l.category === 'clarification');
    const clarificationSubmitLogs = logs.filter(l => l.action === 'submit' && l.category === 'clarification');
    
    // Get presentations created/scheduled by this user
    const presentationScheduledLogs = logs.filter(l => l.action === 'create' && l.category === 'presentation');
    const presentationCompletedLogs = logs.filter(l => l.action === 'status_change' && l.category === 'presentation' && l.details?.includes('completed'));
    
    // Get results recorded
    const resultsLogs = logs.filter(l => l.action === 'create' && l.category === 'tender_result');
    
    // Get result status logs (L1, Awarded, etc.)
    const l1Logs = logs.filter(l => l.category === 'tender_result' && l.details?.includes('"l1"'));
    const awardedLogs = logs.filter(l => l.category === 'tender_result' && l.details?.includes('"awarded"'));
    const lostLogs = logs.filter(l => l.category === 'tender_result' && (l.details?.includes('"technically_rejected"') || l.details?.includes('"financially_rejected"')));
    const cancelledLogs = logs.filter(l => l.category === 'tender_result' && l.details?.includes('"cancelled"'));

    // Also get direct counts from tables
    const assignmentsAssigned = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderAssignments)
      .where(and(
        eq(tenderAssignments.assignedTo, teamMemberId),
        gte(tenderAssignments.assignedAt, startDate),
        lt(tenderAssignments.assignedAt, endDate)
      ));
    
    const submissionsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(biddingSubmissions)
      .where(and(
        eq(biddingSubmissions.submittedBy, teamMemberId),
        gte(biddingSubmissions.submissionDate, startDate),
        lt(biddingSubmissions.submissionDate, endDate)
      ));

    const clarificationsCreatedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(clarifications)
      .where(and(
        eq(clarifications.createdBy, teamMemberId),
        gte(clarifications.createdAt, startDate),
        lt(clarifications.createdAt, endDate)
      ));
    
    const presentationsCreatedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(presentations)
      .where(and(
        eq(presentations.createdBy, teamMemberId),
        gte(presentations.createdAt, startDate),
        lt(presentations.createdAt, endDate)
      ));
    
    const resultsCreatedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderResults)
      .where(and(
        eq(tenderResults.updatedBy, teamMemberId),
        gte(tenderResults.createdAt, startDate),
        lt(tenderResults.createdAt, endDate)
      ));
    
    // Get results by status for this team member
    const resultsL1Count = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderResults)
      .where(and(
        eq(tenderResults.updatedBy, teamMemberId),
        eq(tenderResults.currentStatus, 'l1'),
        gte(tenderResults.updatedAt, startDate),
        lt(tenderResults.updatedAt, endDate)
      ));
    
    const resultsAwardedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderResults)
      .where(and(
        eq(tenderResults.updatedBy, teamMemberId),
        eq(tenderResults.currentStatus, 'awarded'),
        gte(tenderResults.updatedAt, startDate),
        lt(tenderResults.updatedAt, endDate)
      ));
    
    const resultsLostCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderResults)
      .where(and(
        eq(tenderResults.updatedBy, teamMemberId),
        sql`${tenderResults.currentStatus} IN ('technically_rejected', 'financially_rejected')`,
        gte(tenderResults.updatedAt, startDate),
        lt(tenderResults.updatedAt, endDate)
      ));
    
    const resultsCancelledCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderResults)
      .where(and(
        eq(tenderResults.updatedBy, teamMemberId),
        eq(tenderResults.currentStatus, 'cancelled'),
        gte(tenderResults.updatedAt, startDate),
        lt(tenderResults.updatedAt, endDate)
      ));
    
    const totalResults = Number(resultsAwardedCount[0]?.count || 0) + Number(resultsLostCount[0]?.count || 0);
    const winRatio = totalResults > 0 ? Math.round((Number(resultsAwardedCount[0]?.count || 0) / totalResults) * 100) : 0;

    // Build daily breakdown with tender IDs from actual data tables
    const dailyBreakdown: {
      date: string;
      notRelevant: number;
      notEligible: number;
      assigned: number;
      submitted: number;
      reviewed: number;
      clarifications: number;
      presentations: number;
      l1: number;
      awarded: number;
      notRelevantIds: string[];
      notEligibleIds: string[];
      assignedIds: string[];
      submittedIds: string[];
      reviewedIds: string[];
      clarificationIds: string[];
      presentationIds: string[];
      l1Ids: string[];
      awardedIds: string[];
    }[] = [];

    // Generate dates in range and query actual data for each day
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Query assignments for this day (where this team member is assigned to)
      const dayAssignments = await db
        .select({
          id: tenderAssignments.id,
          tenderId: tenderAssignments.tenderId,
        })
        .from(tenderAssignments)
        .innerJoin(tenders, eq(tenderAssignments.tenderId, tenders.id))
        .where(and(
          eq(tenderAssignments.assignedTo, teamMemberId),
          gte(tenderAssignments.assignedAt, dayStart),
          lt(tenderAssignments.assignedAt, dayEnd)
        ));
      
      const assignedIds = await Promise.all(dayAssignments.map(async (a) => {
        const tender = await db.select({ t247Id: tenders.t247Id }).from(tenders).where(eq(tenders.id, a.tenderId)).limit(1);
        return tender[0]?.t247Id || a.tenderId.toString();
      }));

      // Query submissions for this day
      const daySubmissions = await db
        .select({
          id: biddingSubmissions.id,
          assignmentId: biddingSubmissions.assignmentId,
        })
        .from(biddingSubmissions)
        .where(and(
          eq(biddingSubmissions.submittedBy, teamMemberId),
          gte(biddingSubmissions.submissionDate, dayStart),
          lt(biddingSubmissions.submissionDate, dayEnd)
        ));
      
      const submittedIds = await Promise.all(daySubmissions.map(async (s) => {
        const assignment = await db.select({ tenderId: tenderAssignments.tenderId }).from(tenderAssignments).where(eq(tenderAssignments.id, s.assignmentId)).limit(1);
        if (assignment[0]) {
          const tender = await db.select({ t247Id: tenders.t247Id }).from(tenders).where(eq(tenders.id, assignment[0].tenderId)).limit(1);
          return tender[0]?.t247Id || assignment[0].tenderId.toString();
        }
        return s.id.toString();
      }));

      // Query clarifications created on this day by this team member
      const dayClarifications = await db
        .select({
          id: clarifications.id,
          referenceId: clarifications.referenceId,
        })
        .from(clarifications)
        .where(and(
          eq(clarifications.assignedTo, teamMemberId),
          gte(clarifications.createdAt, dayStart),
          lt(clarifications.createdAt, dayEnd)
        ));
      
      const clarificationIds = dayClarifications.map(c => c.referenceId || c.id.toString());

      // Query presentations scheduled on this day assigned to this team member
      const dayPresentations = await db
        .select({
          id: presentations.id,
          referenceId: presentations.referenceId,
        })
        .from(presentations)
        .where(and(
          eq(presentations.assignedTo, teamMemberId),
          gte(presentations.createdAt, dayStart),
          lt(presentations.createdAt, dayEnd)
        ));
      
      const presentationIds = dayPresentations.map(p => p.referenceId || p.id.toString());

      // Query tender results for L1 and Awarded on this day
      const dayL1Results = await db
        .select({
          id: tenderResults.id,
          referenceId: tenderResults.referenceId,
        })
        .from(tenderResults)
        .where(and(
          eq(tenderResults.updatedBy, teamMemberId),
          eq(tenderResults.currentStatus, 'l1'),
          gte(tenderResults.updatedAt, dayStart),
          lt(tenderResults.updatedAt, dayEnd)
        ));
      
      const l1Ids = dayL1Results.map(r => r.referenceId || r.id.toString());

      const dayAwardedResults = await db
        .select({
          id: tenderResults.id,
          referenceId: tenderResults.referenceId,
        })
        .from(tenderResults)
        .where(and(
          eq(tenderResults.updatedBy, teamMemberId),
          eq(tenderResults.currentStatus, 'awarded'),
          gte(tenderResults.updatedAt, dayStart),
          lt(tenderResults.updatedAt, dayEnd)
        ));
      
      const awardedIds = dayAwardedResults.map(r => r.referenceId || r.id.toString());

      // Get override logs from audit for not relevant/not eligible (still use audit logs for this)
      const dayLogs = logs.filter(l => {
        const logDate = new Date(l.createdAt!);
        return logDate >= dayStart && logDate < dayEnd;
      });

      const notRelevantLogs = dayLogs.filter(l => l.action === 'override' && l.details?.includes('not_relevant'));
      const notEligibleLogs = dayLogs.filter(l => l.action === 'override' && l.details?.includes('not_eligible'));
      const reviewedLogs = dayLogs.filter(l => l.action === 'review' || (l.action === 'stage_change' && l.details?.includes('ready_for_review')));

      dailyBreakdown.push({
        date: dateStr,
        notRelevant: notRelevantLogs.length,
        notEligible: notEligibleLogs.length,
        assigned: dayAssignments.length,
        submitted: daySubmissions.length,
        reviewed: reviewedLogs.length,
        clarifications: dayClarifications.length,
        presentations: dayPresentations.length,
        l1: dayL1Results.length,
        awarded: dayAwardedResults.length,
        notRelevantIds: notRelevantLogs.map(extractTenderId).filter(Boolean),
        notEligibleIds: notEligibleLogs.map(extractTenderId).filter(Boolean),
        assignedIds,
        submittedIds,
        reviewedIds: reviewedLogs.map(extractTenderId).filter(Boolean),
        clarificationIds,
        presentationIds,
        l1Ids,
        awardedIds,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      teamMember,
      summary: {
        tendersMarkedNotRelevant: notRelevantCount,
        tendersMarkedNotEligible: notEligibleCount,
        tendersAssigned: Number(assignmentsAssigned[0]?.count || 0),
        tendersSubmitted: Number(submissionsCount[0]?.count || 0),
        tendersReviewed: reviewLogs.length,
        clarificationsCreated: Number(clarificationsCreatedCount[0]?.count || 0),
        clarificationsSubmitted: clarificationSubmitLogs.length,
        presentationsScheduled: Number(presentationsCreatedCount[0]?.count || 0),
        presentationsCompleted: presentationCompletedLogs.length,
        resultsRecorded: Number(resultsCreatedCount[0]?.count || 0),
        resultsL1: Number(resultsL1Count[0]?.count || 0),
        resultsAwarded: Number(resultsAwardedCount[0]?.count || 0),
        resultsLost: Number(resultsLostCount[0]?.count || 0),
        resultsCancelled: Number(resultsCancelledCount[0]?.count || 0),
        winRatio,
      },
      dailyBreakdown,
    };
  }

  async getMISReportForAllTeamMembers(startDate: Date, endDate: Date): Promise<{
    teamMemberId: number;
    teamMemberName: string;
    role: string;
    summary: {
      tendersMarkedNotRelevant: number;
      tendersMarkedNotEligible: number;
      tendersAssigned: number;
      tendersSubmitted: number;
      tendersReviewed: number;
      clarificationsCreated: number;
      clarificationsSubmitted: number;
      presentationsScheduled: number;
      presentationsCompleted: number;
      resultsRecorded: number;
      resultsL1: number;
      resultsAwarded: number;
      resultsLost: number;
      resultsCancelled: number;
      winRatio: number;
      totalActions: number;
    };
  }[]> {
    const allMembers = await db.select().from(teamMembers).where(eq(teamMembers.isActive, true));
    
    const reports = await Promise.all(
      allMembers.map(async (member) => {
        try {
          const report = await this.getMISReportForTeamMember(member.id, startDate, endDate);
          const total = 
            report.summary.tendersMarkedNotRelevant +
            report.summary.tendersMarkedNotEligible +
            report.summary.tendersAssigned +
            report.summary.tendersSubmitted +
            report.summary.tendersReviewed +
            report.summary.clarificationsCreated +
            report.summary.clarificationsSubmitted +
            report.summary.presentationsScheduled +
            report.summary.presentationsCompleted +
            report.summary.resultsRecorded;

          return {
            teamMemberId: member.id,
            teamMemberName: member.fullName || member.username,
            role: member.role,
            summary: {
              ...report.summary,
              totalActions: total,
            },
          };
        } catch (e) {
          return {
            teamMemberId: member.id,
            teamMemberName: member.fullName || member.username,
            role: member.role,
            summary: {
              tendersMarkedNotRelevant: 0,
              tendersMarkedNotEligible: 0,
              tendersAssigned: 0,
              tendersSubmitted: 0,
              tendersReviewed: 0,
              clarificationsCreated: 0,
              clarificationsSubmitted: 0,
              presentationsScheduled: 0,
              presentationsCompleted: 0,
              resultsRecorded: 0,
              resultsL1: 0,
              resultsAwarded: 0,
              resultsLost: 0,
              resultsCancelled: 0,
              winRatio: 0,
              totalActions: 0,
            },
          };
        }
      })
    );

    // Sort by total actions descending
    return reports.sort((a, b) => b.summary.totalActions - a.summary.totalActions);
  }
  
  async getMISReportForUser(username: string, role: string, startDate: Date, endDate: Date): Promise<{
    user: { username: string; role: string };
    summary: {
      tendersMarkedNotRelevant: number;
      tendersMarkedNotEligible: number;
      tendersAssigned: number;
      tendersSubmitted: number;
      tendersReviewed: number;
      clarificationsCreated: number;
      clarificationsSubmitted: number;
      presentationsScheduled: number;
      presentationsCompleted: number;
      resultsRecorded: number;
      resultsL1: number;
      resultsAwarded: number;
      resultsLost: number;
      resultsCancelled: number;
      winRatio: number;
    };
    dailyBreakdown: {
      date: string;
      notRelevant: number;
      notEligible: number;
      assigned: number;
      submitted: number;
      reviewed: number;
      clarifications: number;
      presentations: number;
      l1: number;
      awarded: number;
      notRelevantIds: string[];
      notEligibleIds: string[];
      assignedIds: string[];
      submittedIds: string[];
      reviewedIds: string[];
      clarificationIds: string[];
      presentationIds: string[];
      l1Ids: string[];
      awardedIds: string[];
    }[];
  }> {
    // Get all audit logs for this user within date range
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userName, username),
        gte(auditLogs.createdAt, startDate),
        lt(auditLogs.createdAt, endDate)
      ));

    // Helper function to extract tender ID from log
    const extractTenderId = (log: typeof logs[0]): string => {
      if (log.targetName) return log.targetName;
      if (log.targetId) return log.targetId;
      if (log.details) {
        try {
          const details = JSON.parse(log.details);
          return details.t247Id || details.tenderId?.toString() || details.referenceId || '';
        } catch {
          return '';
        }
      }
      return '';
    };

    // Count activities by category/action
    const notRelevantCount = logs.filter(l => l.action === 'override' && l.details?.includes('not_relevant')).length;
    const notEligibleCount = logs.filter(l => l.action === 'override' && l.details?.includes('not_eligible')).length;
    
    // Get assignments created by or assigned to this user
    const assignmentLogs = logs.filter(l => (l.action === 'assign' || l.action === 'create') && l.category === 'assignment');
    
    // Get submissions
    const submissionLogs = logs.filter(l => l.action === 'submit' || (l.action === 'stage_change' && l.details?.includes('submitted')));
    
    // Get reviews (stage changes to ready_for_review or approval actions)
    const reviewLogs = logs.filter(l => l.action === 'review' || (l.action === 'stage_change' && l.details?.includes('ready_for_review')));
    
    // Get clarifications created by this user
    const clarificationCreateLogs = logs.filter(l => l.action === 'create' && l.category === 'clarification');
    const clarificationSubmitLogs = logs.filter(l => l.action === 'submit' && l.category === 'clarification');
    
    // Get presentations created/scheduled by this user
    const presentationScheduledLogs = logs.filter(l => l.action === 'create' && l.category === 'presentation');
    const presentationCompletedLogs = logs.filter(l => l.action === 'status_change' && l.category === 'presentation' && l.details?.includes('completed'));
    
    // Get results recorded
    const resultsLogs = logs.filter(l => l.action === 'create' && l.category === 'tender_result');
    
    // Get result status logs (L1, Awarded, etc.)
    const l1Logs = logs.filter(l => l.category === 'tender_result' && l.details?.includes('"l1"'));
    const awardedLogs = logs.filter(l => l.category === 'tender_result' && l.details?.includes('"awarded"'));
    const lostLogs = logs.filter(l => l.category === 'tender_result' && (l.details?.includes('"technically_rejected"') || l.details?.includes('"financially_rejected"')));
    const cancelledLogs = logs.filter(l => l.category === 'tender_result' && l.details?.includes('"cancelled"'));
    
    const totalResults = awardedLogs.length + lostLogs.length;
    const winRatio = totalResults > 0 ? Math.round((awardedLogs.length / totalResults) * 100) : 0;

    // Build daily breakdown with tender IDs
    const dailyBreakdown: {
      date: string;
      notRelevant: number;
      notEligible: number;
      assigned: number;
      submitted: number;
      reviewed: number;
      clarifications: number;
      presentations: number;
      l1: number;
      awarded: number;
      notRelevantIds: string[];
      notEligibleIds: string[];
      assignedIds: string[];
      submittedIds: string[];
      reviewedIds: string[];
      clarificationIds: string[];
      presentationIds: string[];
      l1Ids: string[];
      awardedIds: string[];
    }[] = [];

    // Generate dates in range
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayLogs = logs.filter(l => {
        const logDate = new Date(l.createdAt!);
        return logDate >= currentDate && logDate < nextDate;
      });

      const notRelevantLogDay = dayLogs.filter(l => l.action === 'override' && l.details?.includes('not_relevant'));
      const notEligibleLogDay = dayLogs.filter(l => l.action === 'override' && l.details?.includes('not_eligible'));
      const assignedLogDay = dayLogs.filter(l => (l.action === 'assign' || l.action === 'create') && l.category === 'assignment');
      const submittedLogDay = dayLogs.filter(l => l.action === 'submit' || (l.action === 'stage_change' && l.details?.includes('submitted')));
      const reviewedLogDay = dayLogs.filter(l => l.action === 'review' || (l.action === 'stage_change' && l.details?.includes('ready_for_review')));
      const clarificationLogDay = dayLogs.filter(l => l.category === 'clarification');
      const presentationLogDay = dayLogs.filter(l => l.category === 'presentation');
      const dayL1Logs = dayLogs.filter(l => l.category === 'tender_result' && l.details?.includes('"l1"'));
      const dayAwardedLogs = dayLogs.filter(l => l.category === 'tender_result' && l.details?.includes('"awarded"'));

      dailyBreakdown.push({
        date: dateStr,
        notRelevant: notRelevantLogDay.length,
        notEligible: notEligibleLogDay.length,
        assigned: assignedLogDay.length,
        submitted: submittedLogDay.length,
        reviewed: reviewedLogDay.length,
        clarifications: clarificationLogDay.length,
        presentations: presentationLogDay.length,
        l1: dayL1Logs.length,
        awarded: dayAwardedLogs.length,
        notRelevantIds: notRelevantLogDay.map(extractTenderId).filter(Boolean),
        notEligibleIds: notEligibleLogDay.map(extractTenderId).filter(Boolean),
        assignedIds: assignedLogDay.map(extractTenderId).filter(Boolean),
        submittedIds: submittedLogDay.map(extractTenderId).filter(Boolean),
        reviewedIds: reviewedLogDay.map(extractTenderId).filter(Boolean),
        clarificationIds: clarificationLogDay.map(extractTenderId).filter(Boolean),
        presentationIds: presentationLogDay.map(extractTenderId).filter(Boolean),
        l1Ids: dayL1Logs.map(extractTenderId).filter(Boolean),
        awardedIds: dayAwardedLogs.map(extractTenderId).filter(Boolean),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      user: { username, role },
      summary: {
        tendersMarkedNotRelevant: notRelevantCount,
        tendersMarkedNotEligible: notEligibleCount,
        tendersAssigned: assignmentLogs.length,
        tendersSubmitted: submissionLogs.length,
        tendersReviewed: reviewLogs.length,
        clarificationsCreated: clarificationCreateLogs.length,
        clarificationsSubmitted: clarificationSubmitLogs.length,
        presentationsScheduled: presentationScheduledLogs.length,
        presentationsCompleted: presentationCompletedLogs.length,
        resultsRecorded: resultsLogs.length,
        resultsL1: l1Logs.length,
        resultsAwarded: awardedLogs.length,
        resultsLost: lostLogs.length,
        resultsCancelled: cancelledLogs.length,
        winRatio,
      },
      dailyBreakdown,
    };
  }
}

export const storage = new DatabaseStorage();
