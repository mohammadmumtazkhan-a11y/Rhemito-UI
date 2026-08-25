import {
  type User,
  type InsertUser,
  type PromoCode,
  type InsertPromoCode,
  type AuthUser,
  type InsertAuthUser,
  type OtpCode,
  type Invoice,
  type InvoiceDocument,
  type InvoiceEvent,
  type ClientEmail,
  type PayoutAccountRecord,
  type MoneyRequest,
  type PaymentAttempt,
  type RequestRenewalRequest,
  type LedgerEntry,
  type WebhookEvent,
  type EmailDelivery,
  DEMO_PAYER_CREDENTIALS,
} from "@shared/schema";
import {
  type GroupPayCampaign,
  type GroupPayContribution,
} from "@shared/groupPay";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { deriveInvoiceStatus, clientDisplayName } from "@shared/invoice-logic";

export interface InvoiceListQuery {
  senderId: string;
  search?: string; // invoice number, client name or client email
  status?: string; // derived display status filter
  sentFrom?: string; // YYYY-MM-DD
  sentTo?: string; // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

export interface InvoiceListResult {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
}

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
  updateAuthUserPassword(email: string, hashedPassword: string): Promise<AuthUser | undefined>;

  // OTP
  createOtp(email: string, code: string, expiresAt: Date): Promise<OtpCode>;
  // Development convenience: id of the most recently created auth user.
  getMostRecentAuthUserIdForDev(): Promise<string | null>;
  getValidOtp(email: string, code: string): Promise<OtpCode | undefined>;
  invalidateOtps(email: string): Promise<void>;
  markOtpUsed(id: string): Promise<void>;

  // Invoices
  createInvoice(invoice: Invoice): Promise<Invoice>;
  getInvoiceById(id: string): Promise<Invoice | undefined>;
  getInvoiceByTokenHash(tokenHash: string): Promise<Invoice | undefined>;
  getInvoiceByIdempotencyKey(senderId: string, idempotencyKey: string): Promise<Invoice | undefined>;
  updateInvoice(id: string, patch: Partial<Invoice>): Promise<Invoice | undefined>;
  listInvoices(query: InvoiceListQuery): Promise<InvoiceListResult>;
  listAllInvoicesRaw(): Promise<Invoice[]>;
  nextInvoiceSequence(): Promise<number>;

  // Invoice Documents
  createInvoiceDocument(doc: InvoiceDocument): Promise<InvoiceDocument>;
  getInvoiceDocument(id: string): Promise<InvoiceDocument | undefined>;
  associateInvoiceDocument(id: string): Promise<void>;
  deleteInvoiceDocument(id: string): Promise<void>;
  listExpiredTempDocuments(): Promise<InvoiceDocument[]>;

  // Invoice Events
  addInvoiceEvent(event: InvoiceEvent): Promise<InvoiceEvent>;
  listInvoiceEvents(invoiceId: string): Promise<InvoiceEvent[]>;

  // Client Emails
  addClientEmail(email: ClientEmail): Promise<ClientEmail>;
  getClientEmailByDedupeKey(dedupeKey: string): Promise<ClientEmail | undefined>;
  listClientEmails(invoiceId: string): Promise<ClientEmail[]>;

  // Payment Requests (Request Money)
  createPayoutAccount(account: PayoutAccountRecord): Promise<PayoutAccountRecord>;
  getPayoutAccountById(id: string): Promise<PayoutAccountRecord | undefined>;
  listPayoutAccountsByOwner(ownerId: string): Promise<PayoutAccountRecord[]>;
  updatePayoutAccount(id: string, patch: Partial<PayoutAccountRecord>): Promise<PayoutAccountRecord | undefined>;

