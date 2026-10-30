import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AuthUser } from "@shared/schema";
import { serverConfig } from "../config";

function log(message: string, source = "mito-retail") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export interface MitoRetailCredentials {
  baseUrl: string;
  username: string;
  password: string;
  accessAffiliateNumber: string;
  accessServiceNumber: string;
  apiKey: string;
  webhookSecretKey: string;
  publicKey: string;
  secretKey: string;
}

export interface MitoRetailUserPayload {
  countryIso3: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: "M" | "F";
  legalEntityType: "I" | "B";
  companyNumber: string;
  businessName: string;
  dateOfBirth: string;
  buildingNumber: string;
  buildingName: string;
  subStreet: string;
  street: string;
  addressCity: string;
  addressPostcode: string;
  addressCountryIso3: string;
  birthCountryIso3: string;
}

const ISO2_TO_ISO3: Record<string, string> = {
  GB: "GBR",
  UK: "GBR",
  US: "USA",
  NG: "NGA",
  CA: "CAN",
  GH: "GHA",
  KE: "KEN",
  ZA: "ZAF",
  DE: "DEU",
  FR: "FRA",
  IN: "IND",
  CN: "CHN",
  AE: "ARE",
};

const COUNTRY_DEFAULT_DIAL: Record<string, string> = {
  GBR: "+44",
  USA: "+1",
  NGA: "+234",
  CAN: "+1",
  GHA: "+233",
  KEN: "+254",
  ZAF: "+27",
  DEU: "+49",
  FRA: "+33",
  IND: "+91",
  CHN: "+86",
  ARE: "+971",
};

let cachedCredentials: MitoRetailCredentials | null | undefined;
let cachedToken: { token: string; userId: string; expiresAtMs: number } | null = null;

/** Maps Rhemito user.id and lowercase email -> Mito userId UUID */
const mitoUserIdByRhemitoId = new Map<string, string>();
const mitoUserIdByEmail = new Map<string, string>();
const deletedMitoBeneficiaryIds = new Set<string>();
const deletedMitoBeneficiarySignatures = new Set<string>();

const DELETED_BENEFICIARIES_FILE = path.resolve(
  process.cwd(),
  ".dev-state",
  "mito-deleted-beneficiaries.json",
);

const UPDATED_BENEFICIARIES_FILE = path.resolve(
  process.cwd(),
  ".dev-state",
  "mito-updated-beneficiaries.json",
);

const updatedMitoBeneficiariesById = new Map<string, Partial<MitoBeneficiaryItem>>();

