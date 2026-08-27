/**
 * Received Payments routes — one merged, owner-scoped view of every payment
 * that has landed (or is in flight) across the three money-in flows:
 * money requests, invoices and funding-campaign contributions. The Received
 * Payments page polls this single endpoint instead of merging three queries.
 *
 * Status mapping is server-authoritative (shared/paymentsReceived.ts) so the
 * page never reinterprets a source status.
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { demoModeEnabled } from "./config";
import { effectiveStatus } from "./requestService";
import { clientDisplayName } from "@shared/invoice-logic";
import { fromMinorUnits } from "@shared/money";
import {
  receivedStatusForContribution,
  receivedStatusForInvoice,
  receivedStatusForMoneyRequest,
  type ReceivedPayment,
} from "@shared/paymentsReceived";

class PaymentsReceivedError extends Error {
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
  // Same dashboard demo stand-in policy as the Request Money routes.
  if (demoModeEnabled) {
    return "user_123";
  }
  throw new PaymentsReceivedError(401, "UNAUTHENTICATED", "Please sign in to continue.");
}

export function registerPaymentsReceivedRoutes(app: Express): void {
  app.get("/api/payments-received", async (req: Request, res: Response) => {
    try {
      const userId = requireStrictAuth(req);
      const rows: ReceivedPayment[] = [];

      // Money requests — funded → paid out counts as received; active/viewed
      // rows stay pending and cancellable via the existing cancel API.
      for (const request of await storage.listMoneyRequests(userId)) {
        const status = receivedStatusForMoneyRequest(effectiveStatus(request));
        if (!status) continue;
        const currency = request.payoutCurrency;
        rows.push({
          id: `money_request-${request.requestNumber}`,
          sourceType: "money_request",
          requestId: status === "pending" && ["active", "viewed"].includes(effectiveStatus(request)) ? request.id : null,
          reference: request.requestNumber,
          payerName: request.senderName,
          payerEmail: request.senderEmail,
          amount: fromMinorUnits(request.payoutAmountMinor ?? request.payInAmountMinor, currency),
          currency,
          status,
          receivedAt: (request.fundedAt ?? request.createdAt ?? new Date(0)).toISOString(),
          cancellable: status === "pending" && ["active", "viewed"].includes(effectiveStatus(request)),
        });
      }

      // Invoices — only paid / payment_processing / cancelled are payments.
      for (const invoice of await storage.listAllInvoicesRaw()) {
        if (invoice.senderId !== userId) continue;
        const status = receivedStatusForInvoice(invoice.status);
        if (!status) continue;
        rows.push({
          id: `invoice-${invoice.invoiceNumber}`,
          sourceType: "invoice",
          requestId: null,
          reference: invoice.invoiceNumber,
          payerName: clientDisplayName(invoice),
          payerEmail: invoice.clientEmail,
          amount: Number(invoice.amount).toFixed(2),
          currency: invoice.currency,
          status,
          receivedAt: (invoice.paidAt ?? invoice.createdAt ?? new Date(0)).toISOString(),
          cancellable: false,
        });
      }

      // Campaign contributions — each contribution is one received payment.
      for (const campaign of await storage.listGroupPayCampaignsByOwner(userId)) {
        for (const contribution of await storage.listGroupPayContributions(campaign.id)) {
          const status = receivedStatusForContribution(contribution.status);
          if (!status) continue;
          rows.push({
            id: `campaign-${contribution.id}`,
            sourceType: "campaign",
            requestId: null,
            reference: `GP-${contribution.id.slice(0, 8).toUpperCase()}`,
            payerName: contribution.name,
            payerEmail: contribution.email,
            amount: contribution.amount.toFixed(2),
            currency: campaign.currency,
            status,
            receivedAt: (contribution.paymentDate ?? new Date(0)).toISOString(),
            cancellable: false,
          });
        }
      }

      rows.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
      return res.json({ data: rows, meta: { total: rows.length } });
    } catch (err) {
      if (err instanceof PaymentsReceivedError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      console.error("[paymentsReceivedRoutes] unexpected error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load received payments." } });
    }
  });
}
