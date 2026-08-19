/**
 * Wallet & ledger service — Request Money.
 *
 * Double-entry-style ledger: balances are derived from immutable entries, never
 * from request status. All amounts are integer minor units. Entries are
 * idempotent by key so webhook replays cannot double-post.
 */

import { randomUUID } from "crypto";
import { storage } from "./storage";
import { senderPaysMinorOf, netMinorOf } from "@shared/money";
import type { LedgerEntry, MoneyRequest } from "@shared/schema";

type Direction = "debit" | "credit";

async function post(params: {
  requestId: string;
  type: LedgerEntry["type"];
  account: string;
  direction: Direction;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  providerRef?: string;
}): Promise<LedgerEntry | null> {
  if (await storage.hasLedgerEntry(params.idempotencyKey)) {
    return null; // idempotent replay — already posted
  }
  const entry: LedgerEntry = {
    id: randomUUID(),
    requestId: params.requestId,
    type: params.type,
    account: params.account,
    direction: params.direction,
    amountMinor: params.amountMinor,
    currency: params.currency,
    providerRef: params.providerRef ?? null,
    idempotencyKey: params.idempotencyKey,
    createdAt: new Date(),
  };
  return storage.addLedgerEntry(entry);
}

export interface FundingLedgerResult {
  posted: boolean;
}

/**
 * Post the funding side of a paid request:
 *
 *   gross_received   credit  wallet:<user>   amount charged to the sender (pay-in ccy)
 *   rhemito_fee      debit   wallet:<user>   fee
 *   rhemito_fee      credit  fee:rhemito     fee
 *
 * The wallet nets to the requester's proceeds: requested − fee when the
 * requester absorbs the fee, or the full requested amount when the fee is
 * charged to the sender (gross then includes the fee).
 *
 * For cross-currency payouts an fx_conversion pair moves net pay-in funds into
 * the payout currency at the quoted rate before the payout debit.
 */
export async function postFundingEntries(request: MoneyRequest, providerPaymentRef: string): Promise<FundingLedgerResult> {
  const wallet = `wallet:${request.requesterId}`;
  const gross = senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee);
  const fee = request.feeMinor;
  const net = netMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee);

  await post({
    requestId: request.id,
    type: "gross_received",
    account: wallet,
    direction: "credit",
    amountMinor: gross,
    currency: request.payInCurrency,
    idempotencyKey: `${request.id}:gross_received`,
    providerRef: providerPaymentRef,
  });

  await post({
    requestId: request.id,
    type: "rhemito_fee",
    account: wallet,
    direction: "debit",
    amountMinor: fee,
    currency: request.payInCurrency,
    idempotencyKey: `${request.id}:fee_wallet`,
  });
  await post({
    requestId: request.id,
    type: "rhemito_fee",
    account: "fee:rhemito",
    direction: "credit",
    amountMinor: fee,
    currency: request.payInCurrency,
    idempotencyKey: `${request.id}:fee_income`,
  });

  if (request.payInCurrency !== request.payoutCurrency && request.payoutAmountMinor !== null) {
    // FX conversion: debit net pay-in from the wallet, credit net payout funds
    // to the payout clearing account in the payout currency.
    await post({
      requestId: request.id,
      type: "fx_conversion",
      account: wallet,
      direction: "debit",
      amountMinor: net,
      currency: request.payInCurrency,
      idempotencyKey: `${request.id}:fx_debit`,
    });
    await post({
      requestId: request.id,
      type: "fx_conversion",
      account: `payout_clearing:${request.requesterId}`,
      direction: "credit",
      amountMinor: request.payoutAmountMinor,
      currency: request.payoutCurrency,
      idempotencyKey: `${request.id}:fx_credit`,
    });
  }

  return { posted: true };
}

/**
 * Post the payout debit when net funds leave for the requester's bank. For
 * same-currency requests the debit comes straight from the wallet; for
 * cross-currency it comes from the payout clearing account.
 */
export async function postPayoutEntry(request: MoneyRequest, payoutRef: string): Promise<void> {
  const account =
    request.payInCurrency === request.payoutCurrency
      ? `wallet:${request.requesterId}`
      : `payout_clearing:${request.requesterId}`;

  await post({
    requestId: request.id,
    type: "payout_debit",
    account,
    direction: "debit",
    amountMinor:
      request.payoutAmountMinor ?? netMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee),
    currency: request.payoutCurrency,
    idempotencyKey: `${request.id}:payout_debit`,
    providerRef: payoutRef,
  });
}

/** Wallet balance (minor units) for an account and currency, derived from entries. */
export async function balanceOf(account: string, currency: string): Promise<number> {
  const all: LedgerEntry[] = [];
  for (const req of await storage.listAllMoneyRequestsRaw()) {
    all.push(...(await storage.listLedgerEntries(req.id)));
  }
  return all
    .filter((e) => e.account === account && e.currency === currency)
    .reduce((sum, e) => sum + (e.direction === "credit" ? e.amountMinor : -e.amountMinor), 0);
}

/**
 * Ledger balancing check used by tests: for a request, total credits must
 * equal total debits across each currency.
 */
export async function requestLedgerBalances(requestId: string): Promise<Map<string, number>> {
  const entries = await storage.listLedgerEntries(requestId);
  const byCurrency = new Map<string, number>();
  for (const e of entries) {
    const delta = e.direction === "credit" ? e.amountMinor : -e.amountMinor;
    byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + delta);
  }
  return byCurrency;
}
