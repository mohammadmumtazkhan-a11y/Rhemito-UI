/**
 * Send Money routes — the server-owned transaction store behind the wizard and
 * the Dashboard unified Transactions table.
 *
 * Follows the conventions of requestRoutes.ts: strict session auth with the
 * prototype demo-user stand-in (demo mode only), { error: { code, message } }
 * errors, { data } success envelope, and amounts in integer minor units.
 */

import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { demoModeEnabled } from "./config";
import { dispatchNotification } from "./notificationService";
import { onTransferEvent } from "./rewardsService";
import { validatePromo, redeemPromo } from "./promoService";
import { toMinorUnits, fromMinorUnits } from "@shared/money";
import { formatDocumentNumber } from "@shared/invoice-logic";
import {
  createSendMoneyTransactionSchema,
  paySendMoneyTransactionSchema,
  statusForPaymentMethod,
  type SendMoneyService,
  type SendMoneyTransaction,
  type SendMoneyTransactionView,
} from "@shared/sendMoney";

class SendMoneyError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireStrictAuth(req: Request): string {
  const userId = req.session?.userId;
  if (userId) return userId;
  // Dashboard demo experience: in prototype demo mode the seeded demo user
  // stands in for an anonymous dashboard visitor so the wizard keeps working
  // without a sign-in prompt (same policy as the Request Money routes).
  if (demoModeEnabled) {
    return "user_123";
  }
  throw new SendMoneyError(401, "UNAUTHENTICATED", "Please sign in to continue.");
}

function firstZodMessage(err: { issues: { message: string }[] }): string {
  return err.issues[0]?.message ?? "Invalid request.";
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof SendMoneyError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error("[sendMoneyRoutes] unexpected error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}

const SERVICE_LABELS: Record<SendMoneyService, string> = {
  bank_deposit: "Bank Deposit",
  mobile_money: "Mobile Money",
  cash_pickup: "Cash Pickup",
};

function toView(tx: SendMoneyTransaction): SendMoneyTransactionView {
  return {
    id: tx.id,
    reference: tx.reference,
    recipientName: tx.recipientName,
    service: tx.service,
    paymentMethod: tx.paymentMethod,
    sendCurrency: tx.sendCurrency,
    sendAmount: fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency),
    receiveCurrency: tx.receiveCurrency,
    receiveAmount: fromMinorUnits(tx.receiveAmountMinor, tx.receiveCurrency),
    fee: fromMinorUnits(tx.feeMinor, tx.sendCurrency),
    exchangeRate: tx.exchangeRate,
    promoCode: tx.promoCode,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
    paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
    cancelledAt: tx.cancelledAt ? tx.cancelledAt.toISOString() : null,
  };
}

/** Notification payloads keep the exact shape the client used to dispatch itself. */
function notificationData(tx: SendMoneyTransaction) {
  return {
    txnId: tx.reference,
    recipientName: tx.recipientName,
    amount: `${tx.sendCurrency} ${fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)}`,
    service: SERVICE_LABELS[tx.service],
  };
}

async function getOwnedTransaction(idOrReference: string, userId: string): Promise<SendMoneyTransaction> {
  const direct = await storage.getSendMoneyTransactionById(idOrReference);
  const tx = direct ?? (await storage.listSendMoneyTransactionsByOwner(userId)).find((t) => t.reference === idOrReference);
  if (!tx || tx.ownerId !== userId) {
    throw new SendMoneyError(404, "NOT_FOUND", "Transaction not found.");
  }
  return tx;
}

/**
 * Promo codes belong to Mito Admin. When a transfer that carries a code is paid, Mito Admin re-checks the code for this
 * customer and payment method, the discount the customer was shown must not exceed what Mito Admin approves, and the use
 * is recorded once (against the transfer reference). A code that can no longer be used stops the payment before any money moves.
 */
async function redeemPromoForPayment(tx: SendMoneyTransaction, userId: string, paymentMethod: string): Promise<void> {
  const feeBeforeMinor = tx.feeBeforePromoMinor ?? tx.feeMinor;
  const request = {
    code: tx.promoCode as string,
    userId,
    amount: Number(fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)),
    fee: Number(fromMinorUnits(feeBeforeMinor, tx.sendCurrency)),
    currency: tx.sendCurrency,
    sourceCurrency: tx.sendCurrency,
    destCurrency: tx.receiveCurrency,
    paymentMethod,
  };
  const reject = (status: number, message: string) =>
    new SendMoneyError(status === 503 ? 503 : 409, "PROMO_REJECTED", `${message.replace(/\.?$/, ".")} Go back and remove the promo code to continue.`);

  const check = await validatePromo(request);
  if (!check.ok) throw reject(check.status, check.error ?? "This promo code can no longer be used.");
  const approvedMinor = toMinorUnits(String(check.body.appliedDiscount ?? 0), tx.sendCurrency);
  const shownMinor = feeBeforeMinor - tx.feeMinor;
  if (shownMinor > approvedMinor) {
    throw new SendMoneyError(409, "PROMO_CHANGED", "The promo discount has changed. Go back and review your transfer.");
  }
  const redeemed = await redeemPromo({ ...request, transactionId: tx.reference });
  if (!redeemed.ok) throw reject(redeemed.status, redeemed.error ?? "This promo code can no longer be used.");
}

