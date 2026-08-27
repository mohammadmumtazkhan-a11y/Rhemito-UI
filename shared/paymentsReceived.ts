/**
 * Received Payments — a server-side merged view of every payment that has
 * landed (or is in flight) for a Rhemito user across the three money-in
 * flows: money requests, invoices and funding-campaign contributions.
 *
 * Status mapping is server-authoritative so the Received Payments page and
 * the notification flows never reinterpret a source status.
 */

export const RECEIVED_PAYMENT_STATUSES = ["completed", "pending", "failed", "cancelled"] as const;
export type ReceivedPaymentStatus = (typeof RECEIVED_PAYMENT_STATUSES)[number];

export type ReceivedPaymentSource = "money_request" | "invoice" | "campaign";

export interface ReceivedPayment {
  /** Composite id: `${sourceType}-${reference}`. */
  id: string;
  sourceType: ReceivedPaymentSource;
  /** Owning money-request id when the row can still be cancelled via the existing cancel API. */
  requestId: string | null;
  reference: string;
  payerName: string | null;
  payerEmail: string | null;
  /** Display string, always 2 decimal places. */
  amount: string;
  currency: string;
  status: ReceivedPaymentStatus;
  /** ISO timestamp of when the money landed (falls back to the record's creation). */
  receivedAt: string;
  cancellable: boolean;
}

/** Money-request lifecycle → received-payment status. `null` = not a payment (expired/unknown). */
export function receivedStatusForMoneyRequest(status: string): ReceivedPaymentStatus | null {
  switch (status) {
    case "funded":
    case "payout_pending":
    case "paid_out":
      return "completed";
    case "active":
    case "viewed":
    case "authorisation_in_progress":
    case "payment_processing":
    case "payment_pending":
      return "pending";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/** Invoice status → received-payment status. `null` = not a payment (sent/overdue/expired). */
export function receivedStatusForInvoice(status: string): ReceivedPaymentStatus | null {
  switch (status) {
    case "paid":
      return "completed";
    case "payment_processing":
      return "pending";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/** Contribution status → received-payment status. `null` = never landed (failed). */
export function receivedStatusForContribution(status: string): ReceivedPaymentStatus | null {
  switch (status) {
    case "completed":
      return "completed";
    case "pending":
      return "pending";
    default:
      return null;
  }
}