  createMoneyRequest(request: MoneyRequest): Promise<MoneyRequest>;
  getMoneyRequestById(id: string): Promise<MoneyRequest | undefined>;
  getMoneyRequestByTokenHash(tokenHash: string): Promise<MoneyRequest | undefined>;
  getMoneyRequestByEmailTokenHash(emailTokenHash: string): Promise<MoneyRequest | undefined>;
  getMoneyRequestByIdempotencyKey(requesterId: string, idempotencyKey: string): Promise<MoneyRequest | undefined>;
  updateMoneyRequest(id: string, patch: Partial<MoneyRequest>): Promise<MoneyRequest | undefined>;
  compareAndUpdateMoneyRequest(
    id: string,
    expectedStatuses: string[],
    patch: Partial<MoneyRequest>,
  ): Promise<MoneyRequest | undefined>;
  listMoneyRequests(requesterId: string): Promise<MoneyRequest[]>;
  listAllMoneyRequestsRaw(): Promise<MoneyRequest[]>;
  nextMoneyRequestSequence(): Promise<number>;

  // Payment Attempts & Session Tracking
  addPaymentAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt>;
  getPaymentAttemptById(id: string): Promise<PaymentAttempt | undefined>;
  getPaymentAttemptByReference(ref: string): Promise<PaymentAttempt | undefined>;
  updatePaymentAttempt(id: string, patch: Partial<PaymentAttempt>): Promise<PaymentAttempt | undefined>;
  listPaymentAttempts(requestId: string): Promise<PaymentAttempt[]>;

  // Renewal Requests (for expired requests)
  addRenewalRequest(req: RequestRenewalRequest): Promise<RequestRenewalRequest>;
  listRenewalRequests(requestId: string): Promise<RequestRenewalRequest[]>;

  addLedgerEntry(entry: LedgerEntry): Promise<LedgerEntry>;
  listLedgerEntries(requestId: string): Promise<LedgerEntry[]>;
  hasLedgerEntry(idempotencyKey: string): Promise<boolean>;

  getWebhookEvent(provider: string, eventId: string): Promise<WebhookEvent | undefined>;
  addWebhookEvent(event: WebhookEvent): Promise<WebhookEvent>;

  addEmailDelivery(delivery: EmailDelivery): Promise<EmailDelivery>;
  getEmailDeliveryByDedupeKey(dedupeKey: string): Promise<EmailDelivery | undefined>;
  updateEmailDelivery(id: string, patch: Partial<EmailDelivery>): Promise<EmailDelivery | undefined>;
  listEmailDeliveries(requestId: string): Promise<EmailDelivery[]>;

  // GroupPay funding campaigns (server-owned so share links work cross-browser)
  createGroupPayCampaign(campaign: GroupPayCampaign): Promise<GroupPayCampaign>;
  getGroupPayCampaignById(id: string): Promise<GroupPayCampaign | undefined>;
  listGroupPayCampaignsByOwner(ownerId: string): Promise<GroupPayCampaign[]>;
  updateGroupPayCampaign(
    id: string,
    patch: Partial<Omit<GroupPayCampaign, "id">>,
  ): Promise<GroupPayCampaign | undefined>;
  deleteGroupPayCampaign(id: string): Promise<boolean>;
  addGroupPayContribution(contribution: GroupPayContribution): Promise<GroupPayContribution>;
  getGroupPayContributionById(id: string): Promise<GroupPayContribution | undefined>;
  updateGroupPayContribution(
    id: string,
    patch: Partial<Omit<GroupPayContribution, "id">>,
  ): Promise<GroupPayContribution | undefined>;
  listGroupPayContributions(campaignId: string): Promise<GroupPayContribution[]>;
}