export function registerSendMoneyRoutes(app: Express): void {
  app.post("/api/send-money/transactions", async (req: Request, res: Response) => {
    try {
      const userId = requireStrictAuth(req);
      const parsed = createSendMoneyTransactionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new SendMoneyError(400, "VALIDATION_ERROR", firstZodMessage(parsed.error));
      }
      const input = parsed.data;
      const feeMinor = toMinorUnits(input.fee, input.sendCurrency);
      const feeBeforePromoMinor = input.promoCode && input.feeBeforePromo ? toMinorUnits(input.feeBeforePromo, input.sendCurrency) : null;
      if (feeBeforePromoMinor !== null && feeBeforePromoMinor < feeMinor) {
        throw new SendMoneyError(400, "VALIDATION_ERROR", "The fee before the promo cannot be less than the fee charged.");
      }
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const transaction: SendMoneyTransaction = {
        id: randomUUID(),
        ownerId: userId,
        reference: formatDocumentNumber("TXN", await storage.nextSendMoneySequence(), yearMonth),
        recipientName: input.recipientName,
        service: input.service,
        paymentMethod: null,
        sendCurrency: input.sendCurrency.toUpperCase(),
        sendAmountMinor: toMinorUnits(input.sendAmount, input.sendCurrency),
        receiveCurrency: input.receiveCurrency.toUpperCase(),
        receiveAmountMinor: toMinorUnits(input.receiveAmount, input.receiveCurrency),
        feeMinor,
        exchangeRate: input.exchangeRate,
        promoCode: input.promoCode ?? null,
        feeBeforePromoMinor,
        status: "awaiting_payment",
        createdAt: now,
        paidAt: null,
        cancelledAt: null,
      };
      await storage.createSendMoneyTransaction(transaction);
      return res.status(201).json({ data: toView(transaction) });
    } catch (err) {
      handleError(res, err);
    }
  });

  app.get("/api/send-money/transactions", async (req: Request, res: Response) => {
    try {
      const userId = requireStrictAuth(req);
      const transactions = await storage.listSendMoneyTransactionsByOwner(userId);
      return res.json({ data: transactions.map(toView), meta: { total: transactions.length } });
    } catch (err) {
      handleError(res, err);
    }
  });

  app.post("/api/send-money/transactions/:id/pay", async (req: Request, res: Response) => {
    try {
      const userId = requireStrictAuth(req);
      const tx = await getOwnedTransaction(req.params.id, userId);
      const parsed = paySendMoneyTransactionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new SendMoneyError(400, "VALIDATION_ERROR", firstZodMessage(parsed.error));
      }
      if (tx.status !== "awaiting_payment") {
        throw new SendMoneyError(409, "INVALID_STATE", "Only a transaction awaiting payment can be paid.");
      }
      if (tx.promoCode) await redeemPromoForPayment(tx, userId, parsed.data.paymentMethod);
      const status = statusForPaymentMethod(parsed.data.paymentMethod);
      const now = new Date();
      const updated = await storage.updateSendMoneyTransaction(tx.id, {
        paymentMethod: parsed.data.paymentMethod,
        status,
        paidAt: status === "completed" ? now : null,
      });
      if (!updated) {
        throw new SendMoneyError(500, "INTERNAL_ERROR", "The payment could not be recorded. Please try again.");
      }
      if (status === "completed") {
        await dispatchNotification({ userId, type: "transaction_complete", data: notificationData(updated) });
        // Referral programme: a completed transfer may qualify a referral (US-4.1)
        const event = { reference: updated.reference, sendAmount: Number(fromMinorUnits(updated.sendAmountMinor, updated.sendCurrency)), sendCurrency: updated.sendCurrency, receiveCurrency: updated.receiveCurrency, createdAt: updated.createdAt };
        void onTransferEvent(userId, event, "PAID").then(() => onTransferEvent(userId, event, "COMPLETED"));
      }
      return res.json({ data: toView(updated) });
    } catch (err) {
      handleError(res, err);
    }
  });

  app.post("/api/send-money/transactions/:id/cancel", async (req: Request, res: Response) => {
    try {
      const userId = requireStrictAuth(req);
      const tx = await getOwnedTransaction(req.params.id, userId);
      if (tx.status !== "awaiting_payment" && tx.status !== "pending") {
        throw new SendMoneyError(409, "INVALID_STATE", "Only a transaction awaiting payment can be cancelled.");
      }
      const updated = await storage.updateSendMoneyTransaction(tx.id, {
        status: "cancelled",
        cancelledAt: new Date(),
      });
      if (!updated) {
        throw new SendMoneyError(500, "INTERNAL_ERROR", "The transaction could not be cancelled. Please try again.");
      }
      await dispatchNotification({ userId, type: "transaction_cancelled_customer", data: notificationData(updated) });
      // Releases any bonus used on this transfer (AC-5.2.10) and un-pends a referral (AC-4.4.1)
      void onTransferEvent(userId, { reference: updated.reference, sendAmount: Number(fromMinorUnits(updated.sendAmountMinor, updated.sendCurrency)), sendCurrency: updated.sendCurrency, receiveCurrency: updated.receiveCurrency, createdAt: updated.createdAt }, "CANCELLED");
      return res.json({ data: toView(updated) });
    } catch (err) {
      handleError(res, err);
    }
  });
}
