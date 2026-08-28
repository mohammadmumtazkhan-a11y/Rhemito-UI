/**
 * Invoice Service — Rhemito Send Invoice MVP1
 *
 * Orchestrates the invoice lifecycle on top of the in-memory storage singleton,
 * mirroring the pattern used by notificationService.ts: synchronous
 * check-and-transition critical sections (safe on single-threaded Node),
 * setTimeout-based reminder scheduling with a periodic sweep as the safety net,
 * and a console.log stub for outbound client email delivery.
 */

import { randomUUID, randomBytes, createHash } from "crypto";
import { storage } from "./storage";
import { dispatchNotification } from "./notificationService";
import type {
  Invoice,
  InvoiceDocument,
  InvoiceEvent,
  ClientEmail,
  SendInvoicePayload,
} from "@shared/schema";
import {
  EXPIRY_TIMEZONE,
  computeInvoiceFees,
  clientDisplayName,
  dateInTz,
  deriveInvoiceStatus,
  formatHumanDate,
  formatInvoiceNumber,
  isDueReminderEligible,
  isExpiryReminderEligible,
  validateInvoiceDates,
  zonedTimeOnDateUTC,
  addDays,
} from "@shared/invoice-logic";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class InvoiceError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Abandoned temporary uploads are swept after one hour. */
export const TEMP_DOCUMENT_TTL_MS = 60 * 60 * 1000;
/** Simulated payment provider callback delay (no real PSP in the prototype). */
export const SIMULATED_PAYMENT_DELAY_MS = 4000;
/**
 * A payment accepted for processing must settle within this window; beyond it
 * the payment is treated as failed and the invoice reverts to its active
 * status (spec AC 30). Also covers completion timers lost to a restart.
 */
export const PAYMENT_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
/**
 * Node setTimeout delays above 2^31-1 ms (~24.8 days) overflow and fire
 * IMMEDIATELY — a 30-day default expiry timer therefore expired invoices
 * instantly. Timers beyond this bound are skipped; the 60s sweep (restart-safe
 * by design) already covers everything with that granularity.
 */
const MAX_TIMER_MS = 2 ** 31 - 1000;

