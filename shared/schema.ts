import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Company criteria configuration
export const companyCriteria = pgTable("company_criteria", {
  id: integer("id").primaryKey().default(1),
  turnoverCr: decimal("turnover_cr", { precision: 10, scale: 2 }).default("4"),
  projectTypes: text("project_types").array().default(sql`ARRAY['Software', 'Website', 'Mobile', 'IT Projects', 'Manpower Deployment']`),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertCompanyCriteriaSchema = createInsertSchema(companyCriteria).omit({
  id: true,
  updatedAt: true,
});
export type InsertCompanyCriteria = z.infer<typeof insertCompanyCriteriaSchema>;
export type CompanyCriteria = typeof companyCriteria.$inferSelect;

// Negative keywords for filtering irrelevant tenders
export const negativeKeywords = pgTable("negative_keywords", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  keyword: varchar("keyword").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertNegativeKeywordSchema = createInsertSchema(negativeKeywords).omit({
  id: true,
  createdAt: true,
});
export type InsertNegativeKeyword = z.infer<typeof insertNegativeKeywordSchema>;
export type NegativeKeyword = typeof negativeKeywords.$inferSelect;

// Predefined override reasons for manual status changes
export const overrideReasons = [
  "Turnover requirement too high",
  "Experience requirement not met",
  "Technical capability mismatch",
  "Location/Region restriction",
  "Product/Service not in scope",
  "Already applied",
  "Deadline passed",
  "Budget constraint",
  "Resource unavailable",
  "Other (specify in comment)",
] as const;

export type OverrideReason = typeof overrideReasons[number];

// Excel uploads tracking
export const excelUploads = pgTable("excel_uploads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fileName: varchar("file_name").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  totalTenders: integer("total_tenders").default(0),
  gemCount: integer("gem_count").default(0),
  nonGemCount: integer("non_gem_count").default(0),
  newCount: integer("new_count").default(0),
  duplicateCount: integer("duplicate_count").default(0),
  corrigendumCount: integer("corrigendum_count").default(0),
  eligibleCount: integer("eligible_count").default(0),
  notEligibleCount: integer("not_eligible_count").default(0),
  notRelevantCount: integer("not_relevant_count").default(0),
  manualReviewCount: integer("manual_review_count").default(0),
  missedCount: integer("missed_count").default(0),
  processedAt: timestamp("processed_at"),
});

export const insertExcelUploadSchema = createInsertSchema(excelUploads).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});
export type InsertExcelUpload = z.infer<typeof insertExcelUploadSchema>;
export type ExcelUpload = typeof excelUploads.$inferSelect;

