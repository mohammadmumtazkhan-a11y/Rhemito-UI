import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROMO_COPY } from "./lib/copy";
import type { PromoController } from "./usePromoCode";

interface PromoCodeFieldProps {
  promo: PromoController;
  /** Render without the surrounding card (e.g. inside another panel). */
  bare?: boolean;
}

/** Send Money → Payment: promo code input with Apply / Remove and its message (PROMO-RHEMITO §6.3). */
export function PromoCodeField({ promo, bare = false }: PromoCodeFieldProps) {
  if (!promo.enabled) return null;
  const checking = promo.state === "checking";
  const ok = promo.state === "applied";
  const showMessage = promo.message && promo.state !== "idle" && promo.state !== "checking";

  const body = (
    <div className="space-y-3">
      <Label htmlFor="promo-code-input" className="text-sm">{PROMO_COPY.label}</Label>
      <div className="flex gap-2">
        <Input
          id="promo-code-input"
          placeholder={PROMO_COPY.placeholder}
          value={promo.code}
          maxLength={20}
          onChange={(e) => promo.setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!ok && promo.code) void promo.apply(); } }}
          className="uppercase font-mono h-12 sm:h-10"
          disabled={checking || ok}
          aria-describedby={showMessage ? "promo-code-message" : undefined}
          data-testid="promo-code-input"
        />
        {ok ? (
          <Button type="button" variant="outline" className="h-12 sm:h-10 min-w-[88px]" onClick={promo.remove} data-testid="promo-remove">
            {PROMO_COPY.remove}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-12 sm:h-10 min-w-[88px]" onClick={() => void promo.apply()} disabled={checking || !promo.code} data-testid="promo-apply">
            {checking ? PROMO_COPY.checking : PROMO_COPY.apply}
          </Button>
        )}
      </div>
      {showMessage && (
        <p
          id="promo-code-message"
          role={ok ? "status" : "alert"}
          className={`flex items-center gap-1 text-xs mt-1 font-medium ${ok ? "text-green-600" : "text-red-600"}`}
          data-testid="promo-message"
        >
          {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
          {promo.message}
        </p>
      )}
    </div>
  );

  if (bare) return body;
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{PROMO_COPY.cardTitle}</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
