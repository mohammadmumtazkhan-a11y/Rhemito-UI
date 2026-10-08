import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PROMO_COPY } from "./lib/copy";
import { isCodeFormatOk, normaliseCode, shouldRevalidate, type PromoInputs } from "./lib/promo";

export type PromoState = "idle" | "checking" | "applied" | "rejected" | "unavailable";

interface ValidateOk { valid: true; appliedDiscount: number; displayText?: string; currency?: string | null }

/** Ask Rhemito (which asks Mito) whether a code works for this transfer. */
async function validateCode(code: string, input: PromoInputs): Promise<{ ok: true; body: ValidateOk } | { ok: false; status: number; message: string; code?: string }> {
  try {
    const res = await fetch("/api/promocodes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        code,
        amount: input.amount,
        fee: Number(input.fee.toFixed(2)),
        currency: input.sendCurrency,
        sourceCurrency: input.sendCurrency,
        destCurrency: input.receiveCurrency,
        // P-40: only when the customer has chosen one
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, body };
    const message = typeof body.error === "string" ? body.error : body?.error?.message ?? PROMO_COPY.unavailable;
    return { ok: false, status: res.status, message, code: body.code };
  } catch {
    return { ok: false, status: 503, message: PROMO_COPY.unavailable, code: "PROMO_UNAVAILABLE" };
  }
}

/**
 * Promo code state for a transfer (PROMO-RHEMITO §6.2).
 * idle → checking → applied | rejected | unavailable; applied re-validates when the transfer changes.
 */
export function usePromoCode(input: PromoInputs) {
  const { toast } = useToast();
  const status = useQuery<{ data: { enabled: boolean } }>({
    queryKey: ["/api/promocodes/status"],
    queryFn: async () => (await fetch("/api/promocodes/status", { credentials: "include" })).json(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const enabled = status.data?.data?.enabled !== false;

  const [code, setCodeRaw] = useState("");
  const [state, setState] = useState<PromoState>("idle");
  const [discount, setDiscount] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [message, setMessage] = useState("");
  const lastInputs = useRef<PromoInputs | null>(null);
  const appliedCode = useRef<string | null>(null);
  // Once payment has started the code is redeemed on the server, so checking it again would count that very use against the customer
  const locked = useRef(false);

  const run = useCallback(async (raw: string, inputs: PromoInputs, opts: { revalidate?: boolean } = {}) => {
    const c = normaliseCode(raw);
    if (!c) { setState("rejected"); setMessage(PROMO_COPY.empty); setDiscount(0); return false; }
    if (!isCodeFormatOk(c)) { setState("rejected"); setMessage("Enter a valid promo code."); setDiscount(0); return false; }
    setState("checking");
    const r = await validateCode(c, inputs);
    lastInputs.current = inputs;
    if (r.ok) {
      setState("applied");
      setDiscount(Number(r.body.appliedDiscount) || 0);
      const text = r.body.displayText || PROMO_COPY.applied;
      setDisplayText(text);
      setMessage(text);
      appliedCode.current = c;
      if (!opts.revalidate) toast({ title: PROMO_COPY.appliedToast, description: text });
      return true;
    }
    setDiscount(0);
    appliedCode.current = null;
    setState(r.status === 503 ? "unavailable" : "rejected");
    setMessage(r.message);
    if (opts.revalidate) toast({ title: PROMO_COPY.removedToast, description: r.message, variant: "destructive" });
    return false;
  }, [toast]);

  const apply = useCallback(() => run(code, input), [run, code, input]);

  const remove = useCallback(() => {
    setCodeRaw("");
    setState("idle");
    setDiscount(0);
    setMessage("");
    setDisplayText("");
    appliedCode.current = null;
    lastInputs.current = null;
    locked.current = false;
    toast({ title: PROMO_COPY.removedToast });
  }, [toast]);

  /** Editing the code text clears the applied state (P-42). */
  const setCode = useCallback((v: string) => {
    setCodeRaw(v.toUpperCase());
    locked.current = false;
    if (appliedCode.current || state !== "idle") {
      appliedCode.current = null;
      setState("idle");
      setDiscount(0);
      setMessage("");
    }
  }, [state]);

  /** Server says the code can no longer be used (pay-time re-check): show it like a rejection. */
  const reject = useCallback((msg: string) => {
    locked.current = false;
    appliedCode.current = null;
    setDiscount(0);
    setState("rejected");
    setMessage(msg);
  }, []);

  /** Call when the payment starts: the code is checked and used by the server at pay time (P-20), so stop re-validating it here. */
  const lock = useCallback(() => { locked.current = true; }, []);

  // P-41: re-validate (debounced) when amount, fee, currencies or payment method change while a code is applied
  const { amount, fee, sendCurrency, receiveCurrency, paymentMethod } = input;
  useEffect(() => {
    if (state !== "applied" || !appliedCode.current || locked.current) return undefined;
    const next = { amount, fee, sendCurrency, receiveCurrency, paymentMethod };
    if (!shouldRevalidate(lastInputs.current, next)) return undefined;
    const t = setTimeout(() => { if (appliedCode.current) void run(appliedCode.current, next, { revalidate: true }); }, 400);
    return () => clearTimeout(t);
  }, [amount, fee, sendCurrency, receiveCurrency, paymentMethod, state, run]);

  return {
    enabled,
    code,
    setCode,
    state,
    applied: state === "applied",
    appliedCode: state === "applied" ? appliedCode.current : null,
    discount: state === "applied" ? discount : 0,
    displayText,
    message,
    apply,
    remove,
    reject,
    lock,
  };
}

export type PromoController = ReturnType<typeof usePromoCode>;