// Main tenders table
export const tenders = pgTable("tenders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  t247Id: varchar("t247_id").notNull(),
  uploadId: integer("upload_id").references(() => excelUploads.id),
  tenderType: varchar("tender_type").notNull(), // 'gem' or 'non_gem'
  title: text("title"),
  department: text("department"),
  organization: text("organization"),
  
  // Financial fields
  estimatedValue: decimal("estimated_value", { precision: 15, scale: 2 }),
  emdAmount: decimal("emd_amount", { precision: 15, scale: 2 }),
  turnoverRequirement: decimal("turnover_requirement", { precision: 15, scale: 2 }),
  
  // Dates
  publishDate: timestamp("publish_date"),
  submissionDeadline: timestamp("submission_deadline"),
  openingDate: timestamp("opening_date"),
  
  // Location
  location: text("location"),
  
  // Eligibility fields
  eligibilityCriteria: text("eligibility_criteria"),
  checklist: text("checklist"),
  
  // Analysis results
  matchPercentage: integer("match_percentage").default(0),
  isMsmeExempted: boolean("is_msme_exempted").default(false),
  isStartupExempted: boolean("is_startup_exempted").default(false),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  analysisStatus: varchar("analysis_status").default("analyzed"), // 'analyzed', 'unable_to_analyze'
  
  // Eligibility status: 'eligible', 'not_eligible', 'not_relevant', 'manual_review', 'missed'
  eligibilityStatus: varchar("eligibility_status").default("eligible"),
  notRelevantKeyword: varchar("not_relevant_keyword"), // The keyword that matched if marked not relevant
  
  // Missed deadline tracking
  isMissed: boolean("is_missed").default(false), // Whether deadline has passed
  previousEligibilityStatus: varchar("previous_eligibility_status"), // Status before being marked as missed
  missedAt: timestamp("missed_at"), // When it was marked as missed
  
  // Manual override fields
  isManualOverride: boolean("is_manual_override").default(false),
  overrideStatus: varchar("override_status"), // 'not_eligible', 'not_relevant'
  overrideReason: varchar("override_reason"),
  overrideComment: text("override_comment"),
  overrideBy: varchar("override_by").references(() => users.id),
  overrideAt: timestamp("override_at"),
  
  // Additional data stored as JSON
  rawData: jsonb("raw_data"),
  
  // Corrigendum tracking
  isCorrigendum: boolean("is_corrigendum").default(false),
  originalTenderId: integer("original_tender_id"),
  
  // GEM-specific: Similar Category from Column X
  similarCategory: text("similar_category"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenderSchema = createInsertSchema(tenders).omit({
  id: true,
  createdAt: true,
});
export type InsertTender = z.infer<typeof insertTenderSchema>;
export type Tender = typeof tenders.$inferSelect;

// Corrigendum changes tracking
export const corrigendumChanges = pgTable("corrigendum_changes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenderId: integer("tender_id").references(() => tenders.id).notNull(),
  originalTenderId: integer("original_tender_id").references(() => tenders.id).notNull(),
  fieldName: varchar("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  detectedAt: timestamp("detected_at").defaultNow(),
});

export const insertCorrigendumChangeSchema = createInsertSchema(corrigendumChanges).omit({
  id: true,
  detectedAt: true,
});
export type InsertCorrigendumChange = z.infer<typeof insertCorrigendumChangeSchema>;
export type CorrigendumChange = typeof corrigendumChanges.$inferSelect;

// PDF documents for tenders that need manual analysis
export const tenderDocuments = pgTable("tender_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenderId: integer("tender_id").references(() => tenders.id).notNull(),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").default("pdf"),
  extractedText: text("extracted_text"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertTenderDocumentSchema = createInsertSchema(tenderDocuments).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});
export type InsertTenderDocument = z.infer<typeof insertTenderDocumentSchema>;
export type TenderDocument = typeof tenderDocuments.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  excelUploads: many(excelUploads),
}));

export const excelUploadsRelations = relations(excelUploads, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [excelUploads.uploadedBy],
    references: [users.id],
  }),
  tenders: many(tenders),
}));

export const tendersRelations = relations(tenders, ({ one, many }) => ({
  upload: one(excelUploads, {
    fields: [tenders.uploadId],
    references: [excelUploads.id],
  }),
  originalTender: one(tenders, {
    fields: [tenders.originalTenderId],
    references: [tenders.id],
    relationName: "corrigendum",
  }),
  corrigendums: many(tenders, { relationName: "corrigendum" }),
  documents: many(tenderDocuments),
  changes: many(corrigendumChanges),
}));

export const corrigendumChangesRelations = relations(corrigendumChanges, ({ one }) => ({
  tender: one(tenders, {
    fields: [corrigendumChanges.tenderId],
    references: [tenders.id],
  }),
  originalTender: one(tenders, {
    fields: [corrigendumChanges.originalTenderId],
    references: [tenders.id],
  }),
}));

export const tenderDocumentsRelations = relations(tenderDocuments, ({ one }) => ({
  tender: one(tenders, {
    fields: [tenderDocuments.tenderId],
    references: [tenders.id],
  }),
}));

// ===============================
// TEAM MANAGEMENT & BIDDING WORKFLOW
// ===============================

// User roles enum
export const userRoles = ['admin', 'manager', 'bidder'] as const;
export type UserRole = typeof userRoles[number];

