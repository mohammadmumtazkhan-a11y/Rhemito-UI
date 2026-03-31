import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
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
