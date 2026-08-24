/**
 * Invoice Routes — Rhemito Send Invoice MVP1
 *
 * Follows the conventions of routes.ts / auth.ts: inline Express handlers,
 * session-based auth with the prototype demo-user fallback, and the
 * notifications error shape { error: { code, message } }.
 */

import type { Express, Request, Response } from "express";
import express from "express";
import { randomInt } from "crypto";
import { storage } from "./storage";
import { demoModeEnabled, serverConfig } from "./config";
import { rateLimit, clientIpOf } from "./rateLimit";
import { sendInvoiceSchema, cancelInvoiceSchema, requestNewLinkSchema, payInvoiceSchema, emailCheckSchema } from "@shared/schema";
import { clientDisplayName } from "@shared/invoice-logic";
import {
  InvoiceError,
  cancelInvoice,
  confirmAndSendInvoice,
  createTempDocument,
  getInvoiceByToken,
  initiatePaymentByToken,
  requestNewPaymentLink,
  resendInvoiceNotification,
  simulateExpiry,
  simulateOverdue,
  startInvoiceSweep,
  toInvoiceJSON,
  toPublicInvoiceJSON,
} from "./invoiceService";

/** Same prototype guard pattern as routes.ts — falls back to the demo user. */
function requireAuth(req: Request): string {
  return req.session?.userId ?? "user_123";
}

/** Public invoice endpoint rate limiting (mirrors requestRoutes' pattern). */
function enforceInvoiceRateLimit(req: Request, res: Response, name: keyof typeof serverConfig.rateLimits): boolean {
  const { limit, windowMs } = serverConfig.rateLimits[name];
  const result = rateLimit(`invoice:${name}:${clientIpOf(req)}`, limit, windowMs);
  if (!result.allowed) {
    res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." } });
    return false;
  }
  return true;
}

function baseUrlFrom(req: Request): string {
  const origin = req.get("origin");
  if (origin) return origin;
  const host = req.get("host") ?? "localhost:5000";
  return `${req.protocol}://${host}`;
}

/** Auth-user display name, or null when the prototype demo user is active. */
async function senderDisplayName(userId: string): Promise<string | null> {
  const user = await storage.getAuthUserById(userId);
  if (!user) return null;
  const name = clientDisplayName({
    clientType: user.accountType,
    clientFirstName: user.firstName,
    clientMiddleName: user.middleName,
    clientLastName: user.lastName,
    clientBusinessName: user.businessName,
  });
  return name || user.email;
}

