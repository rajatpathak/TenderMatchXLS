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
