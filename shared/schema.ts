import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
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