// Team members table (internal users for tender management)
export const teamMembers = pgTable("team_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: varchar("username").notNull().unique(),
  password: varchar("password").notNull(),
  email: varchar("email").unique(),
  fullName: varchar("full_name").notNull(),
  role: varchar("role").notNull().default("bidder"), // 'admin', 'manager', 'bidder'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by"),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// Bidding workflow stages
export const biddingStages = ['assigned', 'in_progress', 'ready_for_review', 'submitted'] as const;
export type BiddingStage = typeof biddingStages[number];

// Tender assignments table
export const tenderAssignments = pgTable("tender_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenderId: integer("tender_id").references(() => tenders.id).notNull(),
  assignedTo: integer("assigned_to").references(() => teamMembers.id).notNull(),
  assignedBy: integer("assigned_by").references(() => teamMembers.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  
  // Current workflow stage
  currentStage: varchar("current_stage").default("assigned"), // 'assigned', 'in_progress', 'ready_for_review', 'submitted'
  stageUpdatedAt: timestamp("stage_updated_at").defaultNow(),
  
  // Notes and priority
  priority: varchar("priority").default("normal"), // 'low', 'normal', 'high', 'urgent'
  notes: text("notes"),
  
  isActive: boolean("is_active").default(true),
});

export const insertTenderAssignmentSchema = createInsertSchema(tenderAssignments).omit({
  id: true,
  assignedAt: true,
  stageUpdatedAt: true,
});
export type InsertTenderAssignment = z.infer<typeof insertTenderAssignmentSchema>;
export type TenderAssignment = typeof tenderAssignments.$inferSelect;

// Bidding submissions table (when tender is submitted to portal)
export const biddingSubmissions = pgTable("bidding_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenderId: integer("tender_id").references(() => tenders.id).notNull(),
  assignmentId: integer("assignment_id").references(() => tenderAssignments.id).notNull(),
  submittedBy: integer("submitted_by").references(() => teamMembers.id).notNull(),
  
  // Submission details
  submittedBudget: decimal("submitted_budget", { precision: 15, scale: 2 }).notNull(),
  submissionDate: timestamp("submission_date").notNull(),
  portalReferenceNumber: varchar("portal_reference_number"),
  
  // Additional info
  notes: text("notes"),
  attachments: text("attachments").array().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBiddingSubmissionSchema = createInsertSchema(biddingSubmissions).omit({
  id: true,
  createdAt: true,
});
export type InsertBiddingSubmission = z.infer<typeof insertBiddingSubmissionSchema>;
export type BiddingSubmission = typeof biddingSubmissions.$inferSelect;

// Workflow status history for audit trail
export const workflowHistory = pgTable("workflow_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  assignmentId: integer("assignment_id").references(() => tenderAssignments.id).notNull(),
  fromStage: varchar("from_stage"),
  toStage: varchar("to_stage").notNull(),
  changedBy: integer("changed_by").references(() => teamMembers.id).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkflowHistorySchema = createInsertSchema(workflowHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkflowHistory = z.infer<typeof insertWorkflowHistorySchema>;
export type WorkflowHistory = typeof workflowHistory.$inferSelect;

// Relations for team management
export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  assignedTenders: many(tenderAssignments, { relationName: "assignee" }),
  createdAssignments: many(tenderAssignments, { relationName: "assigner" }),
  submissions: many(biddingSubmissions),
}));

export const tenderAssignmentsRelations = relations(tenderAssignments, ({ one, many }) => ({
  tender: one(tenders, {
    fields: [tenderAssignments.tenderId],
    references: [tenders.id],
  }),
  assignee: one(teamMembers, {
    fields: [tenderAssignments.assignedTo],
    references: [teamMembers.id],
    relationName: "assignee",
  }),
  assigner: one(teamMembers, {
    fields: [tenderAssignments.assignedBy],
    references: [teamMembers.id],
    relationName: "assigner",
  }),
  submission: many(biddingSubmissions),
  history: many(workflowHistory),
}));

export const biddingSubmissionsRelations = relations(biddingSubmissions, ({ one }) => ({
  tender: one(tenders, {
    fields: [biddingSubmissions.tenderId],
    references: [tenders.id],
  }),
  assignment: one(tenderAssignments, {
    fields: [biddingSubmissions.assignmentId],
    references: [tenderAssignments.id],
  }),
  submitter: one(teamMembers, {
    fields: [biddingSubmissions.submittedBy],
    references: [teamMembers.id],
  }),
}));

export const workflowHistoryRelations = relations(workflowHistory, ({ one }) => ({
  assignment: one(tenderAssignments, {
    fields: [workflowHistory.assignmentId],
    references: [tenderAssignments.id],
  }),
  changedByUser: one(teamMembers, {
    fields: [workflowHistory.changedBy],
    references: [teamMembers.id],
  }),
}));

// Extended tender type with assignment info
export type TenderWithAssignment = Tender & {
  assignment?: TenderAssignment & {
    assignee?: TeamMember;
    assigner?: TeamMember;
  };
  submission?: BiddingSubmission;
};

// Audit logs table for admin tracking
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  action: varchar("action").notNull(), // login, logout, upload, assign, override, team_add, team_update, etc.
  category: varchar("category").notNull(), // auth, tender, team, config, workflow
  userId: varchar("user_id"), // Can be null for system actions
  userName: varchar("user_name"),
  targetType: varchar("target_type"), // tender, team_member, assignment, etc.
  targetId: varchar("target_id"),
  targetName: varchar("target_name"),
  details: text("details"), // JSON string with additional info
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ===============================
// TENDER RESULTS MODULE
// ===============================

// Tender result status options
export const tenderResultStatuses = [
  'technically_qualified',
  'technically_rejected',
  'l1',
  'financially_rejected',
  'cancelled',
  'awarded',
] as const;
export type TenderResultStatus = typeof tenderResultStatuses[number];

// Human-readable status labels
export const tenderResultStatusLabels: Record<TenderResultStatus, string> = {
  technically_qualified: 'Technically Qualified',
  technically_rejected: 'Technically Rejected',
  l1: 'L1',
  financially_rejected: 'Financially Rejected',
  cancelled: 'Cancelled',
  awarded: 'Awarded',
};

// Status sequence for progress tracking
export const statusSequence: TenderResultStatus[] = [
  'technically_qualified',
  'l1',
  'awarded',
];

// Tender results table - tracks the current status of tender outcomes
export const tenderResults = pgTable("tender_results", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  referenceId: varchar("reference_id").notNull(), // T247 ID or custom reference
  tenderId: integer("tender_id").references(() => tenders.id), // Optional link to existing tender
  currentStatus: varchar("current_status").notNull(), // Current status from tenderResultStatuses
  updatedBy: integer("updated_by").references(() => teamMembers.id).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenderResultSchema = createInsertSchema(tenderResults).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});