function loadUpdatedBeneficiariesFromDisk(): void {
  try {
    if (!fs.existsSync(UPDATED_BENEFICIARIES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(UPDATED_BENEFICIARIES_FILE, "utf8")) as Record<
      string,
      Partial<MitoBeneficiaryItem>
    >;
    if (raw && typeof raw === "object") {
      for (const [key, val] of Object.entries(raw)) {
        const cleanKey = String(key || "").trim().toUpperCase();
        if (cleanKey && val && typeof val === "object") {
          updatedMitoBeneficiariesById.set(cleanKey, val);
        }
      }
    }
  } catch {
    // ignore disk read errors
  }
}

function saveUpdatedBeneficiariesToDisk(): void {
  try {
    const dir = path.dirname(UPDATED_BENEFICIARIES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized: Record<string, Partial<MitoBeneficiaryItem>> = {};
    updatedMitoBeneficiariesById.forEach((val, key) => {
      serialized[key] = val;
    });
    fs.writeFileSync(UPDATED_BENEFICIARIES_FILE, JSON.stringify(serialized, null, 2), "utf8");
  } catch {
    // ignore disk write errors
  }
}

function makeDeletedSignature(name?: string | null, acctNumber?: string | null): string | null {
  const n = String(name || "").trim().toLowerCase();
  const a = String(acctNumber || "").replace(/\s+/g, "").toLowerCase();
  if (!n && (!a || a === "—")) return null;
  return `${n}|${a === "—" ? "" : a}`;
}

function loadDeletedBeneficiariesFromDisk(): void {
  try {
    if (!fs.existsSync(DELETED_BENEFICIARIES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(DELETED_BENEFICIARIES_FILE, "utf8")) as {
      ids?: string[];
      sigs?: string[];
    };
    if (Array.isArray(raw.ids)) {
      for (const id of raw.ids) {
        const clean = String(id || "").trim().toUpperCase();
        if (clean) deletedMitoBeneficiaryIds.add(clean);
      }
    }
    if (Array.isArray(raw.sigs)) {
      for (const sig of raw.sigs) {
        const clean = String(sig || "").trim().toLowerCase();
        if (clean) deletedMitoBeneficiarySignatures.add(clean);
      }
    }
  } catch {
    // ignore disk read errors
  }
}

function saveDeletedBeneficiariesToDisk(): void {
  try {
    const dir = path.dirname(DELETED_BENEFICIARIES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      DELETED_BENEFICIARIES_FILE,
      JSON.stringify(
        {
          ids: Array.from(deletedMitoBeneficiaryIds),
          sigs: Array.from(deletedMitoBeneficiarySignatures),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // ignore disk write errors
  }
}

function unmarkDeletedBeneficiaryOnServer(params: {
  beneficiaryId?: string | null;
  name?: string | null;
  acctNumber?: string | null;
}): void {
  loadDeletedBeneficiariesFromDisk();
loadUpdatedBeneficiariesFromDisk();
  const idUpper = String(params.beneficiaryId || "").trim().toUpperCase();
  if (idUpper) deletedMitoBeneficiaryIds.delete(idUpper);
  const sig = makeDeletedSignature(params.name, params.acctNumber);
  if (sig) deletedMitoBeneficiarySignatures.delete(sig);
  const nameOnlySig = params.name ? `${String(params.name).trim().toLowerCase()}|` : null;
  if (nameOnlySig) deletedMitoBeneficiarySignatures.delete(nameOnlySig);
  saveDeletedBeneficiariesToDisk();
}

export function getDeletedMitoBeneficiariesSnapshot(): { ids: string[]; sigs: string[] } {
  loadDeletedBeneficiariesFromDisk();
loadUpdatedBeneficiariesFromDisk();
  return {
    ids: Array.from(deletedMitoBeneficiaryIds),
    sigs: Array.from(deletedMitoBeneficiarySignatures),
  };
}

loadDeletedBeneficiariesFromDisk();
loadUpdatedBeneficiariesFromDisk();

export function toCountryIso3(countryRaw: string | null | undefined): string {
  const clean = String(countryRaw ?? "").trim().toUpperCase();
  if (!clean) return "GBR";
  if (clean.length === 3) return clean;
  return ISO2_TO_ISO3[clean] ?? "GBR";
}

export function loadMitoRetailCredentials(): MitoRetailCredentials | null {
  if (cachedCredentials !== undefined) {
    return cachedCredentials;
  }

  const credPath =
    process.env.MITO_RETAIL_CREDENTIALS_FILE ||
    path.resolve(process.cwd(), "docs", "Credentials", "Credentials for Retail API integration.txt");

  let fileText = "";
  try {
    if (fs.existsSync(credPath)) {
      fileText = fs.readFileSync(credPath, "utf8");
    }
  } catch {
    fileText = "";
  }

  const extractField = (label: string): string => {
    const match = fileText.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"));
    return match ? match[1].trim() : "";
  };

  const baseUrl = (process.env.MITO_RETAIL_BASE_URL || "https://furp02-staging.funtechcom.com").replace(/\/+$/, "");
  const username = process.env.MITO_RETAIL_USERNAME || extractField("Username");
  const password = process.env.MITO_RETAIL_PASSWORD || extractField("Password");
  const accessAffiliateNumber = process.env.MITO_RETAIL_AFFILIATE_ID || extractField("Affiliate ID");
  const accessServiceNumber = process.env.MITO_RETAIL_SERVICE_NO || extractField("Service No");
  const apiKey = process.env.MITO_RETAIL_API_KEY || extractField("API Key");
  const webhookSecretKey = process.env.MITO_RETAIL_WEBHOOK_SECRET || extractField("Webhook Secret Key");
  const publicKey = process.env.MITO_RETAIL_PUBLIC_KEY || extractField("Public Key");
  const secretKey = process.env.MITO_RETAIL_SECRET_KEY || extractField("Secret Key");

  if (!username || !password || !accessAffiliateNumber || !accessServiceNumber || !apiKey) {
    cachedCredentials = null;
    return null;
  }

  cachedCredentials = {
    baseUrl,
    username,
    password,
    accessAffiliateNumber,
    accessServiceNumber,
    apiKey,
    webhookSecretKey,
    publicKey,
    secretKey,
  };
  return cachedCredentials;
}

export function isMitoRetailConfigured(): boolean {
  if (process.env.VITEST) return false;
  return loadMitoRetailCredentials() !== null;
}

export async function getMitoRetailToken(forceRefresh = false): Promise<{ token: string; partnerUserId: string }> {
  const creds = loadMitoRetailCredentials();
  if (!creds) {
    throw new Error("Mito Retail credentials are not configured.");
  }

  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAtMs - now > 120_000) {
    return { token: cachedToken.token, partnerUserId: cachedToken.userId };
  }

  const res = await fetch(`${creds.baseUrl}/api/v1/mito/Auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey: creds.apiKey,
    },
    body: JSON.stringify({
      username: creds.username,
      password: creds.password,
      accessServiceNumber: creds.accessServiceNumber,
      accessAffiliateNumber: creds.accessAffiliateNumber,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: { token?: string; userId?: string };
    message?: string;
    code?: number;
  };

  if (!res.ok || !body?.data?.token) {
    throw new Error(body?.message || `Mito Auth/login failed with HTTP ${res.status}`);
  }

  const token = body.data.token;
  const partnerUserId = body.data.userId || "";
  let expiresAtMs = now + 55 * 60 * 1000;
  try {
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { exp?: number };
      if (claims.exp) {
        expiresAtMs = claims.exp * 1000;
      }
    }
  } catch {
    // Keep default 55m TTL if JWT decode fails
  }

  cachedToken = { token, userId: partnerUserId, expiresAtMs };
  return { token, partnerUserId };
}

/**
 * Maps an existing Rhemito AuthUser record (created from SignUpForm or BusinessStep2)
 * directly to Mito's `POST /api/v1/mito/Users` request body without requiring any UI changes.
 */
export function mapAuthUserToMitoCreatePayload(user: AuthUser): MitoRetailUserPayload {
  const countryIso3 = toCountryIso3(user.country);
  const isBusiness = user.accountType === "business";

  const dialCode = (user.mobileCode || user.businessPhoneCode || COUNTRY_DEFAULT_DIAL[countryIso3] || "+44").trim();
  const rawPhone = (user.mobileNumber || user.businessPhoneNumber || "7700900000").replace(/\s+/g, "").replace(/^0+/, "");
  const phoneNumber = rawPhone.startsWith("+") ? rawPhone : `${dialCode}${rawPhone}`;

  let firstName = (user.firstName || "").trim();
  let lastName = (user.lastName || "").trim();
  if (isBusiness && (!firstName || !lastName) && user.directorName) {
    const parts = user.directorName.trim().split(/\s+/);
    firstName = firstName || parts[0] || "Director";
    lastName = lastName || parts.slice(1).join(" ") || "Account";
  }
  firstName = firstName || "Customer";
  lastName = lastName || "User";

  const genderRaw = String(user.gender ?? "").trim().toLowerCase();
  const gender: "M" | "F" = genderRaw === "female" || genderRaw === "f" ? "F" : "M";

  return {
    countryIso3,
    email: user.email.trim().toLowerCase(),
    phoneNumber,
    firstName,
    middleName: (user.middleName || "").trim(),
    lastName,
    gender,
    legalEntityType: isBusiness ? "B" : "I",
    companyNumber: isBusiness ? (user.businessRegNo || "").trim() : "",
    businessName: isBusiness ? (user.businessName || "").trim() : "",
    dateOfBirth: (user.dateOfBirth || "1990-01-01").trim(),
    buildingNumber: "10",
    buildingName: "",
    subStreet: "",
    street: "10 Downing Street",
    addressCity: "London",
    addressPostcode: "EC2A 4DJ",
    addressCountryIso3: countryIso3,
    birthCountryIso3: countryIso3,
  };
}

/**
 * Valid, KYC-approved Mito Sandbox Sender User ID (`5887d933-28da-43e0-b171-33b949218e86`)
 * specified by the user for sending money and beneficiary operations.
 */
export const DEFAULT_MITO_SENDER_USER_ID = (
  process.env.MITO_DEFAULT_SENDER_USER_ID || "5887d933-28da-43e0-b171-33b949218e86"
).trim();

export async function findMitoRetailUserByEmail(email: string): Promise<{ userId: string; email: string } | null> {
  const creds = loadMitoRetailCredentials();
  if (!creds) return null;

  const { token } = await getMitoRetailToken();
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetch(
    `${creds.baseUrl}/api/v1/mito/Users?email=${encodeURIComponent(cleanEmail)}&PageNo=1&PageSize=50`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) return null;

  const body = (await res.json().catch(() => ({}))) as {
    data?: Array<{ userId?: string; id?: string; email?: string }> | { items?: Array<{ userId?: string; id?: string; email?: string }> };
  };
  const list = Array.isArray(body.data) ? body.data : body.data?.items || [];
  const found = list.find(
    (u) => (u.userId || u.id) && String(u.email ?? "").trim().toLowerCase() === cleanEmail,
  );
  const resolvedId = found?.userId || found?.id;
  if (!resolvedId) return null;

  mitoUserIdByEmail.set(cleanEmail, resolvedId);
  return { userId: resolvedId, email: cleanEmail };
}

/**
 * Registers a Rhemito user in Mito Sandbox (`POST /api/v1/mito/Users`).
 * If the email already exists in Mito Sandbox, resolves and links the existing `userId`.
 */
export async function registerOrSyncMitoRetailUser(user: AuthUser): Promise<string | null> {
  if (!isMitoRetailConfigured()) return null;

  const cleanEmail = user.email.trim().toLowerCase();
  const cachedId = mitoUserIdByRhemitoId.get(user.id) || mitoUserIdByEmail.get(cleanEmail);
  if (cachedId) {
    mitoUserIdByRhemitoId.set(user.id, cachedId);
    return cachedId;
  }

  try {
    const creds = loadMitoRetailCredentials()!;
    const { token } = await getMitoRetailToken();
    const payload = mapAuthUserToMitoCreatePayload(user);

    const res = await fetch(`${creds.baseUrl}/api/v1/mito/Users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await res.json().catch(() => ({}))) as {
      data?: { userId?: string };
      message?: string;
    };

    if (res.ok && body?.data?.userId) {
      const mitoUserId = body.data.userId;
      mitoUserIdByRhemitoId.set(user.id, mitoUserId);
      mitoUserIdByEmail.set(cleanEmail, mitoUserId);
      log(`✅ Synced user ${cleanEmail} to Mito Sandbox (mitoUserId=${mitoUserId})`, "mito-retail");
      return mitoUserId;
    }

    // If user already exists in Mito Sandbox, look up their userId by email
    const existing = await findMitoRetailUserByEmail(cleanEmail);
    if (existing?.userId) {
      mitoUserIdByRhemitoId.set(user.id, existing.userId);
      mitoUserIdByEmail.set(cleanEmail, existing.userId);
      log(`ℹ️ Linked existing Mito Sandbox user ${cleanEmail} (mitoUserId=${existing.userId})`, "mito-retail");
      return existing.userId;
    }

    log(`⚠️ Mito POST /api/v1/mito/Users returned ${res.status}: ${body?.message || "Unknown error"}`, "mito-retail");
    return DEFAULT_MITO_SENDER_USER_ID || null;
  } catch (err) {
    log(`⚠️ Failed to sync user ${cleanEmail} to Mito Sandbox: ${(err as Error).message}`, "mito-retail");
    return DEFAULT_MITO_SENDER_USER_ID || null;
  }
}

/**
 * Returns the active Mito Sender User ID (`5887d933-28da-43e0-b171-33b949218e86` by default)
 * for sending money and beneficiary operations.
 */
export function getMitoUserIdForUser(rhemitoUserId: string, email?: string): string | null {
  if (DEFAULT_MITO_SENDER_USER_ID) {
    return DEFAULT_MITO_SENDER_USER_ID;
  }
  const byId = mitoUserIdByRhemitoId.get(rhemitoUserId);
  if (byId) return byId;
  if (email) {
    const byEmail = mitoUserIdByEmail.get(email.trim().toLowerCase());
    if (byEmail) return byEmail;
  }
  return null;
}

/**
 * Reverse lookup from a Mito `userId` UUID to the Rhemito `user.id` if known.
 */
export function resolveRhemitoUserIdFromMitoUserId(mitoUserId: string | null | undefined): string | null {
  const clean = String(mitoUserId ?? "").trim().toLowerCase();
  if (!clean) return null;
  for (const [rhemitoId, mappedMitoId] of Array.from(mitoUserIdByRhemitoId.entries())) {
    if (String(mappedMitoId || "").trim().toLowerCase() === clean) {
      return rhemitoId;
    }
  }
  return null;
}

/**
 * Returns the public/configured Mito Retail webhook URL.
 */
export function getMitoWebhookUrl(): string {
  const envUrl = (process.env.MITO_RETAIL_WEBHOOK_URL || "").trim();
  if (envUrl) return envUrl;
  return `${serverConfig.publicBaseUrl.replace(/\/+$/, "")}/api/webhooks/mito`;
}

const CURRENCY_TO_COUNTRY_ISO3: Record<string, string> = {
  GBP: "GBR",
  USD: "USA",
  EUR: "DEU",
  NGN: "NGA",
  INR: "IND",
  GHS: "GHA",
  KES: "KEN",
  ZAR: "ZAF",
  CAD: "CAN",
  AED: "ARE",
  AUD: "AUS",
  CNY: "CHN",
  JPY: "JPN",
  UGX: "UGA",
  SGD: "SGP",
};

export function currencyToCountryIso3(currency: string | null | undefined): string {
  const clean = String(currency ?? "").trim().toUpperCase();
  return CURRENCY_TO_COUNTRY_ISO3[clean] ?? "NGA";
}

export function serviceToMitoCollectionMode(service: string | null | undefined): "BANKACCOUNT" | "MOBILEMONEY" {
  if (service === "mobile_money" || service === "MOBILEMONEY") return "MOBILEMONEY";
  return "BANKACCOUNT";
}

export interface MitoAffiliateRate {
  rateId: string;
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  rateMoneyTransfer: number;
  partnerRateMoneyTransfer: number;
  refreshFrequency: number;
  rateExpiry: string;
  rateDirection?: string;
}

export interface MitoProviderItem {
  providerCode: string;
  providerName: string;
  providerId: string;
  isGeneric: boolean;
}

export interface MitoLookupTypesData {
  reason?: Array<{ name: string; code: string; id?: string }>;
  sourceOfFunds?: Array<{ name: string; code: string; id?: string }>;
  relationships?: Array<{ name: string; code: string; id?: string }>;
  identificationType?: Array<{ name: string; code: string; id?: string }>;
}

/**
 * Fetches corridor exchange rates from `GET /api/v1/mito/Exchange/affiliateRates`.
 */
export async function getMitoAffiliateRates(params?: {
  fromCurrency?: string;
  toCurrency?: string;
  fromCountry?: string;
  toCountry?: string;
  userId?: string;
}): Promise<MitoAffiliateRate[]> {
  if (!isMitoRetailConfigured()) return [];
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const qs = new URLSearchParams();
  if (params?.fromCurrency) qs.set("FromCurrency", params.fromCurrency.toUpperCase());
  if (params?.toCurrency) qs.set("ToCurrency", params.toCurrency.toUpperCase());
  if (params?.fromCountry) qs.set("FromCountry", params.fromCountry.toUpperCase());
  if (params?.toCountry) qs.set("ToCountry", params.toCountry.toUpperCase());
  if (params?.userId) qs.set("userId", params.userId);

  const queryString = qs.toString();
  const url = `${creds.baseUrl}/api/v1/mito/Exchange/affiliateRates${queryString ? `?${queryString}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];

  const body = (await res.json().catch(() => ({}))) as { data?: MitoAffiliateRate[] };
  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Fetches beneficiary bank/mobile providers from `GET /api/v1/mito/Lookups/provider`
 * using `countryIso3`, `serviceCode`, `collectionMode` (BANKACCOUNT | MOBILEMONEY), and `CurrencyCode`.
 */
export async function getMitoProviders(params: {
  countryIso3: string;
  currencyCode?: string;
  serviceCode?: string;
  collectionMode?: "BANKACCOUNT" | "MOBILEMONEY";
}): Promise<MitoProviderItem[]> {
  if (!isMitoRetailConfigured()) return [];
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const resolvedCountryIso3 = toCountryIso3(params.countryIso3);
  const resolvedMode = params.collectionMode === "MOBILEMONEY" ? "MOBILEMONEY" : "BANKACCOUNT";
  const qs = new URLSearchParams({
    countryIso3: resolvedCountryIso3,
    serviceCode: params.serviceCode || "MONEYTRANSFER",
    collectionMode: resolvedMode,
  });
  if (params.currencyCode) {
    qs.set("CurrencyCode", params.currencyCode.toUpperCase());
  }

  const res = await fetch(`${creds.baseUrl}/api/v1/mito/Lookups/provider?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];

  const body = (await res.json().catch(() => ({}))) as { data?: MitoProviderItem[] };
  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Fetches lookup codes (`reason`, `source-of-funds`, `relationships`, `identification-types`)
 * from `GET /api/v1/mito/Lookups/types`.
 */
export async function getMitoLookupTypes(
  filter = "reason,source-of-funds,relationships",
): Promise<MitoLookupTypesData> {
  if (!isMitoRetailConfigured()) return {};
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const res = await fetch(
    `${creds.baseUrl}/api/v1/mito/Lookups/types?filter=${encodeURIComponent(filter)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) return {};

  const body = (await res.json().catch(() => ({}))) as { data?: MitoLookupTypesData };
  return body.data ?? {};
}

export interface MitoBeneficiaryRequirementField {
  label: string;
  name: string;
  order: number;
  type: string;
  format?: string | null;
  columnDataType: string;
  isRequired: boolean;
  isDisplayable: boolean;
  fieldInformation?: string | null;
  dropdownOptions?: Array<{ name: string; id: string }>;
}

/**
 * Fetches dynamic beneficiary field requirements for the target country/currency/provider/entityType
 * from `GET /api/v1/mito/Beneficiaries/requirements`.
 */
export async function getMitoBeneficiaryRequirements(params: {
  providerId: string;
  toCountry: string;
  toCurrencyCode: string;
  entityType: "I" | "B";
  serviceCode?: string;
  collectionMode?: "BANKACCOUNT" | "MOBILEMONEY";
}): Promise<MitoBeneficiaryRequirementField[]> {
  if (!isMitoRetailConfigured()) return [];
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const qs = new URLSearchParams({
    providerId: params.providerId,
    toCountry: params.toCountry.toUpperCase(),
    toCurrencyCode: params.toCurrencyCode.toUpperCase(),
    entityType: params.entityType,
    ServiceCode: params.serviceCode || "MONEYTRANSFER",
    collectionMode: params.collectionMode || "BANKACCOUNT",
  });

  const res = await fetch(
    `${creds.baseUrl}/api/v1/mito/Beneficiaries/requirements?${qs.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) return [];

  const body = (await res.json().catch(() => ({}))) as {
    data?: MitoBeneficiaryRequirementField[];
  };
  return Array.isArray(body.data) ? body.data : [];
}

export interface MitoBeneficiaryRecord {
  beneficiaryId: string;
  name: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  beneficiaryNickname: string | null;
  legalEntityType: "individual" | "business";
  countryIso3: string;
  country: string;
  currency: string;
  serviceCode: string;
  collectionMode: string;
  providerId: string | null;
  bankName: string;
  acctNumber: string;
  sortCode: string;
  iban: string;
  bicSwift: string;
  aba: string;
  ifsc: string;
  bsbCode: string;
  branchCode: string;
  address: string;
  city: string;
  postcode: string;
  stateOrProvince: string;
  mobileNo: string;
  relationId: string | null;
  reasonId: string | null;
  relationship?: string | null;
  relationDescription?: string | null;
  reason?: string | null;
  reasonDescription?: string | null;
  otherReason?: string | null;
  narration?: string | null;
  createdAt: string | null;
}

export type MitoBeneficiaryItem = MitoBeneficiaryRecord;

/**
 * Fetches the sender's beneficiaries from `GET /api/v1/mito/Beneficiaries?userId={{userId}}`
 * (with optional query params `serviceCode`, `collectionMode`, `legalEntityType`, `countryIso3`, `currencyIso`, `providerId`, `PageNo`)
 * and enriches each beneficiary with banking details from `GET /api/v1/mito/Beneficiaries/{beneficiaryId}`.
 */
export async function getMitoBeneficiaries(params: {
  userId: string;
  serviceCode?: string;
  collectionMode?: string;
  legalEntityType?: string;
  countryIso3?: string;
  currencyIso?: string;
  providerId?: string;
  pageNo?: number;
  searchingText?: string;
}): Promise<MitoBeneficiaryRecord[]> {
  if (!isMitoRetailConfigured() || !params.userId) return [];
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const fetchSummaryList = async (searchQuery?: string) => {
    const qs = new URLSearchParams({
      userId: params.userId,
    });
    if (params.serviceCode) qs.set("serviceCode", params.serviceCode);
    if (params.collectionMode) qs.set("collectionMode", params.collectionMode);
    if (params.legalEntityType) qs.set("legalEntityType", params.legalEntityType);
    if (params.countryIso3) qs.set("countryIso3", params.countryIso3.toUpperCase());
    if (params.currencyIso) qs.set("currencyIso", params.currencyIso.toUpperCase());
    if (params.providerId) qs.set("providerId", params.providerId);
    if (params.pageNo) qs.set("PageNo", String(params.pageNo));
    if (searchQuery) qs.set("SearchingText", searchQuery);

    const res = await fetch(`${creds.baseUrl}/api/v1/mito/Beneficiaries?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];

    const body = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        beneficiaryId?: string;
        countryIso3?: string;
        countryDescription?: string;
        currency?: string;
        beneficiaryFullName?: string;
        beneficiaryNickname?: string;
        legalEntityType?: string;
        serviceCode?: string;
        collectionMode?: string;
        createdAt?: string;
      }>;
    };
    return Array.isArray(body.data) ? body.data : [];
  };

  loadDeletedBeneficiariesFromDisk();
loadUpdatedBeneficiariesFromDisk();
  const isSummaryItemDeleted = (it: { beneficiaryId?: string; beneficiaryFullName?: string }) => {
    const idUpper = String(it.beneficiaryId || "").trim().toUpperCase();
    if (idUpper && deletedMitoBeneficiaryIds.has(idUpper)) return true;
    const nameOnlySig = it.beneficiaryFullName
      ? `${String(it.beneficiaryFullName).trim().toLowerCase()}|`
      : null;
    if (nameOnlySig && deletedMitoBeneficiarySignatures.has(nameOnlySig)) return true;
    return false;
  };

  const trimmedSearch = params.searchingText?.trim() || "";
  let items = (await fetchSummaryList(trimmedSearch || undefined)).filter(
    (it) => !isSummaryItemDeleted(it),
  );
  let fallbackSearchFilter = false;
  if (trimmedSearch && items.length === 0) {
    // Fallback: fetch all user beneficiaries so searching by bank name, account number, or partial name still matches
    items = (await fetchSummaryList(undefined)).filter(
      (it) => !isSummaryItemDeleted(it),
    );
    fallbackSearchFilter = true;
  }
  if (items.length === 0) return [];

  const detailed = await Promise.all(
    items.map(async (item) => {
      const beneficiaryId = String(item.beneficiaryId || "").trim();
      let detail: Record<string, any> = {};
      if (beneficiaryId) {
        try {
          const detailRes = await fetch(
            `${creds.baseUrl}/api/v1/mito/Beneficiaries/${encodeURIComponent(beneficiaryId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (detailRes.ok) {
            const detailJson = (await detailRes.json().catch(() => ({}))) as {
              data?: Record<string, any>;
            };
            if (detailJson.data && typeof detailJson.data === "object") {
              detail = detailJson.data;
            }
          }
        } catch {
          // keep summary fallback
        }
      }

      const rawEntity = String(detail.legalEntityType || item.legalEntityType || "I").toUpperCase();
      const isBusiness = rawEntity === "B" || rawEntity === "C" || rawEntity === "BUSINESS";
      const fullName = String(
        detail.companyName || detail.beneficiaryFullName || item.beneficiaryFullName || "Beneficiary",
      ).trim();
      const nameParts = fullName.split(/\s+/);
      const firstName = String(detail.firstName || nameParts[0] || fullName).trim();
      const lastName = String(detail.lastName || nameParts.slice(1).join(" ") || "").trim();

      const baseItem: MitoBeneficiaryItem = {
        beneficiaryId,
        name: fullName,
        firstName,
        lastName,
        companyName: isBusiness ? String(detail.companyName || fullName).trim() : null,
        beneficiaryNickname: detail.beneficiaryNickname ?? item.beneficiaryNickname ?? null,
        legalEntityType: isBusiness ? ("business" as const) : ("individual" as const),
        countryIso3: String(detail.countryIso3 || item.countryIso3 || "NGA").toUpperCase(),
        country: String(detail.countryDescription || item.countryDescription || "Nigeria"),
        currency: String(detail.currencyIso || item.currency || "NGN").toUpperCase(),
        serviceCode: String(detail.serviceCode || item.serviceCode || "MONEYTRANSFER"),
        collectionMode: String(detail.collectionMode || item.collectionMode || "BANKACCOUNT"),
        providerId: detail.providerId ? String(detail.providerId) : null,
        bankName: String(
          detail.bankName ||
            detail.providerName ||
            (String(detail.collectionMode || item.collectionMode || "").toUpperCase() === "MOBILEMONEY"
              ? "Mobile Money"
              : "Bank Transfer"),
        ),
        acctNumber: String(detail.acctNumber || detail.mobileNo || ""),
        sortCode: String(detail.sortCode || ""),
        iban: String(detail.iban || ""),
        bicSwift: String(detail.bicSwift || ""),
        aba: String(detail.aba || ""),
        ifsc: String(detail.ifsc || ""),
        bsbCode: String(detail.bsbCode || ""),
        branchCode: String(detail.branchCode || ""),
        address: String(detail.address || ""),
        city: String(detail.city || ""),
        postcode: String(detail.postcode || ""),
        stateOrProvince: String(detail.stateProvinceId || detail.stateProvinceName || ""),
        mobileNo: String(detail.mobileNo || detail.acctNumber || ""),
        relationId: detail.relationId ? String(detail.relationId) : null,
        reasonId: detail.reasonId ? String(detail.reasonId) : null,
        relationship: detail.relationship
          ? String(detail.relationship)
          : detail.relationDescription
            ? String(detail.relationDescription)
            : null,
        relationDescription: detail.relationDescription ? String(detail.relationDescription) : null,
        reason: detail.reason
          ? String(detail.reason)
          : detail.reasonDescription
            ? String(detail.reasonDescription)
            : null,
        reasonDescription: detail.reasonDescription ? String(detail.reasonDescription) : null,
        otherReason: detail.otherReason ? String(detail.otherReason) : null,
        narration:
          detail.narration || detail.paymentNarration
            ? String(detail.narration || detail.paymentNarration)
            : null,
        createdAt: detail.createdAt ?? item.createdAt ?? null,
      };
      const sigKey = makeDeletedSignature(baseItem.name, baseItem.acctNumber || baseItem.iban || baseItem.mobileNo);
      const nameKey = baseItem.name ? `NAME:${baseItem.name.trim().toLowerCase()}` : null;
      const overrideById = beneficiaryId
        ? updatedMitoBeneficiariesById.get(beneficiaryId.toUpperCase())
        : undefined;
      const overrideBySig = sigKey
        ? updatedMitoBeneficiariesById.get(`SIG:${sigKey.toUpperCase()}`)
        : undefined;
      const overrideByName = nameKey
        ? updatedMitoBeneficiariesById.get(nameKey.toUpperCase())
        : undefined;
      const mergedOverride = {
        ...(overrideByName || {}),
        ...(overrideBySig || {}),
        ...(overrideById || {}),
      };
      return Object.keys(mergedOverride).length > 0
        ? { ...baseItem, ...mergedOverride, beneficiaryId }
        : baseItem;
    }),
  );

  const seenKeys = new Set<string>();
  const activeDetailed = detailed.filter((b) => {
    const idUpper = String(b.beneficiaryId || "").trim().toUpperCase();
    if (idUpper && deletedMitoBeneficiaryIds.has(idUpper)) return false;
    const sig = makeDeletedSignature(b.name, b.acctNumber || b.iban || b.mobileNo);
    const nameOnlySig = b.name ? `${b.name.trim().toLowerCase()}|` : null;
    if ((sig && deletedMitoBeneficiarySignatures.has(sig)) || (nameOnlySig && deletedMitoBeneficiarySignatures.has(nameOnlySig))) {
      return false;
    }
    const dedupKey = sig || idUpper;
    if (dedupKey) {
      if (seenKeys.has(dedupKey)) return false;
      seenKeys.add(dedupKey);
    }
    return true;
  });

  if (fallbackSearchFilter && trimmedSearch) {
    const q = trimmedSearch.toLowerCase();
    return activeDetailed.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.firstName.toLowerCase().includes(q) ||
        b.lastName.toLowerCase().includes(q) ||
        (b.companyName || "").toLowerCase().includes(q) ||
        (b.beneficiaryNickname || "").toLowerCase().includes(q) ||
        b.bankName.toLowerCase().includes(q) ||
        b.acctNumber.toLowerCase().includes(q),
    );
  }

  return activeDetailed;
}

function makeValidMitoNickname(raw?: string, fallbackBase?: string): string {
  const cleaned = String(raw || "")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length >= 5) return cleaned;
  const base =
    String(fallbackBase || "Beneficiary")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 6) || "Rhemito";
  const rand = Array.from({ length: 6 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join("");
  return `${base}${rand}`;
}

/**
 * Creates a beneficiary in Mito Sandbox via `POST /api/v1/mito/Beneficiaries`.
 */
export class MitoBeneficiaryCreationError extends Error {
  status: number;
  rawMessage: string;

  constructor(status: number, userFriendlyMessage: string, rawMessage: string) {
    super(userFriendlyMessage);
    this.name = "MitoBeneficiaryCreationError";
    this.status = status;
    this.rawMessage = rawMessage;
  }
}

export function formatFriendlyMitoBeneficiaryError(rawMessage?: string): string {
  const raw = String(rawMessage || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return "We couldn't create this beneficiary right now. Please verify the recipient and bank details and try again.";
  }
  if (lower.includes("account") && (lower.includes("invalid") || lower.includes("length") || lower.includes("digit") || lower.includes("format") || lower.includes("not found"))) {
    return "The account number entered appears to be invalid for the selected bank. Please check the account number and try again.";
  }
  if (lower.includes("iban")) {
    return "Please enter a valid IBAN for the recipient's bank account.";
  }
  if (lower.includes("swift") || lower.includes("bic")) {
    return "Please enter a valid SWIFT / BIC code for the selected bank.";
  }
  if (lower.includes("sort code") || lower.includes("sortcode")) {
    return "Please enter a valid 6-digit UK Sort Code.";
  }
  if (lower.includes("provider") || lower.includes("bank")) {
    return "Please select a valid bank from the list and check your banking details.";
  }
  if (lower.includes("nick")) {
    return "The nickname entered is not valid. Please use letters and numbers only (at least 5 characters) or leave it blank.";
  }
  if (lower.includes("mobile") || lower.includes("phone")) {
    return "Please enter a valid mobile phone number for the recipient.";
  }
  if (lower.includes("address") || lower.includes("city") || lower.includes("postcode") || lower.includes("state")) {
    return "Please check that the recipient's address, city, state, and postcode are filled in accurately.";
  }
  if (lower.includes("relation")) {
    return "Please select a valid relationship with the recipient.";
  }
  if (lower.includes("reason")) {
    return "Please select a valid reason for the transfer.";
  }
  if (lower.includes("already exist") || lower.includes("duplicate")) {
    return "A beneficiary with these bank details already exists in your recipients list.";
  }
  // Clean up technical prefixes if present while keeping readable API messages
  const cleaned = raw
    .replace(/^error\s*[:\-]\s*/i, "")
    .replace(/^validation\s*failed\s*[:\-]\s*/i, "")
    .trim();
  if (cleaned.length > 0 && cleaned.length <= 180 && !cleaned.includes("{") && !cleaned.includes("Exception")) {
    return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  }
  return "We couldn't verify and save this beneficiary's details with the bank. Please double-check all fields and try again.";
}

export async function createMitoBeneficiary(input: {
  userId: string;
  serviceCode?: string;
  collectionMode: "BANKACCOUNT" | "MOBILEMONEY";
  legalEntityType?: "I" | "B";
  countryIso3: string;
  currencyIso: string;
  providerId: string;
  providerCode?: string;
  companyName?: string;
  firstName: string;
  lastName: string;
  acctNumber?: string;
  bankName?: string;
  sortCode?: string;
  iban?: string;
  bicSwift?: string;
  aba?: string;
  ifsc?: string;
  bsbCode?: string;
  branchCode?: string;
  relationship?: string;
  relationId?: string;
  reasonId?: string;
  beneficiaryNickname?: string;
  address?: string;
  city?: string;
  postcode?: string;
  stateOrProvince?: string;
  mobileNo?: string;
}): Promise<{ beneficiaryId: string; providerId: string; providerCode?: string; createdNew: boolean } | null> {
  if (!isMitoRetailConfigured()) return null;
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const legalEntityType: "I" | "B" = input.legalEntityType === "B" ? "B" : "I";
  const baseNameForNick =
    legalEntityType === "B"
      ? input.companyName || input.firstName || "Business"
      : `${input.firstName || ""}${input.lastName || ""}`;
  const isMobileMoney = input.collectionMode === "MOBILEMONEY";
  const resolvedMobileOrAcct = (
    isMobileMoney
      ? input.mobileNo || input.acctNumber || "08012345678"
      : input.acctNumber || input.iban || "0123456789"
  ).replace(/\s+/g, "");
  const payload: Record<string, unknown> = {
    serviceCode: input.serviceCode || "MONEYTRANSFER",
    collectionMode: input.collectionMode,
    legalEntityType,
    countryIso3: input.countryIso3.toUpperCase(),
    currencyIso: input.currencyIso.toUpperCase(),
    providerId: input.providerId,
    userId: input.userId,
    firstName:
      legalEntityType === "B"
        ? (input.companyName || input.firstName || "Business").trim()
        : (input.firstName || "Beneficiary").trim(),
    lastName:
      legalEntityType === "B"
        ? (input.lastName || "Business").trim()
        : (input.lastName || "Recipient").trim(),
    acctNumber: resolvedMobileOrAcct,
    bankName: (input.bankName || (isMobileMoney ? "Mobile Operator" : "Bank")).trim(),
    relationship: (input.relationship || (legalEntityType === "B" ? "BUSINESS" : "FAMILY")).toUpperCase(),
    beneficiaryNickname: makeValidMitoNickname(input.beneficiaryNickname, baseNameForNick),
  };
  if (legalEntityType === "B") {
    payload.companyName = (input.companyName || input.firstName || "Business").trim();
  }
  if (input.relationId) payload.relationId = input.relationId.trim();
  if (input.reasonId) payload.reasonId = input.reasonId.trim();
  if (input.sortCode) payload.sortCode = input.sortCode.replace(/\s+/g, "");
  if (input.iban) payload.iban = input.iban.replace(/\s+/g, "");
  if (input.bicSwift) payload.bicSwift = input.bicSwift.replace(/\s+/g, "");
  if (input.aba) payload.aba = input.aba.replace(/\s+/g, "");
  if (input.ifsc) payload.ifsc = input.ifsc.replace(/\s+/g, "");
  if (input.bsbCode) payload.bsbCode = input.bsbCode.replace(/\s+/g, "");
  if (input.branchCode) payload.branchCode = input.branchCode.replace(/\s+/g, "");
  if (input.address) payload.address = input.address.trim();
  if (input.city) payload.city = input.city.trim();
  if (input.postcode) payload.postcode = input.postcode.trim();
  if (input.stateOrProvince) payload.stateOrProvince = input.stateOrProvince.trim();
  if (input.mobileNo) {
    payload.mobileNo = input.mobileNo.replace(/\s+/g, "");
  } else if (isMobileMoney) {
    payload.mobileNo = resolvedMobileOrAcct;
  }

  let res = await fetch(`${creds.baseUrl}/api/v1/mito/Beneficiaries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  let body = (await res.json().catch(() => ({}))) as {
    data?: { beneficiaryId?: string };
    message?: string;
  };

  if (!res.ok && (body?.message || "").toLowerCase().includes("nick")) {
    payload.beneficiaryNickname = makeValidMitoNickname(undefined, baseNameForNick);
    res = await fetch(`${creds.baseUrl}/api/v1/mito/Beneficiaries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    body = (await res.json().catch(() => ({}))) as {
      data?: { beneficiaryId?: string };
      message?: string;
    };
  }

  const fullBeneficiaryName =
    input.legalEntityType === "B"
      ? String(input.companyName || input.firstName || "").trim()
      : `${String(input.firstName || "").trim()} ${String(input.lastName || "").trim()}`.trim();

  if (res.ok && body?.data?.beneficiaryId) {
    unmarkDeletedBeneficiaryOnServer({
      beneficiaryId: body.data.beneficiaryId,
      name: fullBeneficiaryName,
      acctNumber: input.acctNumber || input.iban || input.mobileNo,
    });
    log(
      `✅ Created Mito Beneficiary (beneficiaryId=${body.data.beneficiaryId}, providerCode=${input.providerCode || "-"}, providerId=${input.providerId})`,
      "mito-retail",
    );
    return {
      beneficiaryId: body.data.beneficiaryId,
      providerId: input.providerId,
      providerCode: input.providerCode,
      createdNew: true,
    };
  }

  // If the beneficiary already exists with the same details, look up the user's beneficiaries via GET /api/v1/mito/Beneficiaries
  const msgLower = (body?.message || "").toLowerCase();
  if (msgLower.includes("already exist")) {
    try {
      const listRes = await fetch(
        `${creds.baseUrl}/api/v1/mito/Beneficiaries?userId=${encodeURIComponent(input.userId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (listRes.ok) {
        const listBody = (await listRes.json().catch(() => ({}))) as {
          data?: Array<{
            beneficiaryId?: string;
            acctNumber?: string;
            firstName?: string;
            lastName?: string;
            companyName?: string;
          }>;
        };
        const list = Array.isArray(listBody.data) ? listBody.data : [];
        const acctSearch = (input.acctNumber || input.iban || "").trim().toLowerCase();
        const found =
          (acctSearch && list.find((b) => (b.acctNumber || "").trim().toLowerCase() === acctSearch)) ||
          list.find(
            (b) =>
              (b.companyName || b.firstName || "").trim().toLowerCase() ===
              String(payload.companyName || payload.firstName || "").trim().toLowerCase(),
          ) ||
          list[0];
        if (found?.beneficiaryId) {
          unmarkDeletedBeneficiaryOnServer({
            beneficiaryId: found.beneficiaryId,
            name: fullBeneficiaryName,
            acctNumber: input.acctNumber || input.iban || input.mobileNo,
          });
          log(
            `✅ Reused existing Mito Beneficiary (beneficiaryId=${found.beneficiaryId}, providerCode=${input.providerCode || "-"}, providerId=${input.providerId})`,
            "mito-retail",
          );
          return {
            beneficiaryId: found.beneficiaryId,
            providerId: input.providerId,
            providerCode: input.providerCode,
            createdNew: false,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  const rawErr = String(
    body?.message ||
      (body as any)?.error?.message ||
      (Array.isArray((body as any)?.errors) ? (body as any).errors.map((e: any) => e?.message || e).join(", ") : "") ||
      `API returned status ${res.status}`,
  ).trim();
  log(`⚠️ Mito POST /api/v1/mito/Beneficiaries returned ${res.status}: ${rawErr}`, "mito-retail");
  throw new MitoBeneficiaryCreationError(
    res.status >= 400 && res.status < 500 ? res.status : 400,
    formatFriendlyMitoBeneficiaryError(rawErr),
    rawErr,
  );
}

/**
 * Deletes a beneficiary in Mito Sandbox (if supported) and marks it deleted locally
 * (persisted to `.dev-state/mito-deleted-beneficiaries.json`) so it no longer appears in `getMitoBeneficiaries`.
 */
export async function deleteMitoBeneficiary(params: {
  beneficiaryId: string;
  userId?: string | null;
  name?: string | null;
  acctNumber?: string | null;
}): Promise<boolean> {
  loadDeletedBeneficiariesFromDisk();
loadUpdatedBeneficiariesFromDisk();
  const cleanId = String(params.beneficiaryId || "").trim().toUpperCase();
  if (cleanId && cleanId !== "LOCAL") {
    deletedMitoBeneficiaryIds.add(cleanId);
  }
  const sig = makeDeletedSignature(params.name, params.acctNumber);
  if (sig) {
    deletedMitoBeneficiarySignatures.add(sig);
  }
  if (params.name && String(params.name).trim()) {
    deletedMitoBeneficiarySignatures.add(`${String(params.name).trim().toLowerCase()}|`);
  }
  saveDeletedBeneficiariesToDisk();

  if (!isMitoRetailConfigured() || !cleanId || cleanId === "LOCAL") return true;
  try {
    const creds = loadMitoRetailCredentials()!;
    const { token } = await getMitoRetailToken();
    const qs = params.userId ? `?userId=${encodeURIComponent(params.userId)}` : "";
    const res = await fetch(
      `${creds.baseUrl}/api/v1/mito/Beneficiaries/${encodeURIComponent(cleanId)}${qs}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) {
      log(`✅ Deleted Mito Beneficiary (beneficiaryId=${cleanId})`, "mito-retail");
    } else {
      log(`ℹ️ Removed Mito Beneficiary locally (beneficiaryId=${cleanId}, upstream status=${res.status})`, "mito-retail");
    }
  } catch {
    // Keep persistent local deletion in deletedMitoBeneficiaryIds
  }
  return true;
}

/**
 * Updates an existing beneficiary in Mito Sandbox (if supported) and persists the updated fields
 * locally in `.dev-state/mito-updated-beneficiaries.json` so `getMitoBeneficiaries` returns the updated details.
 */
export async function updateMitoBeneficiary(params: {
  beneficiaryId: string;
  userId?: string | null;
  legalEntityType?: "individual" | "business";
  firstName?: string;
  lastName?: string;
  companyName?: string | null;
  country?: string;
  countryIso3?: string;
  currency?: string;
  collectionMode?: "BANKACCOUNT" | "MOBILEMONEY";
  providerId?: string | null;
  bankName?: string;
  acctNumber?: string;
  sortCode?: string;
  iban?: string;
  bicSwift?: string;
  mobileNo?: string;
  beneficiaryNickname?: string | null;
}): Promise<Partial<MitoBeneficiaryItem>> {
  loadUpdatedBeneficiariesFromDisk();
  const cleanId = String(params.beneficiaryId || "").trim().toUpperCase();
  const isBusiness = params.legalEntityType === "business";
  const firstName = String(params.firstName || "").trim();
  const lastName = String(params.lastName || "").trim();
  const companyName = isBusiness ? String(params.companyName || firstName || "Business").trim() : null;
  const fullName = isBusiness
    ? companyName || "Business"
    : [firstName, lastName].filter(Boolean).join(" ").trim() || "Beneficiary";
  const cleanAcct = String(params.acctNumber || params.mobileNo || params.iban || "").replace(/\s+/g, "");

  const existingOverride = cleanId ? updatedMitoBeneficiariesById.get(cleanId) || {} : {};
  const nextOverride: Partial<MitoBeneficiaryItem> = {
    ...existingOverride,
    name: fullName,
    firstName: isBusiness ? companyName || firstName : firstName,
    lastName: isBusiness ? lastName || "Business" : lastName,
    companyName,
    legalEntityType: isBusiness ? "business" : "individual",
    ...(params.country ? { country: params.country } : {}),
    ...(params.countryIso3 ? { countryIso3: params.countryIso3.toUpperCase() } : {}),
    ...(params.currency ? { currency: params.currency.toUpperCase() } : {}),
    ...(params.collectionMode ? { collectionMode: params.collectionMode } : {}),
    ...(params.providerId !== undefined ? { providerId: params.providerId } : {}),
    ...(params.bankName !== undefined ? { bankName: params.bankName.trim() } : {}),
    ...(cleanAcct ? { acctNumber: cleanAcct } : {}),
    ...(params.sortCode !== undefined ? { sortCode: params.sortCode.replace(/\s+/g, "") } : {}),
    ...(params.iban !== undefined ? { iban: params.iban.replace(/\s+/g, "") } : {}),
    ...(params.bicSwift !== undefined ? { bicSwift: params.bicSwift.replace(/\s+/g, "") } : {}),
    ...(params.mobileNo !== undefined ? { mobileNo: params.mobileNo.replace(/\s+/g, "") } : {}),
  };

  if (cleanId && cleanId !== "LOCAL") {
    updatedMitoBeneficiariesById.set(cleanId, nextOverride);
    saveUpdatedBeneficiariesToDisk();
  }

  unmarkDeletedBeneficiaryOnServer({
    beneficiaryId: cleanId,
    name: fullName,
    acctNumber: cleanAcct,
  });

  if (isMitoRetailConfigured() && cleanId && cleanId !== "LOCAL") {
    try {
      const creds = loadMitoRetailCredentials()!;
      const { token } = await getMitoRetailToken();
      const putPayload: Record<string, unknown> = {
        beneficiaryId: cleanId,
        userId: params.userId || undefined,
        legalEntityType: isBusiness ? "B" : "I",
        firstName: nextOverride.firstName,
        lastName: nextOverride.lastName,
        companyName: nextOverride.companyName || undefined,
        acctNumber: nextOverride.acctNumber,
        bankName: nextOverride.bankName,
        providerId: nextOverride.providerId || undefined,
        sortCode: nextOverride.sortCode || undefined,
        iban: nextOverride.iban || undefined,
        bicSwift: nextOverride.bicSwift || undefined,
        mobileNo: nextOverride.mobileNo || undefined,
        beneficiaryNickname: makeValidMitoNickname(
          params.beneficiaryNickname || undefined,
          fullName,
        ),
      };
      const res = await fetch(
        `${creds.baseUrl}/api/v1/mito/Beneficiaries/${encodeURIComponent(cleanId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(putPayload),
        },
      );
      if (res.ok) {
        log(`✅ Updated Mito Beneficiary upstream (beneficiaryId=${cleanId})`, "mito-retail");
      } else {
        log(
          `ℹ️ Saved Mito Beneficiary update override locally (beneficiaryId=${cleanId}, upstream status=${res.status})`,
          "mito-retail",
        );
      }
    } catch {
      // Keep persistent local override in updatedMitoBeneficiariesById
    }
  }

  return nextOverride;
}

/**
 * Persists the latest transaction's Relationship, Reason for Transfer, Narration, and Nickname
 * for a beneficiary in `.dev-state/mito-updated-beneficiaries.json` so selecting that beneficiary
 * in future transfers pre-populates those fields automatically.
 */
export function saveMitoBeneficiaryLatestTxnDetails(params: {
  beneficiaryId?: string | null;
  name?: string | null;
  acctNumber?: string | null;
  relationship?: string | null;
  relationId?: string | null;
  relationDescription?: string | null;
  reason?: string | null;
  reasonId?: string | null;
  reasonDescription?: string | null;
  otherReason?: string | null;
  narration?: string | null;
  beneficiaryNickname?: string | null;
}): void {
  loadUpdatedBeneficiariesFromDisk();
  const patch: Partial<MitoBeneficiaryRecord> = {};
  if (params.relationship && params.relationship.trim()) {
    patch.relationship = params.relationship.trim();
  }
  if (params.relationId && params.relationId.trim()) {
    patch.relationId = params.relationId.trim();
  }
  if (params.relationDescription && params.relationDescription.trim()) {
    patch.relationDescription = params.relationDescription.trim();
  }
  if (params.reason && params.reason.trim()) {
    patch.reason = params.reason.trim();
  }
  if (params.reasonId && params.reasonId.trim()) {
    patch.reasonId = params.reasonId.trim();
  }
  if (params.reasonDescription && params.reasonDescription.trim()) {
    patch.reasonDescription = params.reasonDescription.trim();
  }
  if (params.otherReason !== undefined && params.otherReason !== null) {
    patch.otherReason = params.otherReason.trim();
  }
  if (params.narration && params.narration.trim()) {
    patch.narration = params.narration.trim();
  }
  if (params.beneficiaryNickname && params.beneficiaryNickname.trim()) {
    patch.beneficiaryNickname = params.beneficiaryNickname.trim();
  }
  if (Object.keys(patch).length === 0) return;

  const cleanId = String(params.beneficiaryId || "").trim().toUpperCase();
  if (cleanId && cleanId !== "LOCAL") {
    const existing = updatedMitoBeneficiariesById.get(cleanId) || {};
    updatedMitoBeneficiariesById.set(cleanId, { ...existing, ...patch });
  }
  const sig = makeDeletedSignature(params.name, params.acctNumber);
  if (sig) {
    const sigKey = `SIG:${sig.toUpperCase()}`;
    const existingSig = updatedMitoBeneficiariesById.get(sigKey) || {};
    updatedMitoBeneficiariesById.set(sigKey, { ...existingSig, ...patch });
  }
  if (params.name && params.name.trim()) {
    const nameKey = `NAME:${params.name.trim().toUpperCase()}`;
    const existingName = updatedMitoBeneficiariesById.get(nameKey) || {};
    updatedMitoBeneficiariesById.set(nameKey, { ...existingName, ...patch });
  }
  saveUpdatedBeneficiariesToDisk();
}

/**
 * Locks the exchange rate via `POST /api/v1/Rate/validateRate` (or `POST /api/v1/mito/Exchange/rates`)
 * once we have `providerId` (for the beneficiary bank) and user/corridor codes.
 * Falls back to `GET /api/v1/mito/Exchange/affiliateRates` if needed so `rateId` is always stored.
 */
export async function lockMitoExchangeRate(input: {
  userId: string;
  serviceCode?: string;
  collectionMode: "BANKACCOUNT" | "MOBILEMONEY";
  fromCountry: string;
  toCountry: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  direction?: "S" | "R";
  providerId: string;
  providerCode?: string;
  returnUrl?: string;
}): Promise<{
  rateId: string;
  rate?: number;
  commission?: number;
  receiveAmount?: number;
  source: "validate_rate" | "exchange_rates" | "affiliate_rates";
} | null> {
  if (!isMitoRetailConfigured()) return null;
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();
  const effectiveUserId = (input.userId || DEFAULT_MITO_SENDER_USER_ID).trim();

  // 1. Primary rate-lock endpoint used by the Mito web flow: POST /api/v1/Rate/validateRate
  try {
    const validatePayload = {
      userId: effectiveUserId,
      fromCountry: input.fromCountry.toUpperCase(),
      toCountry: input.toCountry.toUpperCase(),
      fromCurrency: input.fromCurrency.toUpperCase(),
      toCurrency: input.toCurrency.toUpperCase(),
      amount: input.amount,
      direction: input.direction || "S",
      service: input.collectionMode,
      providerId: input.providerId,
      isInternational: false,
      returnUrl: input.returnUrl || "http://localhost:5000/send-money",
    };

    const valRes = await fetch(`${creds.baseUrl}/api/v1/Rate/validateRate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apiKey: creds.apiKey,
      },
      body: JSON.stringify(validatePayload),
    });

    const valBody = (await valRes.json().catch(() => ({}))) as {
      data?: {
        id?: string;
        rateId?: string;
        rate?: number;
        commission?: number;
        receiveAmount?: number;
      };
      message?: string;
    };

    const validatedRateId = valBody?.data?.id || valBody?.data?.rateId;
    if (valRes.ok && validatedRateId) {
      log(
        `✅ Locked Mito rate via POST /api/v1/Rate/validateRate (rateId=${validatedRateId}, commission=${valBody.data?.commission ?? "-"}, userId=${effectiveUserId})`,
        "mito-retail",
      );
      return {
        rateId: validatedRateId,
        rate: valBody.data?.rate,
        commission: valBody.data?.commission,
        receiveAmount: valBody.data?.receiveAmount,
        source: "validate_rate",
      };
    }
  } catch (err) {
    log(`ℹ️ POST /api/v1/Rate/validateRate warning: ${(err as Error).message}`, "mito-retail");
  }

  // 2. Fallback to POST /api/v1/mito/Exchange/rates
  const payload = {
    userId: effectiveUserId,
    serviceCode: input.serviceCode || "MONEYTRANSFER",
    collectionMode: input.collectionMode,
    fromCountry: input.fromCountry.toUpperCase(),
    toCountry: input.toCountry.toUpperCase(),
    fromCurrency: input.fromCurrency.toUpperCase(),
    toCurrency: input.toCurrency.toUpperCase(),
    amount: input.amount,
    direction: input.direction || "S",
    providerId: input.providerId,
  };

  const res = await fetch(`${creds.baseUrl}/api/v1/mito/Exchange/rates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      id?: string;
      rateId?: string;
      rate?: number;
      commission?: number;
      receiveAmount?: number;
    };
    message?: string;
  };

  const lockedId = body?.data?.id || body?.data?.rateId;
  if (res.ok && lockedId) {
    log(
      `✅ Locked Mito rate via POST /Exchange/rates (rateId=${lockedId}, providerCode=${input.providerCode || "-"}, providerId=${input.providerId})`,
      "mito-retail",
    );
    return {
      rateId: lockedId,
      rate: body.data?.rate,
      commission: body.data?.commission,
      receiveAmount: body.data?.receiveAmount,
      source: "exchange_rates",
    };
  }

  log(
    `ℹ️ Mito POST /api/v1/mito/Exchange/rates returned ${res.status} (${body?.message || "no message"}); resolving rateId from affiliateRates`,
    "mito-retail",
  );

  // 3. Fallback to affiliateRates rateId for the corridor so rateId is always captured
  const allAffiliate = await getMitoAffiliateRates();
  const matched =
    allAffiliate.find(
      (r) =>
        r.fromCurrency.toUpperCase() === input.fromCurrency.toUpperCase() &&
        r.toCurrency.toUpperCase() === input.toCurrency.toUpperCase() &&
        r.rateMoneyTransfer > 0,
    ) ||
    allAffiliate.find(
      (r) =>
        r.fromCurrency.toUpperCase() === input.fromCurrency.toUpperCase() &&
        r.toCurrency.toUpperCase() === input.toCurrency.toUpperCase(),
    );

  if (matched?.rateId) {
    return {
      rateId: matched.rateId,
      rate: matched.rateMoneyTransfer > 0 ? matched.rateMoneyTransfer : undefined,
      source: "affiliate_rates",
    };
  }

  return null;
}

export type MitoSendMoneyPaymentMethod =
  | "CARDCHECKOUT"
  | "PLAID"
  | "PAYBYBANK"
  | "TUNACCOUNT"
  | "BANKPAYMENT";

export const MITO_CHECKOUT_PUBLIC_KEY =
  process.env.MITO_CHECKOUT_PUBLIC_KEY || "pk_sbox_hxdmemjidz7nf3sfukhia4igsuf";

/**
 * Resolves a valid UUID `reasonId` from `GET /api/v1/mito/Lookups/types?lookupType=reason`
 * (or falls back to the verified Sandbox reason UUID).
 */
export async function resolveMitoReasonIdUuid(preferredReason?: string | null): Promise<string> {
  const DEFAULT_REASON_UUID = "1ba15877-5582-4076-a54e-5b10ac2a6f60";
  const raw = String(preferredReason || "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  if (!isMitoRetailConfigured()) return DEFAULT_REASON_UUID;
  try {
    const creds = loadMitoRetailCredentials()!;
    const { token } = await getMitoRetailToken();
    const res = await fetch(`${creds.baseUrl}/api/v1/mito/Lookups/types?lookupType=reason`, {
      headers: { Authorization: `Bearer ${token}`, apiKey: creds.apiKey },
    });
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        data?: { reason?: Array<{ id?: string; code?: string; name?: string }> };
      };
      const reasons = body?.data?.reason || [];
      const q = raw.toLowerCase();
      const matched =
        (q &&
          reasons.find(
            (r) =>
              (r.id && r.id.toLowerCase() === q) ||
              (r.code && r.code.toLowerCase() === q) ||
              (r.name && r.name.toLowerCase() === q),
          )) ||
        reasons[0];
      if (matched?.id) return matched.id;
    }
  } catch {
    // fallback below
  }
  return DEFAULT_REASON_UUID;
}

/**
 * Submits a payment transaction on Step 4 via `POST /api/v1/Transaction/SendMoney`
 * when clicking a payment method card (`CARDCHECKOUT`, `PLAID`, `PAYBYBANK`, `TUNACCOUNT`, `BANKPAYMENT`).
 */
export async function sendMitoTransaction(input: {
  userId?: string | null;
  reasonId?: string | null;
  paymentMethod: MitoSendMoneyPaymentMethod;
  sendCountryIso3: string;
  receiveCountryIso3: string;
  sendCurrency: string;
  receiveCurrency: string;
  sendAmount: number;
  commission: number;
  rateId: string;
  providerId: string;
  collectionMode: "BANKACCOUNT" | "MOBILEMONEY";
  beneficiaryId: string;
  paymentNarration?: string | null;
  direction?: "S" | "R";
  redirectSuccessUrl?: string | null;
  promoCode?: string | null;
  bonusAmount?: number | null;
}): Promise<{
  tnxref?: string;
  status?: string;
  paymentUrl?: string | null;
  paymentSession?: Record<string, unknown> | null;
  linkToken?: string | null;
  paymentReference?: string | null;
  recipientPickupCode?: string | null;
  checkoutPublicKey?: string;
  requestPayload?: Record<string, unknown>;
  message?: string;
} | null> {
  if (!isMitoRetailConfigured()) return null;
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const effectiveUserId = (input.userId || DEFAULT_MITO_SENDER_USER_ID).trim();
  const reasonId = await resolveMitoReasonIdUuid(input.reasonId);
  const rawRedirectCandidate = (
    input.redirectSuccessUrl ||
    process.env.MITO_REDIRECT_SUCCESS_URL ||
    `${serverConfig.publicBaseUrl.replace(/\/+$/, "")}/send-money`
  ).trim();
  const resolvedRedirectSuccessUrl =
    /localhost|127\.0\.0\.1/i.test(rawRedirectCandidate)
      ? "https://rhemito-ui.onrender.com/send-money"
      : rawRedirectCandidate;

  const buildPayload = (overrides?: {
    beneficiaryId?: string;
    rateId?: string;
    commission?: number;
    providerId?: string;
  }): Record<string, unknown> => ({
    userId: effectiveUserId,
    reasonId,
    channel: "WEB",
    service: "MONEYTRANSFER",
    paymentMethod: input.paymentMethod,
    sendCountry: input.sendCountryIso3.toUpperCase(),
    receiveCountry: input.receiveCountryIso3.toUpperCase(),
    sendCurrency: input.sendCurrency.toUpperCase(),
    receiveCurrency: input.receiveCurrency.toUpperCase(),
    sendAmount: input.sendAmount,
    commission: overrides?.commission ?? input.commission,
    rateId: overrides?.rateId || input.rateId,
    providerId: overrides?.providerId || input.providerId,
    isInternational: false,
    collectionMode: input.collectionMode,
    beneficiaryId: overrides?.beneficiaryId || input.beneficiaryId,
    paymentNarration: input.paymentNarration ?? "",
    direction: input.direction || "S",
    isScheduledTransaction: false,
    numberOfOccurences: 1,
    ...(input.paymentMethod === "PLAID"
      ? { RedirectSuccessUrl: resolvedRedirectSuccessUrl }
      : { isCardSaved: true, isNewFlow: true, RedirectSuccessUrl: resolvedRedirectSuccessUrl }),
  });

  let currentPayload = buildPayload();

  let res = await fetch(`${creds.baseUrl}/api/v1/Transaction/SendMoney`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apiKey: creds.apiKey,
    },
    body: JSON.stringify(currentPayload),
  });

  let body = (await res.json().catch(() => ({}))) as {
    status?: number;
    data?: {
      tnxref?: string;
      status?: string;
      paymentUrl?: string | null;
      linkToken?: string | null;
      paymentReference?: string | null;
      recipientPickupCode?: string | null;
    };
    message?: string;
  };

  // If rateId expired or beneficiaryId belonged to a different user, refresh rateId / beneficiaryId for effectiveUserId and retry once
  if (!res.ok) {
    const errMsg = String(body?.message || "").toLowerCase();
    let retryBeneficiaryId = String(currentPayload.beneficiaryId || "");
    let retryProviderId = String(currentPayload.providerId || "");

    if (errMsg.includes("beneficiary") || !retryBeneficiaryId) {
      const userBens = await getMitoBeneficiaries({
        userId: effectiveUserId,
        collectionMode: input.collectionMode,
      });
      const matchedBen =
        userBens.find((b) => b.currency.toUpperCase() === input.receiveCurrency.toUpperCase()) ||
        userBens[0];
      if (matchedBen?.beneficiaryId) {
        retryBeneficiaryId = matchedBen.beneficiaryId;
        if (matchedBen.providerId) {
          retryProviderId = matchedBen.providerId;
        }
      }
    }

    const refreshedRate = await lockMitoExchangeRate({
      userId: effectiveUserId,
      collectionMode: input.collectionMode,
      fromCountry: input.sendCountryIso3,
      toCountry: input.receiveCountryIso3,
      fromCurrency: input.sendCurrency,
      toCurrency: input.receiveCurrency,
      amount: input.sendAmount,
      direction: input.direction || "S",
      providerId: retryProviderId,
    });

    if (refreshedRate?.rateId) {
      const hasDiscountedCommission = Boolean(input.promoCode || (input.bonusAmount && input.bonusAmount > 0));
      currentPayload = buildPayload({
        beneficiaryId: retryBeneficiaryId,
        providerId: retryProviderId,
        rateId: refreshedRate.rateId,
        commission: hasDiscountedCommission
          ? input.commission
          : typeof refreshedRate.commission === "number"
          ? refreshedRate.commission
          : input.commission,
      });
      res = await fetch(`${creds.baseUrl}/api/v1/Transaction/SendMoney`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apiKey: creds.apiKey,
        },
        body: JSON.stringify(currentPayload),
      });
      body = (await res.json().catch(() => ({}))) as typeof body;
    }
  }

  let parsedPaymentSession: Record<string, unknown> | null = null;
  const rawPaymentUrl = body?.data?.paymentUrl ?? null;
  if (rawPaymentUrl && typeof rawPaymentUrl === "string" && rawPaymentUrl.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawPaymentUrl) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && (parsed.id || parsed.payment_session_secret || parsed.payment_session_token)) {
        parsedPaymentSession = parsed;
      }
    } catch {
      parsedPaymentSession = null;
    }
  }

  if (res.ok && body?.data) {
    log(
      `✅ Mito POST /api/v1/Transaction/SendMoney succeeded (tnxref=${body.data.tnxref || "-"}, status=${body.data.status || "-"}, paymentMethod=${input.paymentMethod})`,
      "mito-retail",
    );
    return {
      tnxref: body.data.tnxref,
      status: body.data.status,
      paymentUrl: rawPaymentUrl,
      paymentSession: parsedPaymentSession,
      linkToken: body.data.linkToken ?? null,
      paymentReference: body.data.paymentReference ?? null,
      recipientPickupCode: body.data.recipientPickupCode ?? null,
      checkoutPublicKey: MITO_CHECKOUT_PUBLIC_KEY,
      requestPayload: currentPayload,
      message: body.message,
    };
  }

  log(
    `⚠️ Mito POST /api/v1/Transaction/SendMoney returned ${res.status}: ${body?.message || "Unknown"}`,
    "mito-retail",
  );
  return {
    checkoutPublicKey: MITO_CHECKOUT_PUBLIC_KEY,
    requestPayload: currentPayload,
    message: body?.message || `HTTP ${res.status}`,
  };
}

/**
 * Initiates a hosted transaction in Mito Sandbox (`POST /api/v1/mito/Transactions/InitiateHostedTransaction`).
 *
 * Request body fields per Mito Retail API spec:
 * - serviceCode (string, required): MONEYTRANSFER | MOBILETOPUP | BILLPAYMENT
 * - collectionMode (string, required): BANKACCOUNT | CASH | MOBILEMONEY (BANKACCOUNT or MOBILEMONEY in our app)
 * - sendCountryIso3 (string, required): Sender country ISO3
 * - receiveCountryIso3 (string, required): Payout country ISO3
 * - sendCurrency (string, required): Send currency
 * - receiveCurrency (string, required): Receive currency
 * - sendAmount (number, required): Amount to send
 * - receiveAmount (number, conditional): Own rates required; omit for MITO rates
 * - providerId (string, conditional): Own rates required; usually required for MITO rates
 * - rate (number, conditional): Own rates FX; omit for MITO rates
 * - rateId (string, conditional): MITO rates quote id from POST /Exchange/rates; omit for own rates
 * - userId (string, required): Customer user UUID from Create User
 * - redirectUrl (string, required): Return URL after hosted steps
 * - PartnerReferenceNumber (string, required): Idempotent partner reference
 * - reasonCode (string, required): Lookup id/code from GET /Lookups/types (reason)
 * - sourceOfFundCode (string, required): Lookup id/code from GET /Lookups/types (source-of-funds)
 * - paymentNarration (string, required): Payment description
 * - webhookUrl (string, required): HTTPS webhook URL
 * - beneficiaryId (string, optional): Beneficiary UUID
 * - commission (number, optional): Optional when enabled for affiliate
 */
export async function initiateMitoHostedTransaction(input: {
  userId: string;
  beneficiaryId?: string;
  providerId?: string;
  rateId?: string;
  rate?: number;
  receiveAmount?: number;
  commission?: number;
  serviceCode?: "MONEYTRANSFER" | "MOBILETOPUP" | "BILLPAYMENT" | string;
  collectionMode: "BANKACCOUNT" | "MOBILEMONEY";
  sendCountryIso3: string;
  receiveCountryIso3: string;
  sendCurrency: string;
  receiveCurrency: string;
  sendAmount: number;
  partnerReferenceNumber: string;
  reasonCode: string;
  sourceOfFundCode: string;
  paymentNarration: string;
  redirectUrl?: string;
  webhookUrl?: string;
}): Promise<{
  retailTransactionId?: string;
  reference?: string;
  status?: string;
  requiredAction?: Record<string, unknown>;
  hostedUrl?: string;
  requestPayload?: Record<string, unknown>;
  message?: string;
} | null> {
  if (!isMitoRetailConfigured()) return null;
  const creds = loadMitoRetailCredentials()!;
  const { token } = await getMitoRetailToken();

  const rawHostedRedirectUrl = (input.redirectUrl || "https://rhemito-ui.onrender.com/send-money").trim();
  const resolvedHostedRedirectUrl =
    /localhost|127\.0\.0\.1/i.test(rawHostedRedirectUrl)
      ? "https://rhemito-ui.onrender.com/send-money"
      : rawHostedRedirectUrl;

  const payload: Record<string, unknown> = {
    serviceCode: input.serviceCode || "MONEYTRANSFER",
    collectionMode: input.collectionMode,
    sendCountryIso3: input.sendCountryIso3.toUpperCase(),
    receiveCountryIso3: input.receiveCountryIso3.toUpperCase(),
    sendCurrency: input.sendCurrency.toUpperCase(),
    receiveCurrency: input.receiveCurrency.toUpperCase(),
    sendAmount: input.sendAmount,
    userId: input.userId,
    redirectUrl: resolvedHostedRedirectUrl,
    PartnerReferenceNumber: input.partnerReferenceNumber,
    reasonCode: input.reasonCode,
    sourceOfFundCode: input.sourceOfFundCode,
    paymentNarration: input.paymentNarration || "Money transfer",
    webhookUrl: input.webhookUrl || getMitoWebhookUrl(),
  };

  if (input.providerId) {
    payload.providerId = input.providerId;
  }

  // Per spec: MITO rates use rateId (omit rate & receiveAmount); Own rates use rate & receiveAmount (omit rateId)
  if (input.rateId) {
    payload.rateId = input.rateId;
  } else {
    if (typeof input.receiveAmount === "number" && Number.isFinite(input.receiveAmount)) {
      payload.receiveAmount = input.receiveAmount;
    }
    if (typeof input.rate === "number" && Number.isFinite(input.rate)) {
      payload.rate = input.rate;
    }
  }

  if (input.beneficiaryId) {
    payload.beneficiaryId = input.beneficiaryId;
  }
  if (typeof input.commission === "number" && Number.isFinite(input.commission)) {
    payload.commission = input.commission;
  }

  const res = await fetch(`${creds.baseUrl}/api/v1/mito/Transactions/InitiateHostedTransaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Mito-Secret-Key": creds.secretKey,
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      retailTransactionId?: string;
      reference?: string;
      status?: string;
      paymentUrl?: string;
      PaymentUrl?: string;
      requiredAction?: {
        payment?: { link?: string; url?: string; isCompleted?: boolean };
        kyc?: { link?: string; url?: string; isCompleted?: boolean };
        beneficiary?: { link?: string; url?: string; isCompleted?: boolean };
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const hostedUrl =
    body?.data?.requiredAction?.payment?.link ||
    body?.data?.requiredAction?.payment?.url ||
    body?.data?.paymentUrl ||
    body?.data?.PaymentUrl ||
    body?.data?.requiredAction?.kyc?.link ||
    body?.data?.requiredAction?.kyc?.url ||
    body?.data?.requiredAction?.beneficiary?.link ||
    body?.data?.requiredAction?.beneficiary?.url ||
    undefined;

  if (res.ok && body?.data) {
    log(
      `✅ Initiated Mito Hosted Transaction (ref=${body.data.reference || body.data.retailTransactionId})`,
      "mito-retail",
    );
    return {
      retailTransactionId: body.data.retailTransactionId,
      reference: body.data.reference,
      status: body.data.status,
      requiredAction: body.data.requiredAction,
      hostedUrl,
      requestPayload: payload,
      message: body.message,
    };
  }

  log(
    `ℹ️ Mito POST /api/v1/mito/Transactions/InitiateHostedTransaction returned ${res.status}: ${body?.message || "Unknown"}`,
    "mito-retail",
  );
  return {
    requestPayload: payload,
    message: body?.message || `HTTP ${res.status}`,
  };
}

export interface MitoJourneyStatusResult {
  journeyCode: string;
  journeyStatus: string;
  orderNo: string | null;
  orderStatus: string | null;
  partnerReferenceNumber: string | null;
  reference: string | null;
  currency: string | null;
  amount: number | null;
}

/**
 * Fetches live journey & payment status from `GET /api/v1/mito/Journey/status?journeyCode=<journeyCode>`.
 * Used by the frontend while the Instant Pay By Bank modal is open so that mobile QR payments,
 * completions, failures, cancellations, or expirations immediately close the modal and display
 * the full-page Payment Status view.
 */
export async function getMitoJourneyStatus(journeyCode: string): Promise<MitoJourneyStatusResult | null> {
  const cleanCode = String(journeyCode || "").trim();
  if (!cleanCode || !isMitoRetailConfigured()) return null;
  const creds = loadMitoRetailCredentials()!;
  try {
    const res = await fetch(
      `${creds.baseUrl}/api/v1/mito/Journey/status?journeyCode=${encodeURIComponent(cleanCode)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          apiKey: creds.apiKey,
        },
      },
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as {
      data?: {
        journeyCode?: string;
        journeyStatus?: string;
        orderNo?: string | null;
        orderStatus?: string | null;
        partnerReferenceNumber?: string | null;
        reference?: string | null;
        currency?: string | null;
        amount?: number | null;
      };
    };
    if (!body?.data) return null;
    return {
      journeyCode: String(body.data.journeyCode || cleanCode),
      journeyStatus: String(body.data.journeyStatus || ""),
      orderNo: body.data.orderNo ? String(body.data.orderNo) : null,
      orderStatus: body.data.orderStatus ? String(body.data.orderStatus) : null,
      partnerReferenceNumber: body.data.partnerReferenceNumber ? String(body.data.partnerReferenceNumber) : null,
      reference: body.data.reference ? String(body.data.reference) : null,
      currency: body.data.currency ? String(body.data.currency) : null,
      amount: typeof body.data.amount === "number" ? body.data.amount : null,
    };
  } catch (err) {
    console.warn("[mito-retail] getMitoJourneyStatus warning:", err);
    return null;
  }
}

// ─── Mito Retail Webhook Signing, Verification & Inspector Log ────────────────

const DEFAULT_MITO_WEBHOOK_SECRET_KEY = "f47ee7a1-aca4-4a6b-83a6-a802369bdddc";

export function getMitoWebhookSecretKey(overrideSecret?: string): string {
  if (overrideSecret && overrideSecret.trim()) return overrideSecret.trim();
  const creds = loadMitoRetailCredentials();
  if (creds?.webhookSecretKey) return creds.webhookSecretKey;
  return (process.env.MITO_RETAIL_WEBHOOK_SECRET || DEFAULT_MITO_WEBHOOK_SECRET_KEY).trim();
}

export function stripMitoSignatureFromRawJson(rawJson: string): string {
  // Trailing ,"signature":"..." before the final }
  const strippedTrailing = rawJson.replace(
    /\s*,\s*"signature"\s*:\s*"(?:\\.|[^"\\])*"\s*(\}\s*)$/,
    "$1",
  );
  if (strippedTrailing !== rawJson) return strippedTrailing;

  // Leading {"signature":"...", at the start of the JSON object
  const strippedLeading = rawJson.replace(
    /^(\s*\{\s*)"signature"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*/,
    "$1",
  );
  if (strippedLeading !== rawJson) return strippedLeading;

  // Middle ,"signature":"...", anywhere at top level
  return rawJson.replace(/,\s*"signature"\s*:\s*"(?:\\.|[^"\\])*"/, "");
}

export function computeMitoWebhookSignature(rawBodyWithoutSig: string, secret?: string): string {
  const key = getMitoWebhookSecretKey(secret);
  return crypto.createHmac("sha256", key).update(rawBodyWithoutSig, "utf8").digest("base64");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeSignatureValue(sig: string): string {
  return String(sig || "")
    .trim()
    .replace(/^sha256=/i, "")
    .replace(/\\u002[bB]/g, "+")
    .replace(/\\u003[dD]/g, "=")
    .replace(/\\u002[fF]/g, "/");
}

export function verifyMitoWebhookSignature(
  rawBody: string | Buffer | undefined,
  parsedBody: Record<string, any>,
  headers?: Record<string, any>,
  secretOverride?: string,
): {
  valid: boolean;
  hasSignature: boolean;
  reason: string;
  computedSignature?: string;
} {
  const secret = getMitoWebhookSecretKey(secretOverride);
  const rawStr =
    typeof rawBody === "string"
      ? rawBody
      : Buffer.isBuffer(rawBody)
        ? rawBody.toString("utf8")
        : "";

  const headerSigRaw =
    headers?.["x-mito-signature"] ||
    headers?.["x-webhook-signature"] ||
    headers?.["x-signature"] ||
    headers?.["mito-signature"] ||
    "";
  const headerSecretRaw =
    headers?.["x-webhook-secret"] ||
    headers?.["webhook-secret-key"] ||
    headers?.["mito-webhook-secret"] ||
    "";

  const bodySigRaw = parsedBody && typeof parsedBody.signature === "string" ? parsedBody.signature : "";
  const providedSig = normalizeSignatureValue(bodySigRaw || String(headerSigRaw || ""));
  const providedSecret = String(headerSecretRaw || "").trim();

  // Build candidate JSON strings without the "signature" property
  const candidates: string[] = [];
  if (rawStr) {
    const stripped = stripMitoSignatureFromRawJson(rawStr);
    candidates.push(stripped);
    if (stripped !== rawStr) {
      candidates.push(rawStr);
    }
  }
  if (parsedBody && typeof parsedBody === "object") {
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsedBody)) {
      if (k !== "signature") {
        clone[k] = v;
      }
    }
    const canonical = JSON.stringify(clone);
    if (!candidates.includes(canonical)) {
      candidates.push(canonical);
    }
  }

  const primaryComputed = candidates[0] ? computeMitoWebhookSignature(candidates[0], secret) : undefined;

  if (providedSecret && timingSafeEqualStr(providedSecret, secret)) {
    return {
      valid: true,
      hasSignature: true,
      reason: "Webhook secret header verified",
      computedSignature: primaryComputed,
    };
  }

  if (!providedSig) {
    return {
      valid: false,
      hasSignature: false,
      reason: "Missing signature",
      computedSignature: primaryComputed,
    };
  }

  for (const candidate of candidates) {
    const expectedB64 = computeMitoWebhookSignature(candidate, secret);
    if (timingSafeEqualStr(providedSig, expectedB64)) {
      return {
        valid: true,
        hasSignature: true,
        reason: "HMAC-SHA256 signature verified",
        computedSignature: expectedB64,
      };
    }
    const expectedHex = crypto.createHmac("sha256", secret).update(candidate, "utf8").digest("hex");
    if (timingSafeEqualStr(providedSig.toLowerCase(), expectedHex.toLowerCase())) {
      return {
        valid: true,
        hasSignature: true,
        reason: "HMAC-SHA256 hex signature verified",
        computedSignature: expectedB64,
      };
    }
  }

  return {
    valid: false,
    hasSignature: true,
    reason: "Signature mismatch",
    computedSignature: primaryComputed,
  };
}

export function signMitoWebhookPayload<T extends Record<string, unknown>>(
  payloadWithoutSig: T,
  secret?: string,
): T & { signature: string } {
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payloadWithoutSig)) {
    if (k !== "signature") {
      clone[k] = v;
    }
  }
  const rawWithoutSig = JSON.stringify(clone);
  const signature = computeMitoWebhookSignature(rawWithoutSig, secret);
  return {
    ...(clone as T),
    signature,
  };
}

export interface MitoWebhookInspectorLogEntry {
  Id: string;
  ReceivedAtUtc: string;
  Environment: string;
  Method: string;
  Path: string;
  QueryString: string;
  Headers: Record<string, string>;
  ContentType: string;
  ContentLength: number;
  RemoteIp: string;
  SignatureHeader: string | null;
  SignatureResult: string;
  ReturnedStatusCode: number;
  Body: string;
  EventId?: string | null;
  EventType?: string | null;
  Data?: Record<string, unknown> | null;
  Outcome?: Record<string, unknown> | null;
}

const MITO_WEBHOOK_LOGS_FILE = path.resolve(
  process.cwd(),
  ".dev-state",
  "mito-webhook-events.json",
);

const mitoWebhookInspectorLogs: MitoWebhookInspectorLogEntry[] = [];
let loadedWebhookLogsFromDisk = false;

function ensureWebhookLogsLoaded(): void {
  if (loadedWebhookLogsFromDisk) return;
  loadedWebhookLogsFromDisk = true;
  try {
    if (!fs.existsSync(MITO_WEBHOOK_LOGS_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(MITO_WEBHOOK_LOGS_FILE, "utf8"));
    if (Array.isArray(parsed)) {
      for (const item of parsed.slice(0, 100)) {
        if (item && typeof item === "object" && item.Id) {
          mitoWebhookInspectorLogs.push(item as MitoWebhookInspectorLogEntry);
        }
      }
    }
  } catch {
    // ignore disk read errors
  }
}

export function recordMitoWebhookInspectorLog(entry: MitoWebhookInspectorLogEntry): void {
  ensureWebhookLogsLoaded();
  mitoWebhookInspectorLogs.unshift(entry);
  if (mitoWebhookInspectorLogs.length > 100) {
    mitoWebhookInspectorLogs.length = 100;
  }
  try {
    const dir = path.dirname(MITO_WEBHOOK_LOGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MITO_WEBHOOK_LOGS_FILE, JSON.stringify(mitoWebhookInspectorLogs, null, 2), "utf8");
  } catch {
    // ignore disk write errors
  }
}

export function getMitoWebhookInspectorLogs(limit = 50): MitoWebhookInspectorLogEntry[] {
  ensureWebhookLogsLoaded();
  return mitoWebhookInspectorLogs.slice(0, Math.max(1, Math.min(200, limit)));
}


