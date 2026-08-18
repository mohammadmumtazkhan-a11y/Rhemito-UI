/**
 * PayoutAccountSelector — the "Receiving Payout Account" card used by the
 * Send Invoice flow.
 *
 * Server-authoritative, identical account-creation rules to Request Payment:
 * only VERIFIED accounts owned by the requester are selectable, and when none
 * exist the same add-and-verify dialog appears (holder name locked to the
 * verified profile name; the browser never fabricates account records).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Check, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  addPayoutAccount,
  devVerifyPayoutAccount,
  getPayoutAccounts,
  type PayoutAccountView,
} from "@/lib/requests";

/** Account-currency → account-country (same mapping the corridors use). */
const CURRENCY_COUNTRIES: Record<string, string> = {
  GBP: "GB",
  NGN: "NG",
  USD: "US",
  EUR: "DE",
};

interface PayoutAccountSelectorProps {
  requesterName: string;
  selectedAccountId: string;
  onSelect: (account: PayoutAccountView) => void;
  context?: "invoice" | "request" | "campaign" | "group_pay";
}

export function PayoutAccountSelector({
  requesterName,
  selectedAccountId,
  onSelect,
  context = "request",
}: PayoutAccountSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isChangingPayoutAccount, setIsChangingPayoutAccount] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isSubmittingNewAccount, setIsSubmittingNewAccount] = useState(false);
  const [newAccountData, setNewAccountData] = useState({
    currency: "GBP",
    bank: "",
    accountNumber: "",
    routingNumber: "",
  });

  const accountsQuery = useQuery<PayoutAccountView[]>({
    queryKey: ["/api/request-money/payout-accounts"],
    queryFn: async () => {
      try {
        return await getPayoutAccounts();
      } catch {
        return [];
      }
    },
    retry: false,
    refetchOnMount: "always",
  });

  const verifiedAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.verificationStatus === "verified"),
    [accountsQuery.data],
  );

  const selectedAccount = useMemo(
    () => verifiedAccounts.find((a) => a.id === selectedAccountId) || verifiedAccounts[0],
    [verifiedAccounts, selectedAccountId],
  );

  // Auto-open Add Account modal when no VERIFIED payout account exists — the
  // same behaviour as Request Payment.
  useEffect(() => {
    if (accountsQuery.data && verifiedAccounts.length === 0) {
      setIsAddAccountModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsQuery.data, verifiedAccounts.length]);

  // Lift the effective selection up so the parent always has a concrete
  // account: preselect the default (or first) verified account once loaded,
  // and renormalize if the current selection disappears.
  useEffect(() => {
    if (!accountsQuery.data || verifiedAccounts.length === 0) return;
    const current = verifiedAccounts.find((a) => a.id === selectedAccountId);
    if (!current) {
      onSelect(verifiedAccounts.find((a) => a.isDefault) ?? verifiedAccounts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsQuery.data, verifiedAccounts, selectedAccountId]);

  const handleCreateNewAccount = async () => {
    if (!newAccountData.bank || !newAccountData.accountNumber || isSubmittingNewAccount) return;

    try {
      setIsSubmittingNewAccount(true);

      const country = CURRENCY_COUNTRIES[newAccountData.currency] || "GB";
      const created = await addPayoutAccount({
        holderName: requesterName,
        country,
        currency: newAccountData.currency,
        bankName: newAccountData.bank,
        accountNumber: newAccountData.accountNumber,
        routingNumber: newAccountData.routingNumber || undefined,
      });

      // Automatically dev-verify in prototype
      try {
        await devVerifyPayoutAccount(created.id);
      } catch {
        // best effort verification
      }

      toast({
        title: "Payout Account Added",
        description: `${newAccountData.bank} (${newAccountData.currency}) in the name of ${requesterName} was added, verified and selected.`,
      });

      setNewAccountData({ currency: "GBP", bank: "", accountNumber: "", routingNumber: "" });
      setIsAddAccountModalOpen(false);
      setIsChangingPayoutAccount(false);

      queryClient.invalidateQueries({ queryKey: ["/api/request-money/payout-accounts"] });
      const refreshed = await getPayoutAccounts();
      const verified = refreshed.find((a) => a.verificationStatus === "verified");
      if (verified) onSelect(verified);
    } catch (err) {
      toast({
        title: "Could not add account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingNewAccount(false);
    }
  };

  // ─── Loading / session states (never a sign-in prompt — this flow is only
  // reachable from the logged-in dashboard) ────────────────────────────────────

  if (accountsQuery.isLoading) {
    return (
      <div
        className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-muted-foreground flex items-center gap-2"
        data-testid="payout-accounts-loading"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking your payout accounts…
      </div>
    );
  }


  return (
    <>
      {verifiedAccounts.length === 0 ? (
        /* Zero verified payout account — same account-creation path as Request Payment */
        <div className="p-5 bg-amber-50/90 border-2 border-amber-200 rounded-xl space-y-3.5 text-amber-900" data-testid="payout-account-required">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span>Payout Account Required</span>
                <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100/60 text-amber-800 font-semibold">
                  Mandatory
                </Badge>
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                You must first add a valid bank account in your name (<strong>{requesterName}</strong>) to receive
                payouts from your {context === "invoice" ? "invoices" : context === "campaign" || context === "group_pay" ? "funding campaigns" : "payment requests"}. The account holder name must match your registered name.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs h-10 font-semibold gap-1.5 shadow-sm"
            data-testid="button-add-first-payout-account"
          >
            <Plus className="w-4 h-4" />
            Add and Verify Bank Account
          </Button>
        </div>
      ) : (
        /* Receiving Payout Account Card */
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" data-testid="payout-account-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Receiving Payout Account</span>
              {selectedAccount?.isDefault && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/10">
                  Default
                </Badge>
              )}
            </div>
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChangingPayoutAccount(!isChangingPayoutAccount)}
                className="text-xs text-primary h-7 px-2 font-medium"
                data-testid="button-toggle-change-payout"
              >
                {isChangingPayoutAccount ? "Done" : "Change"}
              </Button>
            </div>
          </div>

          {!isChangingPayoutAccount ? (
            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{selectedAccount?.bankName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedAccount?.maskedNumber} • {selectedAccount?.holderName}
                </p>
              </div>
              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-semibold text-xs shrink-0">
                {selectedAccount?.currency}
              </Badge>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {verifiedAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    onSelect(acc);
                    setIsChangingPayoutAccount(false);
                  }}
                  className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                    selectedAccount?.id === acc.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-white hover:border-primary/40"
                  }`}
                  data-testid={`button-select-payout-${acc.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="truncate text-xs">
                      <span className="font-semibold">{acc.bankName}</span> ({acc.maskedNumber})
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-600">{acc.currency}</span>
                    {selectedAccount?.id === acc.id && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(true)}
                className="w-full p-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors mt-2"
                data-testid="button-add-new-payout-in-list"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Bank Account</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Payout Bank Account Dialog — identical to Request Payment */}
      <Dialog open={isAddAccountModalOpen} onOpenChange={setIsAddAccountModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-payout-account">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Add Payout Bank Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a bank account to receive payouts directly from your {context === "invoice" ? "invoices" : context === "campaign" || context === "group_pay" ? "funding campaigns" : "payment requests"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Account Currency *</Label>
              <Select
                value={newAccountData.currency}
                onValueChange={(val) => setNewAccountData(prev => ({ ...prev, currency: val }))}
              >
                <SelectTrigger className="h-10 text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP (£) - United Kingdom</SelectItem>
                  <SelectItem value="NGN">NGN (₦) - Nigeria</SelectItem>
                  <SelectItem value="USD">USD ($) - United States</SelectItem>
                  <SelectItem value="EUR">EUR (€) - Eurozone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modalBankName" className="text-xs font-medium">Bank Name *</Label>
              <Input
                id="modalBankName"
                data-testid="input-account-bank"
                placeholder="e.g. Barclays, Chase, Access Bank"
                value={newAccountData.bank}
                onChange={(e) => setNewAccountData(prev => ({ ...prev, bank: e.target.value }))}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modalAccountNumber" className="text-xs font-medium">
                {newAccountData.currency === "EUR" ? "IBAN *" : "Account Number *"}
              </Label>
              <Input
                id="modalAccountNumber"
                data-testid="input-account-number"
                placeholder={newAccountData.currency === "EUR" ? "GB29BARC204567..." : "12345678"}
                value={newAccountData.accountNumber}
                onChange={(e) => setNewAccountData(prev => ({ ...prev, accountNumber: e.target.value }))}
                className="h-10 text-sm font-mono"
              />
            </div>

            {newAccountData.currency !== "NGN" && (
              <div className="space-y-1.5">
                <Label htmlFor="modalRoutingNumber" className="text-xs font-medium">
                  {newAccountData.currency === "GBP" ? "Sort Code" : newAccountData.currency === "USD" ? "Routing Number (ABA)" : "BIC / SWIFT"}
                </Label>
                <Input
                  id="modalRoutingNumber"
                  placeholder={newAccountData.currency === "GBP" ? "20-45-67" : "021000021"}
                  value={newAccountData.routingNumber}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, routingNumber: e.target.value }))}
                  className="h-10 text-sm font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="modalAccountHolder" className="text-xs font-semibold text-slate-900">
                  Account Holder Name (Requester) *
                </Label>
                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1 font-medium">
                  <Check className="w-3 h-3" />
                  Verified Name
                </Badge>
              </div>
              <Input
                id="modalAccountHolder"
                value={requesterName}
                readOnly
                disabled
                className="h-10 text-sm bg-slate-100 font-medium text-slate-800 cursor-not-allowed border-slate-200"
              />
              <div className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  The bank account name must strictly match your verified profile name (<strong>{requesterName}</strong>). Payouts cannot be made to third-party bank accounts.
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddAccountModalOpen(false)}
              disabled={isSubmittingNewAccount}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateNewAccount}
              data-testid="button-save-account"
              disabled={!newAccountData.bank || !newAccountData.accountNumber || isSubmittingNewAccount}
              className="gap-1.5 bg-primary"
            >
              {isSubmittingNewAccount ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding Account...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save & Select</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