export type InsertTenderResult = z.infer<typeof insertTenderResultSchema>;
export type TenderResult = typeof tenderResults.$inferSelect;

// Tender result history table - tracks all status changes for audit trail
export const tenderResultHistory = pgTable("tender_result_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenderResultId: integer("tender_result_id").references(() => tenderResults.id).notNull(),
  status: varchar("status").notNull(), // Status from tenderResultStatuses
  updatedBy: integer("updated_by").references(() => teamMembers.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  note: text("note"), // Optional note for this status change
});

export const insertTenderResultHistorySchema = createInsertSchema(tenderResultHistory).omit({
  id: true,
  timestamp: true,
});
export type InsertTenderResultHistory = z.infer<typeof insertTenderResultHistorySchema>;
export type TenderResultHistory = typeof tenderResultHistory.$inferSelect;

// Relations for tender results
export const tenderResultsRelations = relations(tenderResults, ({ one, many }) => ({
  tender: one(tenders, {
    fields: [tenderResults.tenderId],
    references: [tenders.id],
  }),
  updatedByMember: one(teamMembers, {
    fields: [tenderResults.updatedBy],
    references: [teamMembers.id],
  }),
  history: many(tenderResultHistory),
}));

export const tenderResultHistoryRelations = relations(tenderResultHistory, ({ one }) => ({
  tenderResult: one(tenderResults, {
    fields: [tenderResultHistory.tenderResultId],
    references: [tenderResults.id],
  }),
  updatedByMember: one(teamMembers, {
    fields: [tenderResultHistory.updatedBy],
    references: [teamMembers.id],
  }),
}));