export class MemStorage implements IStorage {
  /**
   * Development-only hydration + write-through persistence for login
   * continuity across dev-server restarts (see server/devPersistence.ts).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hydrateForDev(
    users: any[],
    otps: any[],
    groupPayCampaigns: any[] = [],
    groupPayContributions: any[] = [],
  ): void {
    // Demo seeds are re-created at boot with current credentials — never let a
    // stale dev snapshot resurrect old demo accounts over them.
    const demoEmails = new Set(["demo@rhemito.com", DEMO_PAYER_CREDENTIALS.email]);
    for (const u of users) {
      if (u?.id === "user_123" || u?.id === "user_demo_payer" || demoEmails.has(String(u?.email ?? "").toLowerCase())) continue;
      this.authUsersMap.set(u.id, u as AuthUser);
    }
    for (const o of otps) this.otpCodesMap.set(o.id, o as OtpCode);
    // Same rule for the seeded demo campaigns.
    const demoCampaignIds = new Set(["demo-campaign-1", "demo-campaign-2"]);
    for (const c of groupPayCampaigns) {
      if (!c?.id || demoCampaignIds.has(String(c.id))) continue;
      this.groupPayCampaignsMap.set(c.id, c as GroupPayCampaign);
    }
    for (const ct of groupPayContributions) {
      if (!ct?.id) continue;
      this.groupPayContributionsMap.set(ct.id, ct as GroupPayContribution);
    }
  }

  private persistDevSnapshot(): void {
    if (process.env.NODE_ENV === "production") return;
    import("./devPersistence").then(({ queuePersist }) => {
      queuePersist(() => ({
        authUsers: Array.from(this.authUsersMap.values()).map((u) => ({ ...u })) as unknown as Array<Record<string, unknown>>,
        otpCodes: Array.from(this.otpCodesMap.values()).map((o) => ({ ...o })) as unknown as Array<Record<string, unknown>>,
        groupPayCampaigns: Array.from(this.groupPayCampaignsMap.values()).map((c) => ({ ...c })) as unknown as Array<Record<string, unknown>>,
        groupPayContributions: Array.from(this.groupPayContributionsMap.values()).map((c) => ({ ...c })) as unknown as Array<Record<string, unknown>>,
        sessions: {},
      }));
    }).catch(() => { /* persistence is best-effort in dev */ });
  }
  private users: Map<string, User>;
  private promoCodes: Map<string, PromoCode>;
  private authUsersMap: Map<string, AuthUser>;
  private otpCodesMap: Map<string, OtpCode>;

  // Send Invoice MVP1
  private invoicesMap: Map<string, Invoice>;
  private invoicesByTokenHash: Map<string, string>; // tokenHash → invoice id
  private invoicesByIdempotency: Map<string, string>; // `${senderId}:${key}` → invoice id
  private invoiceDocumentsMap: Map<string, InvoiceDocument>;
  private invoiceEventsMap: Map<string, InvoiceEvent>;
  private clientEmailsMap: Map<string, ClientEmail>;
  private invoiceSequence: number;

  // Request Money
  private payoutAccountsMap: Map<string, PayoutAccountRecord>;
  private moneyRequestsMap: Map<string, MoneyRequest>;
  private moneyRequestsByTokenHash: Map<string, string>;
  private moneyRequestsByEmailTokenHash: Map<string, string>;
  private moneyRequestsByIdempotency: Map<string, string>;
  private paymentAttemptsMap: Map<string, PaymentAttempt>;
  private renewalRequestsMap: Map<string, RequestRenewalRequest>;
  private ledgerEntriesMap: Map<string, LedgerEntry>;
  private webhookEventsMap: Map<string, WebhookEvent>;
  private emailDeliveriesMap: Map<string, EmailDelivery>;
  private moneyRequestSequence: number;

  // GroupPay funding campaigns
  private groupPayCampaignsMap: Map<string, GroupPayCampaign>;
  private groupPayContributionsMap: Map<string, GroupPayContribution>;

  constructor() {
    this.users = new Map();
    this.promoCodes = new Map();
    this.authUsersMap = new Map();
    this.otpCodesMap = new Map();
    this.invoicesMap = new Map();
    this.invoicesByTokenHash = new Map();
    this.invoicesByIdempotency = new Map();
    this.invoiceDocumentsMap = new Map();
    this.invoiceEventsMap = new Map();
    this.clientEmailsMap = new Map();
    this.invoiceSequence = 0;
    this.payoutAccountsMap = new Map();
    this.moneyRequestsMap = new Map();
    this.moneyRequestsByTokenHash = new Map();
    this.moneyRequestsByEmailTokenHash = new Map();
    this.moneyRequestsByIdempotency = new Map();
    this.paymentAttemptsMap = new Map();
    this.renewalRequestsMap = new Map();
    this.ledgerEntriesMap = new Map();
    this.webhookEventsMap = new Map();
    this.emailDeliveriesMap = new Map();
    this.moneyRequestSequence = 0;
    this.groupPayCampaignsMap = new Map();
    this.groupPayContributionsMap = new Map();

    // Seed Mock Promo Code & Demo User
    this.seedPromoCodes();
    this.seedDemoUser();
    this.seedDemoCampaigns();
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

  private seedDemoUser() {
    const demoUser: AuthUser = {
      id: "user_123",
      email: "demo@rhemito.com",
      // Real bcrypt hash so the demo account can pass password verification
      // (e.g. the checkout step-up) with the shared demo password.
      password: bcrypt.hashSync(DEMO_PAYER_CREDENTIALS.password, 12),
      accountType: "individual",
      country: "GB",
      firstName: "John",
      middleName: null,
      lastName: "Doe",
      dateOfBirth: "1990-01-01",
      gender: "male",
      mobileCode: "+44",
      mobileNumber: "7700900123",
      businessName: null,
      businessRegNo: null,
      businessPhoneCode: null,
      businessPhoneNumber: null,
      directorName: null,
      status: "active",
      kycStatus: "passed",
      createdAt: new Date(),
    };
    this.authUsersMap.set("user_123", demoUser);

    const defaultAccId = "acc_demo_gbp";
    this.payoutAccountsMap.set(defaultAccId, {
      id: defaultAccId,
      ownerId: "user_123",
      holderName: "John Doe",
      country: "GB",
      currency: "GBP",
      bankName: "Barclays Bank",
      accountNumber: "12345678",
      routingNumber: "20-00-00",
      verificationStatus: "verified",
      isDefault: true,
      createdAt: new Date(),
      verifiedAt: new Date(),
    });

    // Registered demo payer for the public checkout identification flow — the
    // credentials are displayed on the checkout screen (prototype only). The
    // password is stored as a real bcrypt hash so /api/auth/login accepts it.
    this.authUsersMap.set("user_demo_payer", {
      ...demoUser,
      id: "user_demo_payer",
      email: DEMO_PAYER_CREDENTIALS.email,
      password: bcrypt.hashSync(DEMO_PAYER_CREDENTIALS.password, 12),
      firstName: "Demo",
      lastName: "Payer",
    });
  }

  /**
   * Demo funding campaigns — same seed content the GroupPay dashboard used to
   * get from client-side mock data, so /contribute/demo-campaign-* links and
   * the seeded dashboard cards keep working from any browser.
   */
  private seedDemoCampaigns() {
    this.groupPayCampaignsMap.set("demo-campaign-1", {
      id: "demo-campaign-1",
      ownerId: "user_123",
      name: "Office Birthday Collection",
      targetAmount: 500,
      currency: "GBP",
      description: "Collecting funds for Jane's surprise birthday party. Let's make it special!",
      bankAccountId: "2",
      bankAccountName: "John Doe - Barclays",
      status: "active",
      createdAt: new Date("2026-01-20"),
      creatorName: "John Doe",
    });
    this.groupPayCampaignsMap.set("demo-campaign-2", {
      id: "demo-campaign-2",
      ownerId: "user_123",
      name: "Team Trip Fund",
      targetAmount: 2000,
      currency: "GBP",
      description: "Saving up for our annual team outing. Everyone chip in what you can!",
      bankAccountId: "2",
      bankAccountName: "John Doe - Barclays",
      status: "active",
      createdAt: new Date("2026-01-15"),
      creatorName: "John Doe",
    });
    this.groupPayContributionsMap.set("c1", {
      id: "c1",
      campaignId: "demo-campaign-1",
      name: "Alice Smith",
      email: "alice@example.com",
      amount: 50,
      paymentDate: new Date("2026-01-21T10:30:00"),
      status: "completed",
    });
    this.groupPayContributionsMap.set("c2", {
      id: "c2",
      campaignId: "demo-campaign-1",
      name: "Bob Johnson",
      email: "bob@example.com",
      amount: 75,
      paymentDate: new Date("2026-01-22T14:15:00"),
      status: "completed",
    });
    this.groupPayContributionsMap.set("c3", {
      id: "c3",
      campaignId: "demo-campaign-2",
      name: "Charlie Brown",
      email: "charlie@example.com",
      amount: 100,
      paymentDate: new Date("2026-01-18T09:00:00"),
      status: "completed",
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
      kycStatus: "pending",
      createdAt: new Date(),
    };
    this.authUsersMap.set(id, user);
    this.persistDevSnapshot();
    return user;
  }

  async activateUser(email: string): Promise<void> {
    const user = await this.getAuthUserByEmail(email);
    if (user) {
      // The in-app registration journey collects and verifies identity details
      // (email OTP + personal details), which the product treats as passing
      // mini-KYC. Enhanced KYC remains an external/provider concern.
      this.authUsersMap.set(user.id, { ...user, status: "active", kycStatus: "passed" });
      this.persistDevSnapshot();
    }
  }

  async updateAuthUserPassword(email: string, hashedPassword: string): Promise<AuthUser | undefined> {
    const user = await this.getAuthUserByEmail(email);
    if (!user) return undefined;
    this.authUsersMap.set(user.id, { ...user, password: hashedPassword });
    this.persistDevSnapshot();
    return this.authUsersMap.get(user.id);
  }

  async getMostRecentAuthUserIdForDev(): Promise<string | null> {
    const users = Array.from(this.authUsersMap.values());
    if (users.length === 0) return null;
    const mostRecent = users
      .filter((u) => u.status === "active")
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    return mostRecent?.id ?? null;
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
    this.persistDevSnapshot();
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
    for (const [id, otp] of Array.from(this.otpCodesMap.entries())) {
      if (otp.email.toLowerCase() === email.toLowerCase() && !otp.used) {
        this.otpCodesMap.set(id, { ...otp, used: true });
      }
    }
  }

  async markOtpUsed(id: string): Promise<void> {
    const otp = this.otpCodesMap.get(id);
    if (otp) {
      this.otpCodesMap.set(id, { ...otp, used: true });
      this.persistDevSnapshot();
    }
  }

  // ─── Invoices ──────────────────────────────────────────────────

  async createInvoice(invoice: Invoice): Promise<Invoice> {
    this.invoicesMap.set(invoice.id, invoice);
    this.invoicesByTokenHash.set(invoice.tokenHash, invoice.id);
    if (invoice.idempotencyKey) {
      this.invoicesByIdempotency.set(`${invoice.senderId}:${invoice.idempotencyKey}`, invoice.id);
    }
    return invoice;
  }

  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    return this.invoicesMap.get(id);
  }

  async getInvoiceByTokenHash(tokenHash: string): Promise<Invoice | undefined> {
    const id = this.invoicesByTokenHash.get(tokenHash);
    return id ? this.invoicesMap.get(id) : undefined;
  }

  async getInvoiceByIdempotencyKey(
    senderId: string,
    idempotencyKey: string,
  ): Promise<Invoice | undefined> {
    const id = this.invoicesByIdempotency.get(`${senderId}:${idempotencyKey}`);
    return id ? this.invoicesMap.get(id) : undefined;
  }

  async updateInvoice(id: string, patch: Partial<Invoice>): Promise<Invoice | undefined> {
    const existing = this.invoicesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.invoicesMap.set(id, updated);
    return updated;
  }

  async listInvoices(query: InvoiceListQuery): Promise<InvoiceListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const now = new Date();
    const search = query.search?.trim().toLowerCase();

    let all = Array.from(this.invoicesMap.values())
      .filter((inv) => inv.senderId === query.senderId)
      .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));

    if (search) {
      all = all.filter((inv) => {
        const name = clientDisplayName(inv).toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(search) ||
          name.includes(search) ||
          inv.clientEmail.toLowerCase().includes(search)
        );
      });
    }

    if (query.status && query.status !== "all") {
      all = all.filter((inv) => deriveInvoiceStatus(inv, now) === query.status);
    }

    if (query.sentFrom) {
      const fromStart = new Date(`${query.sentFrom}T00:00:00.000Z`);
      all = all.filter((inv) => (inv.sentAt?.getTime() ?? 0) >= fromStart.getTime());
    }
    if (query.sentTo) {
      const toEnd = new Date(`${query.sentTo}T23:59:59.999Z`);
      all = all.filter((inv) => (inv.sentAt?.getTime() ?? 0) <= toEnd.getTime());
    }

    const total = all.length;
    const offset = (page - 1) * pageSize;
    return { invoices: all.slice(offset, offset + pageSize), total, page, pageSize };
  }

  async nextInvoiceSequence(): Promise<number> {
    this.invoiceSequence += 1;
    return this.invoiceSequence;
  }

  async listAllInvoicesRaw(): Promise<Invoice[]> {
    return Array.from(this.invoicesMap.values());
  }

  // ─── Invoice Documents ─────────────────────────────────────────

  async createInvoiceDocument(doc: InvoiceDocument): Promise<InvoiceDocument> {
    this.invoiceDocumentsMap.set(doc.id, doc);
    return doc;
  }

  async getInvoiceDocument(id: string): Promise<InvoiceDocument | undefined> {
    return this.invoiceDocumentsMap.get(id);
  }

  async associateInvoiceDocument(id: string): Promise<void> {
    const doc = this.invoiceDocumentsMap.get(id);
    if (doc) {
      this.invoiceDocumentsMap.set(id, { ...doc, status: "associated", expiresAt: null });
    }
  }

  async deleteInvoiceDocument(id: string): Promise<void> {
    this.invoiceDocumentsMap.delete(id);
  }

  async listExpiredTempDocuments(): Promise<InvoiceDocument[]> {
    const now = Date.now();
    return Array.from(this.invoiceDocumentsMap.values()).filter(
      (doc) => doc.status === "temp" && doc.expiresAt !== null && doc.expiresAt.getTime() < now,
    );
  }

  // ─── Invoice Events ────────────────────────────────────────────

  async addInvoiceEvent(event: InvoiceEvent): Promise<InvoiceEvent> {
    this.invoiceEventsMap.set(event.id, event);
    return event;
  }

  async listInvoiceEvents(invoiceId: string): Promise<InvoiceEvent[]> {
    return Array.from(this.invoiceEventsMap.values())
      .filter((event) => event.invoiceId === invoiceId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  // ─── Client Emails ─────────────────────────────────────────────

  async addClientEmail(email: ClientEmail): Promise<ClientEmail> {
    this.clientEmailsMap.set(email.id, email);
    return email;
  }

  async getClientEmailByDedupeKey(dedupeKey: string): Promise<ClientEmail | undefined> {
    return Array.from(this.clientEmailsMap.values()).find((e) => e.dedupeKey === dedupeKey);
  }

  async listClientEmails(invoiceId: string): Promise<ClientEmail[]> {
    return Array.from(this.clientEmailsMap.values())
      .filter((e) => e.invoiceId === invoiceId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  // ─── Request Money: payout accounts ─────────────────────────────

  async createPayoutAccount(account: PayoutAccountRecord): Promise<PayoutAccountRecord> {
    this.payoutAccountsMap.set(account.id, account);
    return account;
  }

  async getPayoutAccountById(id: string): Promise<PayoutAccountRecord | undefined> {
    return this.payoutAccountsMap.get(id);
  }

  async listPayoutAccountsByOwner(ownerId: string): Promise<PayoutAccountRecord[]> {
    return Array.from(this.payoutAccountsMap.values())
      .filter((a) => a.ownerId === ownerId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  async updatePayoutAccount(
    id: string,
    patch: Partial<PayoutAccountRecord>,
  ): Promise<PayoutAccountRecord | undefined> {
    const existing = this.payoutAccountsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.payoutAccountsMap.set(id, updated);
    return updated;
  }

  // ─── Request Money: money requests ──────────────────────────────

  async createMoneyRequest(request: MoneyRequest): Promise<MoneyRequest> {
    this.moneyRequestsMap.set(request.id, request);
    this.moneyRequestsByTokenHash.set(request.tokenHash, request.id);
    if (request.emailTokenHash) {
      this.moneyRequestsByEmailTokenHash.set(request.emailTokenHash, request.id);
    }
    if (request.idempotencyKey) {
      this.moneyRequestsByIdempotency.set(`${request.requesterId}:${request.idempotencyKey}`, request.id);
    }
    return request;
  }

  async getMoneyRequestById(id: string): Promise<MoneyRequest | undefined> {
    return this.moneyRequestsMap.get(id);
  }

  async getMoneyRequestByTokenHash(tokenHash: string): Promise<MoneyRequest | undefined> {
    const id = this.moneyRequestsByTokenHash.get(tokenHash);
    return id ? this.moneyRequestsMap.get(id) : undefined;
  }

  async getMoneyRequestByEmailTokenHash(emailTokenHash: string): Promise<MoneyRequest | undefined> {
    const id = this.moneyRequestsByEmailTokenHash.get(emailTokenHash);
    return id ? this.moneyRequestsMap.get(id) : undefined;
  }

  async getMoneyRequestByIdempotencyKey(
    requesterId: string,
    idempotencyKey: string,
  ): Promise<MoneyRequest | undefined> {
    const id = this.moneyRequestsByIdempotency.get(`${requesterId}:${idempotencyKey}`);
    return id ? this.moneyRequestsMap.get(id) : undefined;
  }

  async updateMoneyRequest(id: string, patch: Partial<MoneyRequest>): Promise<MoneyRequest | undefined> {
    const existing = this.moneyRequestsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.moneyRequestsMap.set(id, updated);
    if (patch.tokenHash) {
      this.moneyRequestsByTokenHash.set(patch.tokenHash, id);
    }
    if (patch.emailTokenHash) {
      this.moneyRequestsByEmailTokenHash.set(patch.emailTokenHash, id);
    }
    return updated;
  }

  async compareAndUpdateMoneyRequest(
    id: string,
    expectedStatuses: string[],
    patch: Partial<MoneyRequest>,
  ): Promise<MoneyRequest | undefined> {
    // Keep the check and write in one synchronous critical section. A database
    // implementation must provide the same semantics with a conditional update.
    const existing = this.moneyRequestsMap.get(id);
    if (!existing || !expectedStatuses.includes(existing.status)) return undefined;
    const updated = { ...existing, ...patch };
    this.moneyRequestsMap.set(id, updated);
    return updated;
  }

  async listMoneyRequests(requesterId: string): Promise<MoneyRequest[]> {
    return Array.from(this.moneyRequestsMap.values())
      .filter((r) => r.requesterId === requesterId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async listAllMoneyRequestsRaw(): Promise<MoneyRequest[]> {
    return Array.from(this.moneyRequestsMap.values());
  }

  async nextMoneyRequestSequence(): Promise<number> {
    this.moneyRequestSequence += 1;
    return this.moneyRequestSequence;
  }

  // ─── Payment Attempts & Session Tracking ────────────────────────

  async addPaymentAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt> {
    this.paymentAttemptsMap.set(attempt.id, attempt);
    return attempt;
  }

  async getPaymentAttemptById(id: string): Promise<PaymentAttempt | undefined> {
    return this.paymentAttemptsMap.get(id);
  }

  async getPaymentAttemptByReference(ref: string): Promise<PaymentAttempt | undefined> {
    return Array.from(this.paymentAttemptsMap.values()).find((a) => a.paymentReference === ref);
  }

  async updatePaymentAttempt(id: string, patch: Partial<PaymentAttempt>): Promise<PaymentAttempt | undefined> {
    const existing = this.paymentAttemptsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.paymentAttemptsMap.set(id, updated);
    return updated;
  }

  async listPaymentAttempts(requestId: string): Promise<PaymentAttempt[]> {
    return Array.from(this.paymentAttemptsMap.values())
      .filter((a) => a.requestId === requestId)
      .sort((a, b) => (b.sessionStartedAt?.getTime() ?? 0) - (a.sessionStartedAt?.getTime() ?? 0));
  }

  // ─── Renewal Requests ───────────────────────────────────────────

  async addRenewalRequest(req: RequestRenewalRequest): Promise<RequestRenewalRequest> {
    this.renewalRequestsMap.set(req.id, req);
    return req;
  }

  async listRenewalRequests(requestId: string): Promise<RequestRenewalRequest[]> {
    return Array.from(this.renewalRequestsMap.values())
      .filter((r) => r.requestId === requestId)
      .sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
  }

  // ─── Request Money: ledger ───────────────────────────────────────

  async addLedgerEntry(entry: LedgerEntry): Promise<LedgerEntry> {
    this.ledgerEntriesMap.set(entry.id, entry);
    return entry;
  }

  async listLedgerEntries(requestId: string): Promise<LedgerEntry[]> {
    return Array.from(this.ledgerEntriesMap.values())
      .filter((e) => e.requestId === requestId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  async hasLedgerEntry(idempotencyKey: string): Promise<boolean> {
    return Array.from(this.ledgerEntriesMap.values()).some((e) => e.idempotencyKey === idempotencyKey);
  }

  // ─── Request Money: webhook idempotency ──────────────────────────

  async getWebhookEvent(provider: string, eventId: string): Promise<WebhookEvent | undefined> {
    return Array.from(this.webhookEventsMap.values()).find(
      (e) => e.provider === provider && e.eventId === eventId,
    );
  }

  async addWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
    this.webhookEventsMap.set(event.id, event);
    return event;
  }

  // ─── Request Money: email deliveries ─────────────────────────────

  async addEmailDelivery(delivery: EmailDelivery): Promise<EmailDelivery> {
    this.emailDeliveriesMap.set(delivery.id, delivery);
    return delivery;
  }

  async getEmailDeliveryByDedupeKey(dedupeKey: string): Promise<EmailDelivery | undefined> {
    return Array.from(this.emailDeliveriesMap.values()).find((e) => e.dedupeKey === dedupeKey);
  }

  async updateEmailDelivery(id: string, patch: Partial<EmailDelivery>): Promise<EmailDelivery | undefined> {
    const existing = this.emailDeliveriesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.emailDeliveriesMap.set(id, updated);
    return updated;
  }

  async listEmailDeliveries(requestId: string): Promise<EmailDelivery[]> {
    return Array.from(this.emailDeliveriesMap.values())
      .filter((e) => e.requestId === requestId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  // ─── GroupPay funding campaigns ──────────────────────────────────

  async createGroupPayCampaign(campaign: GroupPayCampaign): Promise<GroupPayCampaign> {
    this.groupPayCampaignsMap.set(campaign.id, campaign);
    this.persistDevSnapshot();
    return campaign;
  }

  async getGroupPayCampaignById(id: string): Promise<GroupPayCampaign | undefined> {
    return this.groupPayCampaignsMap.get(id);
  }

  async listGroupPayCampaignsByOwner(ownerId: string): Promise<GroupPayCampaign[]> {
    return Array.from(this.groupPayCampaignsMap.values())
      .filter((c) => c.ownerId === ownerId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async updateGroupPayCampaign(
    id: string,
    patch: Partial<Omit<GroupPayCampaign, "id">>,
  ): Promise<GroupPayCampaign | undefined> {
    const existing = this.groupPayCampaignsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.groupPayCampaignsMap.set(id, updated);
    this.persistDevSnapshot();
    return updated;
  }

  async deleteGroupPayCampaign(id: string): Promise<boolean> {
    const deleted = this.groupPayCampaignsMap.delete(id);
    if (deleted) {
      for (const [contributionId, contribution] of Array.from(this.groupPayContributionsMap.entries())) {
        if (contribution.campaignId === id) this.groupPayContributionsMap.delete(contributionId);
      }
      this.persistDevSnapshot();
    }
    return deleted;
  }

  async addGroupPayContribution(contribution: GroupPayContribution): Promise<GroupPayContribution> {
    this.groupPayContributionsMap.set(contribution.id, contribution);
    this.persistDevSnapshot();
    return contribution;
  }

  async getGroupPayContributionById(id: string): Promise<GroupPayContribution | undefined> {
    return this.groupPayContributionsMap.get(id);
  }

  async updateGroupPayContribution(
    id: string,
    patch: Partial<Omit<GroupPayContribution, "id">>,
  ): Promise<GroupPayContribution | undefined> {
    const existing = this.groupPayContributionsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    this.groupPayContributionsMap.set(id, updated);
    this.persistDevSnapshot();
    return updated;
  }

  async listGroupPayContributions(campaignId: string): Promise<GroupPayContribution[]> {
    return Array.from(this.groupPayContributionsMap.values())
      .filter((c) => c.campaignId === campaignId)
      .sort((a, b) => (a.paymentDate?.getTime() ?? 0) - (b.paymentDate?.getTime() ?? 0));
  }
}

export const storage = new MemStorage();