function handleInvoiceError(res: Response, err: unknown): void {
  if (err instanceof InvoiceError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error("[invoiceRoutes] unexpected error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}

function firstZodMessage(err: { issues: { message: string }[] }): string {
  return err.issues[0]?.message ?? "Invalid request.";
}

export function registerInvoiceRoutes(app: Express): void {
  // ─── Temporary document upload ──────────────────────────────────────────────
  // Sent as raw octet-stream so the global express.json 100kb limit does not
  // reject legitimate 10MB documents; base64-encodes server-side.
  app.post(
    "/api/invoices/documents",
    express.raw({ type: "application/octet-stream", limit: "16mb" }),
    async (req: Request, res: Response) => {
      try {
        const uploaderId = requireAuth(req);
        const fileName = String(req.query.fileName ?? "invoice.pdf");
        const mimeType = String(req.query.mimeType ?? "application/pdf");
        const buffer = req.body as Buffer;

        if (!buffer || !buffer.length) {
          return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No document was uploaded." } });
        }

        const doc = await createTempDocument({
          uploaderId,
          fileName,
          mimeType,
          size: buffer.length,
          dataBase64: buffer.toString("base64"),
        });

        return res.status(201).json({
          data: { documentId: doc.id, fileName: doc.fileName, size: Number(doc.size) },
        });
      } catch (err) {
        return handleInvoiceError(res, err);
      }
    },
  );

  // ─── Confirm and Send Invoice ───────────────────────────────────────────────
  app.post("/api/invoices", async (req: Request, res: Response) => {
    try {
      const senderId = requireAuth(req);
      const parsed = sendInvoiceSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }

      // Client-facing sender name: the verified profile name when logged in.
      // The service falls back to the verified payout account holder name.
      const senderName = await senderDisplayName(senderId);
      const result = await confirmAndSendInvoice({
        senderId,
        senderName,
        payload: parsed.data,
        baseUrl: baseUrlFrom(req),
      });

      return res.status(result.alreadyExisted ? 200 : 201).json({
        data: {
          invoice: toInvoiceJSON(result.invoice),
          paymentLink: result.paymentLink,
          alreadyExisted: result.alreadyExisted,
        },
      });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Sent Invoices list ─────────────────────────────────────────────────────
  app.get("/api/invoices", async (req: Request, res: Response) => {
    try {
      const senderId = requireAuth(req);
      const result = await storage.listInvoices({
        senderId,
        search: req.query.search ? String(req.query.search) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        sentFrom: req.query.sentFrom ? String(req.query.sentFrom) : undefined,
        sentTo: req.query.sentTo ? String(req.query.sentTo) : undefined,
        page: parseInt(String(req.query.page ?? "1"), 10) || 1,
        pageSize: 20,
      });

      return res.json({
        data: result.invoices.map(toInvoiceJSON),
        meta: { page: result.page, pageSize: result.pageSize, total: result.total },
      });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Invoice Details ────────────────────────────────────────────────────────
  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const userId = requireAuth(req);
      const inv = await storage.getInvoiceById(req.params.id);
      if (!inv || inv.senderId !== userId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Invoice not found." } });
      }

      const [events, emails] = await Promise.all([
        storage.listInvoiceEvents(inv.id),
        storage.listClientEmails(inv.id),
      ]);

      return res.json({
        data: {
          ...toInvoiceJSON(inv),
          events: events.map((e) => ({
            id: e.id,
            type: e.type,
            payload: e.payload,
            actor: e.actor,
            createdAt: e.createdAt?.toISOString() ?? null,
          })),
          emails: emails.map((e) => ({
            id: e.id,
            type: e.type,
            toEmail: e.toEmail,
            subject: e.subject,
            attachmentFileName: e.attachmentFileName ?? null,
            status: e.status,
            attemptCount: Number(e.attemptCount),
            lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
            createdAt: e.createdAt?.toISOString() ?? null,
          })),
        },
      });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Invoice document download (owner only) ─────────────────────────────────
  app.get("/api/invoices/:id/document", async (req: Request, res: Response) => {
    try {
      const userId = requireAuth(req);
      const inv = await storage.getInvoiceById(req.params.id);
      if (!inv || inv.senderId !== userId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Invoice not found." } });
      }
      if (!inv.documentId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "No document attached to this invoice." } });
      }
      const doc = await storage.getInvoiceDocument(inv.documentId);
      if (!doc) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Invoice document not found." } });
      }

      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
      return res.send(Buffer.from(doc.data, "base64"));
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Cancel Invoice ─────────────────────────────────────────────────────────
  app.post("/api/invoices/:id/cancel", async (req: Request, res: Response) => {
    try {
      const userId = requireAuth(req);
      const parsed = cancelInvoiceSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }

      const result = await cancelInvoice({
        invoiceId: req.params.id,
        userId,
        reason: parsed.data.reason,
      });

      return res.json({ data: toInvoiceJSON(result.invoice), alreadyCancelled: result.alreadyCancelled });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Resend Notification ────────────────────────────────────────────────────
  app.post("/api/invoices/:id/resend-notification", async (req: Request, res: Response) => {
    try {
      const userId = requireAuth(req);
      const email = await resendInvoiceNotification({
        invoiceId: req.params.id,
        userId,
        baseUrl: baseUrlFrom(req),
      });

      return res.json({
        data: {
          id: email.id,
          toEmail: email.toEmail,
          subject: email.subject,
          status: email.status,
          attemptCount: Number(email.attemptCount),
          lastAttemptAt: email.lastAttemptAt?.toISOString() ?? null,
        },
      });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Public: invoice payment page data ──────────────────────────────────────
  app.get("/api/public/invoices/:token", async (req: Request, res: Response) => {
    try {
      const inv = await getInvoiceByToken(req.params.token);
      if (!inv) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      return res.json({ data: toPublicInvoiceJSON(inv) });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Public: invoice document (token-scoped; viewing requires an identified payer) ──
  app.get("/api/public/invoices/:token/document", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      const user = userId ? await storage.getAuthUserById(userId) : undefined;
      if (!userId || !user) {
        return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please identify yourself to view this invoice document." } });
      }
      const inv = await getInvoiceByToken(req.params.token);
      if (!inv) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      if (!inv.documentId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "No document attached to this invoice." } });
      }
      const doc = await storage.getInvoiceDocument(inv.documentId);
      if (!doc) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Invoice document not found." } });
      }

      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
      return res.send(Buffer.from(doc.data, "base64"));
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Public: payer identification (mirrors the request-money payer PIN) ────
  // An unregistered payer must prove control of the entered email before an
  // account can be created; the session verification block is shared with the
  // request-money flow so /api/auth/register's verified-payer branch (instant
  // activation + sign-in) works unchanged for invoices too.
  app.post("/api/public/invoices/:token/verification/send", async (req: Request, res: Response) => {
    try {
      if (!enforceInvoiceRateLimit(req, res, "paymentIntent")) return;
      const parsed = emailCheckSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a valid email address." } });
      }
      const inv = await getInvoiceByToken(req.params.token);
      if (!inv) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      if (inv.status !== "sent") {
        return res.status(409).json({ error: { code: "INVALID_STATE", message: "This invoice cannot accept a new payment." } });
      }
      const email = parsed.data.email.toLowerCase();
      if (await storage.getAuthUserByEmail(email)) {
        return res.status(409).json({ error: { code: "EMAIL_REGISTERED", message: "This email already has a Rhemito account. Please sign in." } });
      }
      const previous = req.session.paymentRequestVerification;
      if (previous?.email === email && Date.now() - previous.lastSentAt < 60_000) {
        res.setHeader("Retry-After", Math.ceil((60_000 - (Date.now() - previous.lastSentAt)) / 1000));
        return res.status(429).json({ error: { code: "PIN_COOLDOWN", message: "Please wait before requesting another PIN." } });
      }
      await storage.invalidateOtps(email);
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await storage.createOtp(email, code, new Date(Date.now() + 10 * 60_000));
      req.session.paymentRequestVerification = {
        email,
        token: req.params.token,
        isEmailLink: false,
        verified: false,
        failedAttempts: 0,
        lastSentAt: Date.now(),
      };
      return res.json({
        data: {
          sent: true,
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
          ...(demoModeEnabled ? { devPin: code } : {}),
        },
      });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  app.post("/api/public/invoices/:token/verification/verify", async (req: Request, res: Response) => {
    try {
      if (!enforceInvoiceRateLimit(req, res, "paymentIntent")) return;
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const code = String(req.body?.code ?? "").trim();
      const verification = req.session.paymentRequestVerification;
      if (!verification || verification.token !== req.params.token || verification.isEmailLink !== false || verification.email !== email) {
        return res.status(400).json({ error: { code: "PIN_NOT_SENT", message: "Request a new PIN for this email address." } });
      }
      if (verification.failedAttempts >= 5) {
        return res.status(429).json({ error: { code: "PIN_LOCKED", message: "Too many incorrect attempts. Request a new PIN later." } });
      }
      const otp = code.length === 6 ? await storage.getValidOtp(email, code) : undefined;
      if (!otp) {
        verification.failedAttempts += 1;
        return res.status(400).json({ error: { code: "INVALID_PIN", message: "The PIN is invalid or has expired." } });
      }
      await storage.markOtpUsed(otp.id);
      verification.verified = true;
      return res.json({ data: { verified: true } });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Public: payment initiation (requires an identified, eligible payer) ────
  app.post("/api/public/invoices/:token/pay", async (req: Request, res: Response) => {
    try {
      if (!enforceInvoiceRateLimit(req, res, "paymentIntent")) return;
      const parsed = payInvoiceSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }
      const userId = req.session?.userId;
      const user = userId ? await storage.getAuthUserById(userId) : undefined;
      if (!userId || !user) {
        return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please identify yourself before paying this invoice." } });
      }
      if (user.status === "blocked") {
        return res.status(403).json({ error: { code: "BLOCKED", message: "Your account is blocked. Please contact support." } });
      }
      if (user.status === "pending") {
        return res.status(403).json({ error: { code: "ACCOUNT_UNVERIFIED", message: "Please verify your account OTP first." } });
      }
      if (user.kycStatus === "pending") {
        return res.status(403).json({ error: { code: "KYC_PENDING", message: "Your identity verification is in progress. Please try again shortly." } });
      }
      if (user.kycStatus === "failed" || user.kycStatus === "rejected") {
        return res.status(403).json({ error: { code: "KYC_FAILED", message: "Your account cannot complete this payment due to compliance restrictions. Please contact support." } });
      }
      const result = await initiatePaymentByToken(req.params.token, parsed.data.method, { userId: user.id, email: user.email });
      return res.json({ data: result });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Public: Request New Payment Link ───────────────────────────────────────
  app.post("/api/public/invoices/:token/request-new-link", async (req: Request, res: Response) => {
    try {
      const parsed = requestNewLinkSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }

      const result = await requestNewPaymentLink({
        token: req.params.token,
        requesterEmail: parsed.data.requesterEmail,
      });

      return res.json({
        data: {
          alreadyRequested: result.alreadyRequested,
          requestedAt: result.requestedAt.toISOString(),
          message: "Your request has been sent to the invoice sender.",
        },
      });
    } catch (err) {
      return handleInvoiceError(res, err);
    }
  });

  // ─── Dev-only simulation hooks (disabled in production; used by e2e journeys)
  // Available when NODE_ENV is development, or when the e2e webServer opts in
  // via RHEMITO_DEV_HOOKS=1 (the Playwright server runs the production build).
  const devHooksEnabled = () =>
    process.env.NODE_ENV !== "production" || process.env.RHEMITO_DEV_HOOKS === "1";

  const devOnly = (handler: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      if (!devHooksEnabled()) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
      }
      try {
        await handler(req, res);
      } catch (err) {
        return handleInvoiceError(res, err);
      }
    };

  app.post("/api/dev/invoices/:id/simulate-overdue", devOnly(async (req, res) => {
    await simulateOverdue(req.params.id);
    res.json({ success: true });
  }));

  app.post("/api/dev/invoices/:id/simulate-expiry", devOnly(async (req, res) => {
    await simulateExpiry(req.params.id);
    res.json({ success: true });
  }));

  // Reminders, expiry materialization and temp-upload cleanup safety net.
  startInvoiceSweep();
}