// Extended type for tender result with history
export type TenderResultWithHistory = TenderResult & {
  history: (TenderResultHistory & {
    updatedByMember?: TeamMember;
  })[];
  updatedByMember?: TeamMember;
  tender?: Tender;
};

// ===============================
// PRESENTATION MODULE
// ===============================

// Presentation status
export const presentationStatuses = ['scheduled', 'completed', 'cancelled', 'postponed'] as const;
export type PresentationStatus = typeof presentationStatuses[number];

// Presentations table - tracks scheduled presentations for tenders
export const presentations = pgTable("presentations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  referenceId: varchar("reference_id").notNull(), // Tender ID from title brackets
  tenderId: integer("tender_id").references(() => tenders.id), // Optional link to existing tender
  
  // Schedule
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: varchar("scheduled_time").notNull(), // Store as HH:MM format
  
  // Assignment
  assignedTo: integer("assigned_to").references(() => teamMembers.id).notNull(),
  
  // Department contacts (can be multiple)
  departmentContacts: jsonb("department_contacts").default(sql`'[]'::jsonb`), // Array of {name, phone, email}
  
  // Status and completion
  status: varchar("status").default("scheduled"), // scheduled, completed, cancelled, postponed
  
  // Presentation document
  presentationFile: varchar("presentation_file"), // PDF file path
  presentationUploadedAt: timestamp("presentation_uploaded_at"),
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPresentationSchema = createInsertSchema(presentations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  presentationUploadedAt: true,
});
export type InsertPresentation = z.infer<typeof insertPresentationSchema>;
export type Presentation = typeof presentations.$inferSelect;

