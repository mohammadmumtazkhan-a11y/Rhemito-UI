import { type User, type InsertUser, type PromoCode, type InsertPromoCode, type AuthUser, type InsertAuthUser, type OtpCode } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Promo Codes
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  applyPromoCode(code: string): Promise<void>;

  // Auth Users
  getAuthUserByEmail(email: string): Promise<AuthUser | undefined>;
  getAuthUserById(id: string): Promise<AuthUser | undefined>;
  createAuthUser(user: InsertAuthUser): Promise<AuthUser>;
  activateUser(email: string): Promise<void>;

  // OTP
  createOtp(email: string, code: string, expiresAt: Date): Promise<OtpCode>;
  getValidOtp(email: string, code: string): Promise<OtpCode | undefined>;
  invalidateOtps(email: string): Promise<void>;
  markOtpUsed(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private promoCodes: Map<string, PromoCode>;
  private authUsersMap: Map<string, AuthUser>;
  private otpCodesMap: Map<string, OtpCode>;

  constructor() {
    this.users = new Map();
    this.promoCodes = new Map();
    this.authUsersMap = new Map();
    this.otpCodesMap = new Map();

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

  // ─── Auth Users ─────────────────────────────────────────────────

  async getAuthUserByEmail(email: string): Promise<AuthUser | undefined> {
    return Array.from(this.authUsersMap.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getAuthUserById(id: string): Promise<AuthUser | undefined> {
    return this.authUsersMap.get(id);
  }

  async createAuthUser(userData: InsertAuthUser): Promise<AuthUser> {
    const id = randomUUID();
    const user: AuthUser = {
      id,
      email: userData.email,
      password: userData.password,
      accountType: userData.accountType || "individual",
      country: userData.country,
      firstName: userData.firstName ?? null,
      middleName: userData.middleName ?? null,
      lastName: userData.lastName ?? null,
      dateOfBirth: userData.dateOfBirth ?? null,
      gender: userData.gender ?? null,
      mobileCode: userData.mobileCode ?? null,
      mobileNumber: userData.mobileNumber ?? null,
      businessName: userData.businessName ?? null,
      businessRegNo: userData.businessRegNo ?? null,
      businessPhoneCode: userData.businessPhoneCode ?? null,
      businessPhoneNumber: userData.businessPhoneNumber ?? null,
      directorName: userData.directorName ?? null,
      status: userData.status || "pending",
      createdAt: new Date(),
    };
    this.authUsersMap.set(id, user);
    return user;
  }

  async activateUser(email: string): Promise<void> {
    const user = await this.getAuthUserByEmail(email);
    if (user) {
      this.authUsersMap.set(user.id, { ...user, status: "active" });
    }
  }

  // ─── OTP Codes ──────────────────────────────────────────────────

  async createOtp(email: string, code: string, expiresAt: Date): Promise<OtpCode> {
    const id = randomUUID();
    const otp: OtpCode = {
      id,
      email,
      code,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };
    this.otpCodesMap.set(id, otp);
    return otp;
  }

  async getValidOtp(email: string, code: string): Promise<OtpCode | undefined> {
    const allOtps = Array.from(this.otpCodesMap.values());
    console.log(`[storage] getValidOtp: looking for email="${email}" code="${code}". Total OTPs in memory: ${allOtps.length}`);
    allOtps.forEach((o) => {
      const expired = new Date(o.expiresAt) <= new Date();
      console.log(`  → email="${o.email}" code="${o.code}" used=${o.used} expired=${expired}`);
    });

    // Find the most recent unused, unexpired OTP matching email and code
    const matches = allOtps
      .filter(
        (o) =>
          o.email.toLowerCase() === email.toLowerCase() &&
          o.code === code &&
          !o.used &&
          new Date(o.expiresAt) > new Date()
      )
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    console.log(`[storage] getValidOtp: found ${matches.length} match(es)`);
    return matches[0];
  }

  async invalidateOtps(email: string): Promise<void> {
    for (const [id, otp] of this.otpCodesMap.entries()) {
      if (otp.email.toLowerCase() === email.toLowerCase() && !otp.used) {
        this.otpCodesMap.set(id, { ...otp, used: true });
      }
    }
  }

  async markOtpUsed(id: string): Promise<void> {
    const otp = this.otpCodesMap.get(id);
    if (otp) {
      this.otpCodesMap.set(id, { ...otp, used: true });
    }
  }
}

export const storage = new MemStorage();
