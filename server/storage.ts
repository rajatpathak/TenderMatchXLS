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
}

export const storage = new DatabaseStorage();