// Presentation history for audit trail
export const presentationHistory = pgTable("presentation_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  presentationId: integer("presentation_id").references(() => presentations.id).notNull(),
  action: varchar("action").notNull(), // created, updated, status_changed, file_uploaded
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status"),
  changedBy: integer("changed_by").references(() => teamMembers.id).notNull(),
  note: text("note"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertPresentationHistorySchema = createInsertSchema(presentationHistory).omit({
  id: true,
  timestamp: true,
});
export type InsertPresentationHistory = z.infer<typeof insertPresentationHistorySchema>;
export type PresentationHistory = typeof presentationHistory.$inferSelect;

// Relations for presentations
export const presentationsRelations = relations(presentations, ({ one, many }) => ({
  tender: one(tenders, {
    fields: [presentations.tenderId],
    references: [tenders.id],
  }),
  assignee: one(teamMembers, {
    fields: [presentations.assignedTo],
    references: [teamMembers.id],
    relationName: "presentationAssignee",
  }),
  creator: one(teamMembers, {
    fields: [presentations.createdBy],
    references: [teamMembers.id],
    relationName: "presentationCreator",
  }),
  history: many(presentationHistory),
}));

export const presentationHistoryRelations = relations(presentationHistory, ({ one }) => ({
  presentation: one(presentations, {
    fields: [presentationHistory.presentationId],
    references: [presentations.id],
  }),
  changedByMember: one(teamMembers, {
    fields: [presentationHistory.changedBy],
    references: [teamMembers.id],
  }),
}));

// Extended presentation type with relations
export type PresentationWithDetails = Presentation & {
  assignee?: TeamMember;
  creator?: TeamMember;
  tender?: Tender;
  history?: (PresentationHistory & { changedByMember?: TeamMember })[];
};

// Department contact type
export type DepartmentContact = {
  name?: string;
  phone?: string;
  email?: string;
};

// ===============================
// CLARIFICATION MODULE
// ===============================

// Clarification stages (similar to tender workflow)
export const clarificationStages = ['pending', 'in_progress', 'submitted', 'responded', 'closed'] as const;
export type ClarificationStage = typeof clarificationStages[number];

// Clarifications table - tracks tender clarifications
export const clarifications = pgTable("clarifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  referenceId: varchar("reference_id").notNull(), // Tender ID from title brackets
  tenderId: integer("tender_id").references(() => tenders.id), // Optional link to existing tender
  
  // Clarification details
  clarificationDetails: text("clarification_details").notNull(),
  
  // Assignment
  assignedTo: integer("assigned_to").references(() => teamMembers.id).notNull(),
  
  // Department contacts (can be multiple)
  departmentContacts: jsonb("department_contacts").default(sql`'[]'::jsonb`), // Array of {name, phone, email}
  
  // Current stage
  currentStage: varchar("current_stage").default("pending"), // pending, in_progress, submitted, responded, closed
  stageUpdatedAt: timestamp("stage_updated_at").defaultNow(),
  
  // Response details (when clarification is responded)
  responseDetails: text("response_details"),
  responseDate: timestamp("response_date"),
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClarificationSchema = createInsertSchema(clarifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stageUpdatedAt: true,
  responseDate: true,
});
export type InsertClarification = z.infer<typeof insertClarificationSchema>;
export type Clarification = typeof clarifications.$inferSelect;

// Clarification history for stage tracking
export const clarificationHistory = pgTable("clarification_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clarificationId: integer("clarification_id").references(() => clarifications.id).notNull(),
  fromStage: varchar("from_stage"),
  toStage: varchar("to_stage").notNull(),
  changedBy: integer("changed_by").references(() => teamMembers.id).notNull(),
  note: text("note"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertClarificationHistorySchema = createInsertSchema(clarificationHistory).omit({
  id: true,
  timestamp: true,
});
export type InsertClarificationHistory = z.infer<typeof insertClarificationHistorySchema>;
export type ClarificationHistory = typeof clarificationHistory.$inferSelect;

// Relations for clarifications
export const clarificationsRelations = relations(clarifications, ({ one, many }) => ({
  tender: one(tenders, {
    fields: [clarifications.tenderId],
    references: [tenders.id],
  }),
  assignee: one(teamMembers, {
    fields: [clarifications.assignedTo],
    references: [teamMembers.id],
    relationName: "clarificationAssignee",
  }),
  creator: one(teamMembers, {
    fields: [clarifications.createdBy],
    references: [teamMembers.id],
    relationName: "clarificationCreator",
  }),
  history: many(clarificationHistory),
}));

export const clarificationHistoryRelations = relations(clarificationHistory, ({ one }) => ({
  clarification: one(clarifications, {
    fields: [clarificationHistory.clarificationId],
    references: [clarifications.id],
  }),
  changedByMember: one(teamMembers, {
    fields: [clarificationHistory.changedBy],
    references: [teamMembers.id],
  }),
}));

// Extended clarification type with relations
export type ClarificationWithDetails = Clarification & {
  assignee?: TeamMember;
  creator?: TeamMember;
  tender?: Tender;
  history?: (ClarificationHistory & { changedByMember?: TeamMember })[];
};

// Human-readable stage labels for clarifications
export const clarificationStageLabels: Record<ClarificationStage, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  responded: 'Responded',
  closed: 'Closed',
};

// ===============================
// UNIFIED TENDER DETAILS TYPE
// ===============================

// Complete tender activity overview for unified details view
export type TenderActivityOverview = {
  tender?: Tender;
  referenceId: string;
  
  // Assignments
  assignments?: (TenderAssignment & {
    assignee?: TeamMember;
    assigner?: TeamMember;
  })[];
  
  // Results
  results?: TenderResultWithHistory[];
  
  // Presentations
  presentations?: PresentationWithDetails[];
  
  // Clarifications
  clarifications?: ClarificationWithDetails[];
  
  // Submissions
  submissions?: (BiddingSubmission & {
    submitter?: TeamMember;
  })[];
};
