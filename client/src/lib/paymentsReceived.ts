/**
 * Received Payments API client — the server-merged view of money-in payments
 * across money requests, invoices and funding-campaign contributions.
 */

import { apiRequest } from "@/lib/queryClient";
import type { ReceivedPayment } from "@shared/paymentsReceived";

export async function getPaymentsReceived(): Promise<ReceivedPayment[]> {
  const res = await apiRequest("GET", "/api/payments-received");
  return ((await res.json()) as { data: ReceivedPayment[] }).data;
}