function trackTimerSafely(invoiceId: string, delayMs: number, fn: () => void): void {
  if (delayMs > MAX_TIMER_MS) return; // sweep covers it
  trackTimer(invoiceId, setTimeout(fn, delayMs));
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

// ─── Timers ───────────────────────────────────────────────────────────────────

const activeInvoiceTimers = new Map<string, NodeJS.Timeout[]>();
let sweepTimer: NodeJS.Timeout | null = null;

function trackTimer(invoiceId: string, timer: NodeJS.Timeout) {
  const timers = activeInvoiceTimers.get(invoiceId) ?? [];
  timers.push(timer);
  activeInvoiceTimers.set(invoiceId, timers);
}

export function clearInvoiceTimers(invoiceId: string) {
  const timers = activeInvoiceTimers.get(invoiceId);
  if (timers) {
    timers.forEach((t) => clearTimeout(t));
    activeInvoiceTimers.delete(invoiceId);
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function invoiceExpiryDate(inv: Invoice): string {
  return dateInTz(inv.expiresAt, inv.expiryTimezone);
}

export function buildPaymentLink(inv: Invoice, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/invoice/${inv.token}`;
}

// ─── Client email stub (recorded delivery) ────────────────────────────────────

interface ClientEmailContent {
  type: ClientEmail["type"];
  subject: string;
  body: string;
  attachment?: {
    fileName: string;
    mimeType: string;
    size: number;
  } | null;
}

function invoiceSentEmail(inv: Invoice, link: string, doc: InvoiceDocument | null): ClientEmailContent {
  const due = inv.dueDate
    ? `Due Date: ${formatHumanDate(inv.dueDate)}\n`
    : "";
  return {
    type: "invoice_sent",
    subject: `Invoice ${inv.invoiceNumber} from ${inv.senderName}: ${inv.currency} ${inv.amount}`,
    body:
      `Hello,\n\n` +
      `${inv.senderName} has sent you invoice ${inv.invoiceNumber} for ${inv.currency} ${inv.amount}.\n\n` +
      `${due}` +
      `Payment Link Expiry Date: ${formatHumanDate(invoiceExpiryDate(inv))} ` +
      `(payment can be started until 11:59 p.m. on this date).\n\n` +
      `The invoice document is attached to this email. You can also view and pay this invoice securely here:\n${link}\n\n` +
      `— Rhemito`,
    attachment: doc
      ? { fileName: doc.fileName, mimeType: doc.mimeType, size: Number(doc.size) }
      : null,
  };
}

function dueReminderEmail(inv: Invoice): ClientEmailContent {
  return {
    type: "due_reminder",
    subject: `Invoice ${inv.invoiceNumber} from ${inv.senderName} is due today`,
    body:
      `Invoice ${inv.invoiceNumber} from ${inv.senderName} is due today. ` +
      `You can make payment until ${formatHumanDate(invoiceExpiryDate(inv))}.\n\n` +
      `— Rhemito`,
  };
}

function expiryReminderEmail(inv: Invoice): ClientEmailContent {
  return {
    type: "expiry_reminder",
    subject: `Your payment link for invoice ${inv.invoiceNumber} expires soon`,
    body:
      `Your payment link for invoice ${inv.invoiceNumber} from ${inv.senderName} ` +
      `expires on ${formatHumanDate(invoiceExpiryDate(inv))}.\n\n` +
      `— Rhemito`,
  };
}

function cancellationEmail(inv: Invoice): ClientEmailContent {
  const cancelledOn = inv.cancelledAt ? formatHumanDate(dateInTz(inv.cancelledAt, inv.expiryTimezone)) : "";
  return {
    type: "cancellation",
    subject: `Invoice ${inv.invoiceNumber} from ${inv.senderName} was cancelled`,
    body:
      `Invoice ${inv.invoiceNumber} from ${inv.senderName} was cancelled on ${cancelledOn}. ` +
      `Reason: ${inv.cancellationReason}. ` +
      `Payment can no longer be made using this invoice link.\n\n` +
      `— Rhemito`,
  };
}

/**
 * Queue an outbound client email. Idempotent on dedupeKey: retries never
 * generate duplicate emails — an existing record is returned unchanged.
 */
async function queueClientEmail(
  inv: Invoice,
  content: ClientEmailContent,
  dedupeKey: string,
): Promise<ClientEmail> {
  const existing = await storage.getClientEmailByDedupeKey(dedupeKey);
  if (existing) return existing;

  const attachmentLine = content.attachment
    ? ` | Attachment: ${content.attachment.fileName} (${content.attachment.mimeType}, ${content.attachment.size} bytes)`
    : "";
  console.log(
    `[CLIENT EMAIL STUB] To: ${inv.clientEmail} | Subject: ${content.subject} | Body:\n${content.body}${attachmentLine}`,
  );

  const email: ClientEmail = {
    id: randomUUID(),
    invoiceId: inv.id,
    toEmail: inv.clientEmail,
    type: content.type,
    subject: content.subject,
    body: content.body,
    attachmentFileName: content.attachment?.fileName ?? null,
    attachmentMimeType: content.attachment?.mimeType ?? null,
    attachmentSize: content.attachment ? String(content.attachment.size) : null,
    status: "sent",
    attemptCount: "1",
    lastAttemptAt: new Date(),
    dedupeKey,
    createdAt: new Date(),
  };
  return storage.addClientEmail(email);
}

// ─── Serialization ────────────────────────────────────────────────────────────

export interface InvoiceJSON {
  id: string;
  invoiceNumber: string;
  senderId: string;
  senderName: string;
  clientName: string;
  clientType: string;
  clientFirstName: string | null;
  clientMiddleName: string | null;
  clientLastName: string | null;
  clientBusinessName: string | null;
  clientEmail: string;
  clientPhoneCode: string | null;
  clientPhoneNumber: string | null;
  amount: string;
  currency: string;
  absorbFee: boolean;
  payoutAccountBank: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
  payoutAccountCurrency: string;
  paymentMethod: string | null;
  fees: ReturnType<typeof computeInvoiceFees>;
  dueDate: string | null;
  expiryDate: string;
  expiresAt: string;
  expiryTimezone: string;
  status: string; // derived display status
  paymentRef: string | null;
  documentId: string | null;
  sentAt: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  newLinkRequestedAt: string | null;
  newLinkRequestedBy: string | null;
  createdAt: string | null;
}

export function toInvoiceJSON(inv: Invoice): InvoiceJSON {
  const now = new Date();
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    senderId: inv.senderId,
    senderName: inv.senderName,
    clientName: clientDisplayName(inv),
    clientType: inv.clientType,
    clientFirstName: inv.clientFirstName ?? null,
    clientMiddleName: inv.clientMiddleName ?? null,
    clientLastName: inv.clientLastName ?? null,
    clientBusinessName: inv.clientBusinessName ?? null,
    clientEmail: inv.clientEmail,
    clientPhoneCode: inv.clientPhoneCode ?? null,
    clientPhoneNumber: inv.clientPhoneNumber ?? null,
    amount: inv.amount,
    currency: inv.currency,
    absorbFee: inv.absorbFee,
    payoutAccountBank: inv.payoutAccountBank,
    payoutAccountNumber: inv.payoutAccountNumber,
    payoutAccountName: inv.payoutAccountName,
    payoutAccountCurrency: inv.payoutAccountCurrency,
    paymentMethod: inv.paymentMethod ?? null,
    fees: computeInvoiceFees(inv.amount, inv.absorbFee),
    dueDate: inv.dueDate ?? null,
    expiryDate: invoiceExpiryDate(inv),
    expiresAt: inv.expiresAt.toISOString(),
    expiryTimezone: inv.expiryTimezone,
    status: deriveInvoiceStatus(inv, now),
    paymentRef: inv.paymentRef ?? null,
    documentId: inv.documentId ?? null,
    sentAt: inv.sentAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    expiredAt: inv.expiredAt?.toISOString() ?? null,
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    cancellationReason: inv.cancellationReason ?? null,
    cancelledBy: inv.cancelledBy ?? null,
    newLinkRequestedAt: inv.newLinkRequestedAt?.toISOString() ?? null,
    newLinkRequestedBy: inv.newLinkRequestedBy ?? null,
    createdAt: inv.createdAt?.toISOString() ?? null,
  };
}

/** Public (unauthenticated) projection — only what the payment page needs. */
export function toPublicInvoiceJSON(inv: Invoice) {
  const now = new Date();
  const status = deriveInvoiceStatus(inv, now);
  return {
    invoiceNumber: inv.invoiceNumber,
    senderName: inv.senderName,
    amount: inv.amount,
    currency: inv.currency,
    fees: computeInvoiceFees(inv.amount, inv.absorbFee),
    hasDocument: Boolean(inv.documentId),
    // Client snapshot powers the prefilled registration on the payment page.
    // The client's email is intentionally NOT exposed — the payer enters
    // their own email during identification.
    clientType: inv.clientType,
    clientFirstName: inv.clientFirstName ?? null,
    clientMiddleName: inv.clientMiddleName ?? null,
    clientLastName: inv.clientLastName ?? null,
    clientBusinessName: inv.clientBusinessName ?? null,
    dueDate: inv.dueDate ?? null,
    expiryDate: invoiceExpiryDate(inv),
    expiryTimezone: inv.expiryTimezone,
    status,
    paymentRef: inv.paymentRef ?? null,
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    cancellationReason: inv.cancellationReason ?? null,
    newLinkRequestedAt: inv.newLinkRequestedAt?.toISOString() ?? null,
  };
}

// ─── Temporary document uploads ───────────────────────────────────────────────

export async function createTempDocument(params: {
  uploaderId: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataBase64: string;
}): Promise<InvoiceDocument> {
  const { uploaderId, fileName, mimeType, size, dataBase64 } = params;

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new InvoiceError(400, "VALIDATION_ERROR", "The invoice document must be a PDF, PNG or JPG file.");
  }
  if (size > MAX_DOCUMENT_BYTES) {
    throw new InvoiceError(400, "VALIDATION_ERROR", "The invoice document must be 10MB or smaller.");
  }

  const now = new Date();
  const doc: InvoiceDocument = {
    id: randomUUID(),
    uploaderId,
    fileName,
    mimeType,
    size: String(size),
    data: dataBase64,
    status: "temp",
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + TEMP_DOCUMENT_TTL_MS),
  };
  return storage.createInvoiceDocument(doc);
}

async function assertDocumentAttachable(documentId: string, senderId: string): Promise<InvoiceDocument> {
  const doc = await storage.getInvoiceDocument(documentId);
  if (!doc || doc.uploaderId !== senderId) {
    throw new InvoiceError(400, "VALIDATION_ERROR", "An invoice document must be attached before sending.");
  }
  if (doc.status !== "temp") {
    throw new InvoiceError(400, "VALIDATION_ERROR", "This document has already been attached to an invoice.");
  }
  return doc;
}

// ─── Invoice creation (Confirm and Send) ──────────────────────────────────────

export interface CreateInvoiceResult {
  invoice: Invoice;
  token: string;
  paymentLink: string;
  alreadyExisted: boolean;
}

export async function confirmAndSendInvoice(params: {
  senderId: string;
  senderName: string | null;
  payload: SendInvoicePayload;
  baseUrl: string;
}): Promise<CreateInvoiceResult> {
  const { senderId, senderName, payload, baseUrl } = params;
  const now = new Date();

  // Idempotency: repeated confirmations (double-click, browser retry, repeated
  // API call) return the originally created invoice instead of a duplicate.
  const existing = await storage.getInvoiceByIdempotencyKey(senderId, payload.idempotencyKey);
  if (existing) {
    return {
      invoice: existing,
      token: existing.token,
      paymentLink: buildPaymentLink(existing, baseUrl),
      alreadyExisted: true,
    };
  }

  // The payout account is server-owned: it must exist, belong to the sender,
  // and be verified. The browser never supplies raw bank details.
  const payoutAccount = await storage.getPayoutAccountById(payload.payoutAccountId);
  if (!payoutAccount || payoutAccount.ownerId !== senderId) {
    throw new InvoiceError(
      404,
      "NOT_FOUND",
      "The selected payout account could not be found. Add and verify a payout account, then try again.",
    );
  }
  if (payoutAccount.verificationStatus !== "verified") {
    throw new InvoiceError(
      400,
      "VALIDATION_ERROR",
      "The receiving payout account must be verified before sending an invoice.",
    );
  }
  const effectiveSenderName = senderName ?? payoutAccount.holderName;

  // Authoritative date validation, re-run at final confirmation.
  const { computation, errors } = validateInvoiceDates(payload.dueDate, payload.expiry, now);
  if (errors.length > 0) {
    throw new InvoiceError(400, "VALIDATION_ERROR", errors[0]);
  }

  const doc = await assertDocumentAttachable(payload.documentId, senderId);

  const sequence = await storage.nextInvoiceSequence();
  // Month prefix follows the invoice timezone, not UTC.
  const yearMonth = dateInTz(now, EXPIRY_TIMEZONE).slice(0, 7);
  const token = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invoice: Invoice = {
    id: randomUUID(),
    invoiceNumber: formatInvoiceNumber(sequence, yearMonth),
    senderId,
    senderName: effectiveSenderName,
    clientType: payload.clientType,
    clientFirstName: payload.clientFirstName ?? null,
    clientMiddleName: payload.clientMiddleName ?? null,
    clientLastName: payload.clientLastName ?? null,
    clientBusinessName: payload.clientBusinessName ?? null,
    clientEmail: payload.clientEmail.toLowerCase(),
    clientPhoneCode: payload.clientPhoneCode ?? null,
    clientPhoneNumber: payload.clientPhoneNumber ?? null,
    amount: payload.invoiceAmount,
    currency: payload.currency,
    absorbFee: payload.absorbFee,
    payoutAccountBank: payoutAccount.bankName,
    payoutAccountNumber: payoutAccount.accountNumber,
    payoutAccountName: payoutAccount.holderName,
    payoutAccountCurrency: payoutAccount.currency,
    paymentInitiatedAt: null,
    paymentMethod: null,
    payerUserId: null,
    dueDate: payload.dueDate ?? null,
    expiresAt: computation.expiresAt,
    expiryTimezone: EXPIRY_TIMEZONE,
    status: "sent",
    paymentRef: null,
    token,
    tokenHash,
    documentId: doc.id,
    sentAt: now,
    paidAt: null,
    expiredAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
    dueReminderSentAt: null,
    expiryReminderSentAt: null,
    newLinkRequestedAt: null,
    newLinkRequestedBy: null,
    idempotencyKey: payload.idempotencyKey,
    createdAt: now,
  };

  await storage.createInvoice(invoice);
  await storage.associateInvoiceDocument(doc.id);

  await storage.addInvoiceEvent(invoiceEvent(invoice.id, "invoice_generated", {
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    expiresAt: invoice.expiresAt.toISOString(),
  }, senderId));

  // The invoice document travels with the client email that carries the link.
  const link = buildPaymentLink(invoice, baseUrl);
  await queueClientEmail(invoice, invoiceSentEmail(invoice, link, doc), `${invoice.id}:invoice_sent`);
  await storage.addInvoiceEvent(invoiceEvent(invoice.id, "notification_queued", {
    to: invoice.clientEmail,
    type: "invoice_sent",
    link,
    attachment: doc.fileName,
  }, senderId));

  scheduleInvoiceTimers(invoice);

  return { invoice, token, paymentLink: link, alreadyExisted: false };
}

function invoiceEvent(
  invoiceId: string,
  type: InvoiceEvent["type"],
  payload: Record<string, unknown>,
  actor?: string,
): InvoiceEvent {
  return {
    id: randomUUID(),
    invoiceId,
    type,
    payload,
    actor: actor ?? null,
    createdAt: new Date(),
  };
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

export async function cancelInvoice(params: {
  invoiceId: string;
  userId: string;
  reason: string;
}): Promise<{ invoice: Invoice; alreadyCancelled: boolean }> {
  const { invoiceId, userId, reason } = params;
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv || inv.senderId !== userId) {
    throw new InvoiceError(404, "NOT_FOUND", "Invoice not found.");
  }

  const now = new Date();

  // Idempotent: cancelling an already-cancelled invoice returns current state.
  if (inv.status === "cancelled") {
    return { invoice: inv, alreadyCancelled: true };
  }

  // Critical section: synchronous check-and-transition so a concurrent payment
  // initiation resolves to exactly one outcome (single-threaded Node).
  const status = deriveInvoiceStatus(inv, now);
  if (status === "paid" || inv.status === "paid") {
    throw new InvoiceError(409, "INVALID_STATE", "Paid invoices cannot be cancelled.");
  }
  if (status === "payment_processing" || inv.status === "payment_processing") {
    throw new InvoiceError(409, "INVALID_STATE", "This invoice cannot be cancelled while a payment is processing.");
  }
  if (status === "expired" || inv.status === "expired") {
    throw new InvoiceError(409, "INVALID_STATE", "Expired invoices cannot be cancelled.");
  }

  const updated: Invoice = {
    ...inv,
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: userId,
    cancellationReason: reason,
  };
  await storage.updateInvoice(invoiceId, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: userId,
    cancellationReason: reason,
  });

  clearInvoiceTimers(invoiceId);

  await storage.addInvoiceEvent(invoiceEvent(invoiceId, "invoice_cancelled", {
    reason,
    cancelledBy: userId,
    cancelledAt: now.toISOString(),
  }, userId));

  await queueClientEmail(updated, cancellationEmail(updated), `${invoiceId}:cancellation`);

  await dispatchNotification({
    userId,
    type: "invoice_cancelled",
    data: {
      invoiceNumber: updated.invoiceNumber,
      clientName: clientDisplayName(updated),
      amount: updated.amount,
      currency: updated.currency,
      reason,
    },
  });

  return { invoice: updated, alreadyCancelled: false };
}

// ─── Token lookup ─────────────────────────────────────────────────────────────

export async function getInvoiceByToken(token: string): Promise<Invoice | undefined> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return storage.getInvoiceByTokenHash(tokenHash);
}

// ─── Payment initiation (simulated provider) ──────────────────────────────────

export async function initiatePaymentByToken(
  token: string,
  method?: "card" | "bank_transfer",
  payer?: { userId: string; email: string },
): Promise<{
  status: string;
  paymentRef: string;
}> {
  const inv = await getInvoiceByToken(token);
  if (!inv) {
    throw new InvoiceError(404, "NOT_FOUND", "Invoice not found.");
  }

  const now = new Date();

  // Real-time checks — the frontend status and background sweep are never the
  // only line of defence.
  if (inv.status === "paid") {
    throw new InvoiceError(409, "ALREADY_PAID", "This invoice has already been paid.");
  }
  if (inv.status === "payment_processing") {
    throw new InvoiceError(409, "ALREADY_PROCESSING", "A payment for this invoice is already being processed.");
  }
  if (inv.status === "cancelled") {
    throw new InvoiceError(409, "INVOICE_CANCELLED", "This invoice was cancelled and can no longer be paid.");
  }
  if (now.getTime() >= inv.expiresAt.getTime()) {
    await materializeExpiredInvoice(inv);
    throw new InvoiceError(410, "INVOICE_EXPIRED", "This payment link has expired. Please request a new payment link from the invoice sender.");
  }

  // Critical section: accepted for processing before expiry — this payment must
  // be allowed to reach its final result even if expiry passes mid-flight.
  const paymentRef = `PAY-${randomBytes(8).toString("hex").toUpperCase()}`;
  await storage.updateInvoice(inv.id, {
    status: "payment_processing",
    paymentRef,
    paymentInitiatedAt: now,
    paymentMethod: method ?? null,
    payerUserId: payer?.userId ?? null,
  });

  const payerActor = payer ? `payer:${payer.email}` : "client";
  await storage.addInvoiceEvent(invoiceEvent(inv.id, "payment_initiated", { paymentRef, method: method ?? null, payerUserId: payer?.userId ?? null }, payerActor));
  await storage.addInvoiceEvent(invoiceEvent(inv.id, "payment_processing", { paymentRef, method: method ?? null }, payerActor));

  clearInvoiceTimers(inv.id);

  // Simulated provider callback → Paid.
  const timer = setTimeout(() => {
    completePayment(inv.id).catch((err) =>
      console.error(`[invoiceService] completePayment failed for ${inv.id}:`, err),
    );
  }, SIMULATED_PAYMENT_DELAY_MS);
  trackTimer(inv.id, timer);

  return { status: "payment_processing", paymentRef };
}

async function completePayment(invoiceId: string): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv || inv.status !== "payment_processing") return;

  const now = new Date();
  await storage.updateInvoice(invoiceId, { status: "paid", paidAt: now });
  await storage.addInvoiceEvent(invoiceEvent(invoiceId, "payment_completed", {
    paymentRef: inv.paymentRef,
    paidAt: now.toISOString(),
  }, "payment_provider"));

  await dispatchNotification({
    userId: inv.senderId,
    type: "invoice_paid",
    data: {
      invoiceNumber: inv.invoiceNumber,
      clientName: clientDisplayName(inv),
      amount: inv.amount,
      currency: inv.currency,
    },
  });
}

// ─── Expiry materialization & Request New Payment Link ────────────────────────

async function materializeExpiredInvoice(inv: Invoice): Promise<Invoice> {
  if (inv.status !== "sent") return inv; // never touch Paid / Processing / Cancelled

  const now = new Date();
  const updated: Invoice = { ...inv, status: "expired", expiredAt: now };
  await storage.updateInvoice(inv.id, { status: "expired", expiredAt: now });
  clearInvoiceTimers(inv.id);

  await storage.addInvoiceEvent(invoiceEvent(inv.id, "invoice_expired", {
    expiredAt: now.toISOString(),
  }, "system"));

  await dispatchNotification({
    userId: inv.senderId,
    type: "invoice_expired",
    data: {
      invoiceNumber: inv.invoiceNumber,
      clientName: clientDisplayName(inv),
      amount: inv.amount,
      currency: inv.currency,
      expiredDate: formatHumanDate(dateInTz(now, inv.expiryTimezone)),
    },
  });

  return updated;
}

export async function requestNewPaymentLink(params: {
  token: string;
  requesterEmail?: string;
}): Promise<{ alreadyRequested: boolean; requestedAt: Date }> {
  const inv = await getInvoiceByToken(params.token);
  if (!inv) {
    throw new InvoiceError(404, "NOT_FOUND", "Invoice not found.");
  }

  const now = new Date();

  // Materialize expiry first so the request is evaluated against stored state.
  let current = inv;
  if (now.getTime() >= inv.expiresAt.getTime()) {
    current = await materializeExpiredInvoice(inv);
  }

  const status = deriveInvoiceStatus(current, now);
  if (status !== "expired") {
    throw new InvoiceError(409, "INVALID_STATE", "A new payment link can only be requested after the invoice has expired.");
  }

  // Duplicate requests return the existing request result — no repeat notification.
  if (current.newLinkRequestedAt) {
    return { alreadyRequested: true, requestedAt: current.newLinkRequestedAt };
  }

  const requester = params.requesterEmail ?? current.clientEmail;
  const requestedAt = new Date();
  await storage.updateInvoice(current.id, {
    newLinkRequestedAt: requestedAt,
    newLinkRequestedBy: requester,
  });

  await storage.addInvoiceEvent(invoiceEvent(current.id, "new_link_requested", {
    requestedBy: requester,
    requestedAt: requestedAt.toISOString(),
  }, "client"));

  await dispatchNotification({
    userId: current.senderId,
    type: "invoice_new_link_requested",
    data: {
      invoiceNumber: current.invoiceNumber,
      clientName: clientDisplayName(current),
      clientEmail: current.clientEmail,
      amount: current.amount,
      currency: current.currency,
      originalExpiryDate: formatHumanDate(invoiceExpiryDate(current)),
      requestDate: formatHumanDate(dateInTz(requestedAt, current.expiryTimezone)),
    },
  });

  return { alreadyRequested: false, requestedAt };
}

// ─── Notification resend ──────────────────────────────────────────────────────

export async function resendInvoiceNotification(params: {
  invoiceId: string;
  userId: string;
  baseUrl: string;
}): Promise<ClientEmail> {
  const { invoiceId, userId, baseUrl } = params;
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv || inv.senderId !== userId) {
    throw new InvoiceError(404, "NOT_FOUND", "Invoice not found.");
  }

  const now = new Date();
  const status = deriveInvoiceStatus(inv, now);
  if (status !== "sent" && status !== "overdue") {
    throw new InvoiceError(409, "INVALID_STATE", "Notifications can only be resent for active unpaid invoices.");
  }

  // Same invoice, same payment link — never a new invoice or link.
  const link = buildPaymentLink(inv, baseUrl);
  const doc = (inv.documentId ? await storage.getInvoiceDocument(inv.documentId) : null) ?? null;
  const content = invoiceSentEmail(inv, link, doc);
  const attachmentLine = content.attachment
    ? ` | Attachment: ${content.attachment.fileName} (${content.attachment.mimeType}, ${content.attachment.size} bytes)`
    : "";
  console.log(
    `[CLIENT EMAIL STUB — RESEND] To: ${inv.clientEmail} | Subject: ${content.subject} | Body:\n${content.body}${attachmentLine}`,
  );

  const resendKey = `${invoiceId}:invoice_sent:resend:${now.getTime()}`;
  const email: ClientEmail = {
    id: randomUUID(),
    invoiceId,
    toEmail: inv.clientEmail,
    type: content.type,
    subject: content.subject,
    body: content.body,
    attachmentFileName: content.attachment?.fileName ?? null,
    attachmentMimeType: content.attachment?.mimeType ?? null,
    attachmentSize: content.attachment ? String(content.attachment.size) : null,
    status: "sent",
    attemptCount: "1",
    lastAttemptAt: now,
    dedupeKey: resendKey,
    createdAt: now,
  };
  const stored = await storage.addClientEmail(email);

  await storage.addInvoiceEvent(invoiceEvent(invoiceId, "notification_queued", {
    to: inv.clientEmail,
    type: "invoice_sent",
    link,
    resend: true,
  }, userId));

  return stored;
}

// ─── Reminder scheduling + periodic sweep ─────────────────────────────────────

function scheduleInvoiceTimers(inv: Invoice): void {
  const now = Date.now();

  // Due Date reminder — fires at 9 a.m. on the Due Date.
  if (inv.dueDate) {
    const fireAt = zonedTimeOnDateUTC(inv.dueDate, 9, 0, 0, inv.expiryTimezone).getTime();
    if (fireAt > now) {
      trackTimerSafely(inv.id, fireAt - now, () => {
        runDueReminder(inv.id).catch((err) =>
          console.error(`[invoiceService] due reminder failed for ${inv.id}:`, err),
        );
      });
    }
  }

  // Expiry reminder — three calendar days before expiry, when eligible.
  const expiryDate = dateInTz(inv.expiresAt, inv.expiryTimezone);
  const reminderDate = addDays(expiryDate, -3);
  const sentDate = dateInTz(inv.sentAt ?? new Date(), inv.expiryTimezone);
  if (sentDate < reminderDate) {
    const fireAt = zonedTimeOnDateUTC(reminderDate, 9, 0, 0, inv.expiryTimezone).getTime();
    if (fireAt > now && fireAt < inv.expiresAt.getTime()) {
      trackTimerSafely(inv.id, fireAt - now, () => {
        runExpiryReminder(inv.id).catch((err) =>
          console.error(`[invoiceService] expiry reminder failed for ${inv.id}:`, err),
        );
      });
    }
  }

  // Expiry materialization (the sweep below is the restart-safe safety net
  // and the ONLY handler for expiries beyond the timer bound).
  if (inv.expiresAt.getTime() > now) {
    trackTimerSafely(inv.id, inv.expiresAt.getTime() - now + 1000, () => {
      materializeInvoiceIfExpiredById(inv.id).catch((err) =>
        console.error(`[invoiceService] expiry failed for ${inv.id}:`, err),
      );
    });
  }
}

async function materializeInvoiceIfExpiredById(invoiceId: string): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (inv) await materializeExpiredInvoice(inv);
}

async function runDueReminder(invoiceId: string): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv || !isDueReminderEligible(inv, new Date())) return;

  await storage.updateInvoice(invoiceId, { dueReminderSentAt: new Date() });
  await queueClientEmail(inv, dueReminderEmail(inv), `${invoiceId}:due_reminder`);
  await storage.addInvoiceEvent(invoiceEvent(invoiceId, "due_reminder_sent", {}, "system"));
}

async function runExpiryReminder(invoiceId: string): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv || !isExpiryReminderEligible(inv, new Date())) return;

  await storage.updateInvoice(invoiceId, { expiryReminderSentAt: new Date() });
  await queueClientEmail(inv, expiryReminderEmail(inv), `${invoiceId}:expiry_reminder`);
  await storage.addInvoiceEvent(invoiceEvent(invoiceId, "expiry_reminder_sent", {}, "system"));
}

async function sweepOnce(): Promise<void> {
  const now = new Date();

  // Reminders, expiry materialization and stalled-payment recovery (covers
  // timers lost to a restart).
  for (const inv of await storage.listAllInvoicesRaw()) {
    try {
      await runDueReminder(inv.id);
      await runExpiryReminder(inv.id);
      if (now.getTime() >= inv.expiresAt.getTime()) {
        await materializeInvoiceIfExpiredById(inv.id);
      }
      await revertStalledPayment(inv.id, now);
    } catch (err) {
      console.error(`[invoiceService] sweep failed for ${inv.id}:`, err);
    }
  }

  // Abandoned temporary upload cleanup — associated documents are never removed.
  for (const doc of await storage.listExpiredTempDocuments()) {
    await storage.deleteInvoiceDocument(doc.id);
  }
}

/**
 * A payment that never settles (e.g. the simulated provider callback was lost
 * to a restart) is treated as failed: the invoice reverts to its applicable
 * active status — Sent, or Overdue/Expired as derived at that point.
 */
async function revertStalledPayment(invoiceId: string, now: Date): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (inv?.status !== "payment_processing" || !inv.paymentInitiatedAt) return;
  if (now.getTime() - inv.paymentInitiatedAt.getTime() < PAYMENT_PROCESSING_TIMEOUT_MS) return;

  await storage.updateInvoice(invoiceId, { status: "sent", paymentInitiatedAt: null });
  await storage.addInvoiceEvent(invoiceEvent(invoiceId, "payment_failed", {
    paymentRef: inv.paymentRef,
    method: inv.paymentMethod,
    reason: "processing_timeout",
    revertedAt: now.toISOString(),
  }, "system"));
  console.warn(
    `[invoiceService] payment ${inv.paymentRef} for ${inv.invoiceNumber} did not settle within ` +
      `${PAYMENT_PROCESSING_TIMEOUT_MS / 1000}s — invoice reverted to active status.`,
  );
}

/** Start the periodic sweep (idempotent). Called when routes are registered. */
export function startInvoiceSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweepOnce().catch((err) => console.error("[invoiceService] sweep error:", err));
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
}

// ─── Dev-only simulation hooks (e2e journeys; disabled in production) ─────────

export async function simulateOverdue(invoiceId: string): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv) throw new InvoiceError(404, "NOT_FOUND", "Invoice not found.");
  const today = dateInTz(new Date(), inv.expiryTimezone);
  await storage.updateInvoice(invoiceId, { dueDate: addDays(today, -1) });
}

export async function simulateExpiry(invoiceId: string): Promise<void> {
  const inv = await storage.getInvoiceById(invoiceId);
  if (!inv) throw new InvoiceError(404, "NOT_FOUND", "Invoice not found.");
  await storage.updateInvoice(invoiceId, { expiresAt: new Date(Date.now() - 1000) });
  const fresh = await storage.getInvoiceById(invoiceId);
  if (fresh) await materializeExpiredInvoice(fresh);
}
