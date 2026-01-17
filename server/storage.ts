import { type User, type InsertUser, type PromoCode, type InsertPromoCode } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Promo Codes
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  applyPromoCode(code: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private promoCodes: Map<string, PromoCode>;

  constructor() {
    this.users = new Map();
    this.promoCodes = new Map();

    // Seed Mock Promo Code
    this.seedPromoCodes();
  }

  private seedPromoCodes() {
    const id = randomUUID();
    this.promoCodes.set("SAVE20", {
      id,
      code: "SAVE20",
      type: "fixed",
      value: "5.00", // 5 GBP off
      minAmount: "50",
      currency: "GBP",
      status: "active",
      usageCount: "0"
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    return Array.from(this.promoCodes.values()).find(
      (p) => p.code === code
    );
  }

  async applyPromoCode(code: string): Promise<void> {
    const promo = await this.getPromoCode(code);
    if (promo) {
      const count = parseInt(promo.usageCount || "0");
      this.promoCodes.set(promo.code, {
        ...promo,
        usageCount: (count + 1).toString()
      });
    }
  }
}

export const storage = new MemStorage();
