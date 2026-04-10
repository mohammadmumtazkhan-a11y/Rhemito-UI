import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // 'fixed' | 'percentage'
  value: text("value").notNull(), // using text for numeric precision in sqlite/pg commonality, or integer * 100
  minAmount: text("min_amount").default("0"),
  currency: text("currency").default("GBP"),
  status: text("status").default("active"),
  usageCount: text("usage_count").default("0"),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).pick({
  code: true,
  type: true,
  value: true,
  minAmount: true,
  currency: true,
  status: true,
});

export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;

// ─── Auth Users Table ───────────────────────────────────────────────
export const authUsers = pgTable("auth_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  accountType: text("account_type").notNull().default("individual"), // "individual" | "business"
  country: text("country").notNull(),
  // Individual fields
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  mobileCode: text("mobile_code"),
  mobileNumber: text("mobile_number"),
  // Business fields
  businessName: text("business_name"),
  businessRegNo: text("business_reg_no"),
  businessPhoneCode: text("business_phone_code"),
  businessPhoneNumber: text("business_phone_number"),
  directorName: text("director_name"),
  // Status
  status: text("status").notNull().default("pending"), // "pending" | "active" | "blocked"
  createdAt: timestamp("created_at").defaultNow(),
});

export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = typeof authUsers.$inferInsert;

// ─── OTP Codes Table ────────────────────────────────────────────────
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type OtpCode = typeof otpCodes.$inferSelect;

// ─── Zod Validation Schemas ─────────────────────────────────────────

export const emailCheckSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
  .regex(/[0-9]/, "Password must contain at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const individualRegSchema = z.object({
  email: z.string().email(),
  accountType: z.literal("individual"),
  country: z.string().min(1, "Country is required"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  middleName: z.string().optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  mobileCode: z.string().min(1, "Country code is required"),
  mobileNumber: z.string().min(7, "Phone number must be at least 7 digits").max(15),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const businessStep1Schema = z.object({
  email: z.string().email(),
  accountType: z.literal("business"),
  country: z.string().min(1, "Country is required"),
  businessName: z.string().min(1, "Business name is required"),
  businessRegNo: z.string().min(1, "Business registration number is required"),
  businessPhoneCode: z.string().min(1, "Country code is required"),
  businessPhoneNumber: z.string().min(7, "Phone number must be at least 7 digits").max(15),
});

export const businessStep2Schema = z.object({
  directorName: z.string().min(1, "Director is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  mobileCode: z.string().min(1, "Country code is required"),
  mobileNumber: z.string().min(7, "Phone number must be at least 7 digits").max(15),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "OTP must be 6 digits"),
});

// ─── Notification Event Types ────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  "payment_received",
  "awaiting_payment",
  "payment_failed",
  "transaction_complete",
  "transaction_failed",
  "transaction_cancelled_customer",
  "transaction_cancelled_admin",
  "transaction_cancelled_timeout",
  "auto_cancel_reminder_15",
  "auto_cancel_reminder_5",
  "refund_processed",
  "under_review",
  "review_complete",
  "document_required",
  "document_received",
  "maintenance_scheduled",
  "maintenance_complete",
  "preferences_updated",
  // Story 16 — funding matched to an existing Awaiting Payment transaction
  "funding_received_matched",
  // Story 17 — funding received without a matching transaction (unallocated balance)
  "funding_received_unmatched",
  // Story 18a — funding allocated to a single transaction
  "funding_allocated_single",
  // Story 18b — funding allocated across multiple transactions
  "funding_allocated_multi",
  // Story 18c — partial allocation, additional payment required
  "funding_allocated_partial",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "email", "web_push", "mobile_push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ─── Notifications Table ─────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  isRead: boolean("is_read").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  archivedAt: timestamp("archived_at"),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export const insertNotificationSchema = createInsertSchema(notifications);

// ─── Notification Preferences Table ──────────────────────────────────────────
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  webPushEnabled: boolean("web_push_enabled").notNull().default(false),
  mobilePushEnabled: boolean("mobile_push_enabled").notNull().default(false),
  paymentEvents: boolean("payment_events").notNull().default(true),
  transactionEvents: boolean("transaction_events").notNull().default(true),
  refundEvents: boolean("refund_events").notNull().default(true),
  kycEvents: boolean("kyc_events").notNull().default(true),
  securityEvents: boolean("security_events").notNull().default(true),
  maintenanceEvents: boolean("maintenance_events").notNull().default(true),
  marketingEvents: boolean("marketing_events").notNull().default(false),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences);

// ─── Notification Delivery Log Table ─────────────────────────────────────────
export const notificationDeliveryLog = pgTable("notification_delivery_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("pending"),
  attemptCount: text("attempt_count").notNull().default("0"),
  lastAttemptAt: timestamp("last_attempt_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NotificationDeliveryLog = typeof notificationDeliveryLog.$inferSelect;
export type InsertNotificationDeliveryLog = typeof notificationDeliveryLog.$inferInsert;
export const insertNotificationDeliveryLogSchema = createInsertSchema(notificationDeliveryLog);
