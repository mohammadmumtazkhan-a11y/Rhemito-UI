import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Building2, User } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  COUNTRY_OPTIONS,
  SUPPORTED_COUNTRIES,
  formatSortCode,
  isValidSortCode,
  isValidAbaRoutingNumber,
  maskAccountNumber,
  formatBankDetailsDisplay,
} from "@/lib/payoutConfig";

export interface PayoutAccount {
  id: string;
  refNo: string;
  name: string;
  currency: string;
  bank: string;
  bankCode?: string;
  accountNumber: string;
  routingNumber: string;
  sortCode?: string;
  institutionNumber?: string;
  transitNumber?: string;
  bankAccountType?: string;
  payout: string;
  activated: boolean;
  isDefault?: boolean;
}

const initialAccounts: PayoutAccount[] = [
  {
    id: "1",
    refNo: "1105",
    name: "John Doe",
    currency: "NGN",
    bank: "Access Bank Nigeria Plc",
    bankCode: "044",
    accountNumber: "1231230001",
    routingNumber: "N/A",
    payout: "NGN 10000",
    activated: true,
    isDefault: true,
  },
  {
    id: "2",
    refNo: "1106",
    name: "John Doe",
    currency: "GBP",
    bank: "Barclays",
    accountNumber: "12312300011",
    routingNumber: "20-45-67",
    sortCode: "20-45-67",
    payout: "GBP 10000",
    activated: true,
  },
  {
    id: "3",
    refNo: "1107",
    name: "John Doe",
    currency: "USD",
    bank: "Chase",
    accountNumber: "12312300011",
    routingNumber: "021000021",
    bankAccountType: "checking",
    payout: "USD 2000",
    activated: true,
  },
];

export default function PayoutAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<PayoutAccount[]>(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successText, setSuccessText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nigeria bank list & resolution state
  const [nigeriaBanks, setNigeriaBanks] = useState<{ code: string; name: string }[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState<"idle" | "verified" | "failed">("idle");
  const [resolvedAccountName, setResolvedAccountName] = useState<string>("");
  const [resolutionError, setResolutionError] = useState<string>("");

  // Determine verified account holder and profile type
  const verifiedAccountHolder = user
    ? user.accountType === "business" && user.businessName
      ? user.businessName
      : [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || `${user.firstName || "John"} ${user.lastName || "Doe"}`
    : "John Doe";

  const profileType = user?.accountType === "business" ? "Business" : "Individual";
  const isProfileNameMissing = !verifiedAccountHolder || verifiedAccountHolder.trim() === "";

  // Form State
  const [countryCode, setCountryCode] = useState<string>("GB");
  const [sortCode, setSortCode] = useState<string>("");
  const [ukBankName, setUkBankName] = useState<string>("Barclays");
  const [ngBankCode, setNgBankCode] = useState<string>("");
  const [routingNumber, setRoutingNumber] = useState<string>("");
  const [usBankName, setUsBankName] = useState<string>("JPMorgan Chase");
  const [bankAccountType, setBankAccountType] = useState<string>("");
  const [institutionNumber, setInstitutionNumber] = useState<string>("");
  const [transitNumber, setTransitNumber] = useState<string>("");
  const [caBankName, setCaBankName] = useState<string>("Royal Bank of Canada");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [ownershipDeclared, setOwnershipDeclared] = useState<boolean>(false);

  // Field touch states for inline error display
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const currentCountryConfig = SUPPORTED_COUNTRIES[countryCode] || SUPPORTED_COUNTRIES.GB;
  const currentCurrency = currentCountryConfig.currency;

  // Duplicate-account rule: only one payout bank account allowed per currency
  const existingAccountForCurrency = accounts.find(
    (a) => a.currency === currentCurrency && (!editingId || a.id !== editingId)
  );
  const isDuplicateCurrency = !!existingAccountForCurrency;

  // Fetch bank list when Nigeria is selected
  useEffect(() => {
    if (countryCode === "NG") {
      setIsLoadingBanks(true);
      fetch("/api/banks?country=NG")
        .then((res) => res.json())
        .then((data) => {
          if (data.banks && Array.isArray(data.banks)) {
            setNigeriaBanks(data.banks);
          }
        })
        .catch((err) => {
          console.error("Failed to load Nigerian banks:", err);
        })
        .finally(() => {
          setIsLoadingBanks(false);
        });
    }
  }, [countryCode]);

  // Account resolution for Nigeria
  useEffect(() => {
    if (countryCode === "NG") {
      const cleanAcc = accountNumber.trim();
      if (ngBankCode && cleanAcc.length === 10 && /^\d{10}$/.test(cleanAcc)) {
        setIsResolvingAccount(true);
        setResolutionError("");
        setResolutionStatus("idle");

        fetch("/api/banks/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankCode: ngBankCode,
            accountNumber: cleanAcc,
            country: "NG",
          }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.verified) {
              setResolutionStatus("verified");
              setResolvedAccountName(data.accountName || verifiedAccountHolder);
              setResolutionError("");
            } else {
              setResolutionStatus("failed");
              setResolvedAccountName("");
              setResolutionError(
                data.message ||
                  "We could not verify this bank account. Check the selected bank and account number and try again."
              );
            }
          })
          .catch(() => {
            setResolutionStatus("failed");
            setResolvedAccountName("");
            setResolutionError(
              "We could not verify this bank account. Check the selected bank and account number and try again."
            );
          })
          .finally(() => {
            setIsResolvingAccount(false);
          });
      } else {
        setResolutionStatus("idle");
        setResolvedAccountName("");
        setResolutionError("");
      }
    }
  }, [countryCode, ngBankCode, accountNumber, verifiedAccountHolder]);

  // Country Change handler
  const handleCountryChange = (newCountry: string) => {
    if (editingId) return; // Prevent changing country while editing existing account
    setCountryCode(newCountry);
    // Clear previous country-specific values
    setSortCode("");
    setNgBankCode("");
    setRoutingNumber("");
    setBankAccountType("");
    setInstitutionNumber("");
    setTransitNumber("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setOwnershipDeclared(false);
    setResolutionStatus("idle");
    setResolvedAccountName("");
    setResolutionError("");
    setTouched({});
  };

  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  // Field validations
  const isSortCodeValid = countryCode !== "GB" || isValidSortCode(sortCode);
  const isUkAccountValid = countryCode !== "GB" || (accountNumber.length === 8 && /^\d{8}$/.test(accountNumber));
  const isNgBankSelected = countryCode !== "NG" || !!ngBankCode;
  const isNgAccountValid = countryCode !== "NG" || (accountNumber.length === 10 && /^\d{10}$/.test(accountNumber));
  const isNgResolutionValid = countryCode !== "NG" || resolutionStatus === "verified";
  const isUsRoutingValid = countryCode !== "US" || isValidAbaRoutingNumber(routingNumber);
  const isUsAccountTypeValid = countryCode !== "US" || (bankAccountType === "checking" || bankAccountType === "savings");
  const isUsAccountValid = countryCode !== "US" || (accountNumber.length >= 4 && /^\d+$/.test(accountNumber));
  const isCaInstitutionValid = countryCode !== "CA" || (institutionNumber.length === 3 && /^\d{3}$/.test(institutionNumber));
  const isCaTransitValid = countryCode !== "CA" || (transitNumber.length === 5 && /^\d{5}$/.test(transitNumber));
  const isCaAccountValid = countryCode !== "CA" || (accountNumber.length >= 5 && /^\d+$/.test(accountNumber));

  const isAccountNumberFilled = accountNumber.trim().length > 0;
  const isConfirmFilled = confirmAccountNumber.trim().length > 0;
  const doAccountsMatch = isAccountNumberFilled && accountNumber === confirmAccountNumber;

  const isFormValid =
    !isProfileNameMissing &&
    !isDuplicateCurrency &&
    ownershipDeclared &&
    doAccountsMatch &&
    (countryCode === "GB" ? isSortCodeValid && isUkAccountValid : true) &&
    (countryCode === "NG" ? isNgBankSelected && isNgAccountValid && isNgResolutionValid : true) &&
    (countryCode === "US" ? isUsRoutingValid && isUsAccountTypeValid && isUsAccountValid : true) &&
    (countryCode === "CA" ? isCaInstitutionValid && isCaTransitValid && isCaAccountValid : true);

  const resetForm = () => {
    setSortCode("");
    setNgBankCode("");
    setRoutingNumber("");
    setBankAccountType("");
    setInstitutionNumber("");
    setTransitNumber("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setOwnershipDeclared(false);
    setResolutionStatus("idle");
    setResolvedAccountName("");
    setResolutionError("");
    setTouched({});
    setEditingId(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const handleSaveAccount = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Build selected bank name
      let selectedBank = "";
      if (countryCode === "GB") selectedBank = ukBankName || "Barclays";
      else if (countryCode === "NG") {
        const found = nigeriaBanks.find((b) => b.code === ngBankCode);
        selectedBank = found ? found.name : "Access Bank Nigeria Plc";
      } else if (countryCode === "US") selectedBank = usBankName || "JPMorgan Chase";
      else if (countryCode === "CA") selectedBank = caBankName || "Royal Bank of Canada";

      // Build clean bank account object with digits only
      const cleanAccountNumber = accountNumber.replace(/\D/g, "");
      const cleanSortCode = countryCode === "GB" ? sortCode.replace(/\D/g, "") : undefined;
      const cleanRoutingNumber = countryCode === "US" ? routingNumber.replace(/\D/g, "") : "N/A";
      const cleanInstNumber = countryCode === "CA" ? institutionNumber.replace(/\D/g, "") : undefined;
      const cleanTransitNumber = countryCode === "CA" ? transitNumber.replace(/\D/g, "") : undefined;

      if (editingId) {
        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id === editingId) {
              return {
                ...acc,
                bank: selectedBank,
                bankCode: countryCode === "NG" ? ngBankCode : undefined,
                accountNumber: cleanAccountNumber,
                routingNumber: cleanRoutingNumber,
                sortCode: cleanSortCode ? formatSortCode(cleanSortCode) : undefined,
                institutionNumber: cleanInstNumber,
                transitNumber: cleanTransitNumber,
                bankAccountType: countryCode === "US" ? bankAccountType : undefined,
              };
            }
            return acc;
          })
        );
        setSuccessText("Payout bank account updated successfully.");
        toast({
          title: "Account Updated",
          description: `${selectedBank} (${currentCurrency}) payout details have been updated.`,
        });
      } else {
        const newAcc: PayoutAccount = {
          id: Date.now().toString(),
          refNo: (1100 + accounts.length + 1).toString(),
          name: verifiedAccountHolder,
          currency: currentCurrency,
          bank: selectedBank,
          bankCode: countryCode === "NG" ? ngBankCode : undefined,
          accountNumber: cleanAccountNumber,
          routingNumber: cleanRoutingNumber,
          sortCode: cleanSortCode ? formatSortCode(cleanSortCode) : undefined,
          institutionNumber: cleanInstNumber,
          transitNumber: cleanTransitNumber,
          bankAccountType: countryCode === "US" ? bankAccountType : undefined,
          payout: `${currentCurrency} 0`,
          activated: true,
        };
        setAccounts((prev) => [...prev, newAcc]);
        setSuccessText("Settlement bank account added successfully.");
        toast({
          title: "Account Added",
          description: `${selectedBank} (${currentCurrency}) was added to your settlement bank accounts.`,
        });
      }

      resetForm();
      setIsModalOpen(false);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 4000);
    } catch (error) {
      console.error("Save account error:", error);
      toast({
        title: "Error",
        description: "Failed to save settlement bank account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (account: PayoutAccount) => {
    setEditingId(account.id);
    // Find matching country
    let targetCountry = "GB";
    if (account.currency === "GBP") targetCountry = "GB";
    else if (account.currency === "NGN") targetCountry = "NG";
    else if (account.currency === "USD") targetCountry = "US";
    else if (account.currency === "CAD") targetCountry = "CA";

    setCountryCode(targetCountry);
    if (targetCountry === "GB") {
      setSortCode(account.sortCode || account.routingNumber || "");
      setUkBankName(account.bank || "Barclays");
    } else if (targetCountry === "NG") {
      setNgBankCode(account.bankCode || "");
    } else if (targetCountry === "US") {
      setRoutingNumber(account.routingNumber || "");
      setUsBankName(account.bank || "JPMorgan Chase");
      setBankAccountType(account.bankAccountType || "checking");
    } else if (targetCountry === "CA") {
      setInstitutionNumber(account.institutionNumber || "");
      setTransitNumber(account.transitNumber || "");
      setCaBankName(account.bank || "Royal Bank of Canada");
    }

    setAccountNumber(account.accountNumber);
    setConfirmAccountNumber(account.accountNumber);
    setOwnershipDeclared(true);
    setResolutionStatus("idle");
    setResolutionError("");
    setTouched({});
    setIsModalOpen(true);
  };

  const handleDeleteAccount = (id: string) => {
    const target = accounts.find((a) => a.id === id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setShowDeleteConfirm(null);
    setSuccessText("Settlement bank account deleted successfully.");
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
    toast({
      title: "Account Removed",
      description: `${target?.bank || "Settlement bank account"} (${target?.currency || ""}) has been deleted.`,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AnimatePresence>
          {showSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 shadow-sm"
              role="alert"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800 font-medium">{successText}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Home / Manage Settlement Bank Account</p>
            <h1 className="text-2xl font-bold font-display mt-1">Settlement bank account</h1>
          </div>
          <Button
            onClick={handleOpenAddModal}
            className="gap-2 bg-primary"
            data-testid="button-open-add-payout-account"
          >
            <Plus className="w-4 h-4" />
            Add Settlement Bank Account
          </Button>
        </div>

        {/* Add / Edit Payout Bank Account Dialog */}
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseModal();
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-display text-foreground">
                {editingId ? "Edit settlement bank account" : "Add settlement bank account"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Add a bank account to receive settlements from your wallet. The bank account must be held in your name or
                your registered business name.
              </DialogDescription>
            </DialogHeader>

            {/* Missing verified name warning */}
            {isProfileNameMissing && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Your verified account-holder name is unavailable. Please complete or update your profile before adding a
                  payout bank account.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {/* 1. Account Holder & Profile Type (Read-only) */}
              <div className="p-4 bg-muted/40 rounded-xl border border-border/60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Account Holder
                    </Label>
                    <p className="text-base font-semibold text-foreground" data-testid="text-account-holder">
                      {verifiedAccountHolder || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Retrieved from your verified Rhemito profile</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Profile Type
                    </Label>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Badge variant="secondary" className="font-medium">
                        {profileType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Bank Country & Payout Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankCountry" className="font-medium">
                    Bank country *
                  </Label>
                  <Select
                    value={countryCode}
                    onValueChange={handleCountryChange}
                    disabled={!!editingId}
                  >
                    <SelectTrigger id="bankCountry" data-testid="select-payout-country">
                      <SelectValue placeholder="Select bank country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payoutCurrency" className="font-medium">
                    Payout currency *
                  </Label>
                  <Input
                    id="payoutCurrency"
                    value={currentCountryConfig.currencyName}
                    readOnly
                    disabled
                    className="bg-muted/40 font-medium cursor-not-allowed"
                    data-testid="input-payout-currency"
                  />
                </div>
              </div>

              {/* Duplicate Currency Alert */}
              {isDuplicateCurrency && (
                <div
                  className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3"
                  role="alert"
                >
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">Settlement bank account already exists for {currentCurrency}</p>
                    <p className="mt-0.5">
                      A settlement bank account has already been added for this currency. Edit the existing account if you need
                      to change its details.
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Country-Specific Bank Details */}
              {/* --- United Kingdom Fields --- */}
              {countryCode === "GB" && (
                <div className="space-y-4 pt-1 border-t border-border/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ukSortCode" className="font-medium">
                        Sort code *
                      </Label>
                      <Input
                        id="ukSortCode"
                        type="text"
                        inputMode="numeric"
                        placeholder="12-34-56"
                        maxLength={8}
                        value={sortCode}
                        onChange={(e) => {
                          const formatted = formatSortCode(e.target.value);
                          setSortCode(formatted);
                        }}
                        onBlur={() => handleBlur("sortCode")}
                        className={touched.sortCode && !isSortCodeValid ? "border-destructive focus-visible:ring-destructive" : ""}
                        data-testid="input-payout-sort-code"
                      />
                      {touched.sortCode && !isSortCodeValid && (
                        <p className="text-xs text-destructive font-medium">Enter a valid 6-digit sort code.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ukBankName" className="font-medium">
                        Bank name
                      </Label>
                      <Input
                        id="ukBankName"
                        value={ukBankName}
                        onChange={(e) => setUkBankName(e.target.value)}
                        placeholder="e.g. Barclays"
                        data-testid="input-payout-bank-name"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- Nigeria Fields --- */}
              {countryCode === "NG" && (
                <div className="space-y-4 pt-1 border-t border-border/60">
                  <div className="space-y-2">
                    <Label htmlFor="ngBank" className="font-medium">
                      Bank *
                    </Label>
                    <Select
                      value={ngBankCode}
                      onValueChange={(val) => {
                        setNgBankCode(val);
                        setTouched((prev) => ({ ...prev, ngBank: true }));
                      }}
                      disabled={isLoadingBanks}
                    >
                      <SelectTrigger id="ngBank" data-testid="select-payout-bank">
                        <SelectValue placeholder={isLoadingBanks ? "Loading banks..." : "Select a bank"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {nigeriaBanks.map((b) => (
                          <SelectItem key={b.code} value={b.code}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {touched.ngBank && !isNgBankSelected && (
                      <p className="text-xs text-destructive font-medium">Select a bank.</p>
                    )}
                  </div>
                </div>
              )}

              {/* --- United States Fields --- */}
              {countryCode === "US" && (
                <div className="space-y-4 pt-1 border-t border-border/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="usRoutingNumber" className="font-medium">
                        Routing number *
                      </Label>
                      <Input
                        id="usRoutingNumber"
                        type="text"
                        inputMode="numeric"
                        placeholder="9-digit routing number"
                        maxLength={9}
                        value={routingNumber}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                          setRoutingNumber(digits);
                        }}
                        onBlur={() => handleBlur("routingNumber")}
                        className={touched.routingNumber && !isUsRoutingValid ? "border-destructive focus-visible:ring-destructive" : ""}
                        data-testid="input-payout-routing"
                      />
                      {touched.routingNumber && !isUsRoutingValid && (
                        <p className="text-xs text-destructive font-medium">Enter a valid 9-digit routing number.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="usBankAccountType" className="font-medium">
                        Bank account type *
                      </Label>
                      <Select
                        value={bankAccountType}
                        onValueChange={(val) => {
                          setBankAccountType(val);
                          setTouched((prev) => ({ ...prev, bankAccountType: true }));
                        }}
                      >
                        <SelectTrigger id="usBankAccountType" data-testid="select-payout-account-type">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                        </SelectContent>
                      </Select>
                      {touched.bankAccountType && !isUsAccountTypeValid && (
                        <p className="text-xs text-destructive font-medium">Select the bank account type.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- Canada Fields --- */}
              {countryCode === "CA" && (
                <div className="space-y-4 pt-1 border-t border-border/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="caInstitutionNumber" className="font-medium">
                        Institution number *
                      </Label>
                      <Input
                        id="caInstitutionNumber"
                        type="text"
                        inputMode="numeric"
                        placeholder="3-digit institution number"
                        maxLength={3}
                        value={institutionNumber}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setInstitutionNumber(digits);
                        }}
                        onBlur={() => handleBlur("institutionNumber")}
                        className={touched.institutionNumber && !isCaInstitutionValid ? "border-destructive focus-visible:ring-destructive" : ""}
                        data-testid="input-payout-institution-number"
                      />
                      {touched.institutionNumber && !isCaInstitutionValid && (
                        <p className="text-xs text-destructive font-medium">Enter a valid 3-digit institution number.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="caTransitNumber" className="font-medium">
                        Transit number *
                      </Label>
                      <Input
                        id="caTransitNumber"
                        type="text"
                        inputMode="numeric"
                        placeholder="5-digit transit number"
                        maxLength={5}
                        value={transitNumber}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
                          setTransitNumber(digits);
                        }}
                        onBlur={() => handleBlur("transitNumber")}
                        className={touched.transitNumber && !isCaTransitValid ? "border-destructive focus-visible:ring-destructive" : ""}
                        data-testid="input-payout-transit-number"
                      />
                      {touched.transitNumber && !isCaTransitValid && (
                        <p className="text-xs text-destructive font-medium">Enter a valid 5-digit transit number.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Account Number & Confirmation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber" className="font-medium">
                    Account number *
                  </Label>
                  <Input
                    id="accountNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder={
                      countryCode === "GB"
                        ? "8-digit account number"
                        : countryCode === "NG"
                        ? "10-digit account number"
                        : "Enter account number"
                    }
                    maxLength={countryCode === "GB" ? 8 : countryCode === "NG" ? 10 : 17}
                    value={accountNumber}
                    onChange={(e) => {
                      const maxLen = countryCode === "GB" ? 8 : countryCode === "NG" ? 10 : 17;
                      const digits = e.target.value.replace(/\D/g, "").slice(0, maxLen);
                      setAccountNumber(digits);
                    }}
                    onBlur={() => handleBlur("accountNumber")}
                    className={
                      touched.accountNumber &&
                      ((countryCode === "GB" && !isUkAccountValid) ||
                        (countryCode === "NG" && !isNgAccountValid) ||
                        (countryCode === "US" && !isUsAccountValid) ||
                        (countryCode === "CA" && !isCaAccountValid))
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                    data-testid="input-payout-account-number"
                  />
                  {touched.accountNumber && countryCode === "GB" && !isUkAccountValid && (
                    <p className="text-xs text-destructive font-medium">Enter a valid 8-digit account number.</p>
                  )}
                  {touched.accountNumber && countryCode === "NG" && !isNgAccountValid && (
                    <p className="text-xs text-destructive font-medium">Enter a valid 10-digit account number.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmAccountNumber" className="font-medium">
                    Confirm account number *
                  </Label>
                  <Input
                    id="confirmAccountNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="Re-enter account number"
                    maxLength={countryCode === "GB" ? 8 : countryCode === "NG" ? 10 : 17}
                    value={confirmAccountNumber}
                    onChange={(e) => {
                      const maxLen = countryCode === "GB" ? 8 : countryCode === "NG" ? 10 : 17;
                      const digits = e.target.value.replace(/\D/g, "").slice(0, maxLen);
                      setConfirmAccountNumber(digits);
                    }}
                    onBlur={() => handleBlur("confirmAccountNumber")}
                    className={
                      touched.confirmAccountNumber && isConfirmFilled && !doAccountsMatch
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                    data-testid="input-payout-confirm-account-number"
                  />
                  {touched.confirmAccountNumber && isConfirmFilled && !doAccountsMatch && (
                    <p className="text-xs text-destructive font-medium">The account numbers do not match.</p>
                  )}
                </div>
              </div>

              {/* Nigeria Account Resolution Verification Card */}
              {countryCode === "NG" && (
                <div>
                  {isResolvingAccount && (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-center gap-2.5 text-blue-800 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Verifying account details with bank...</span>
                    </div>
                  )}
                  {resolutionStatus === "verified" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-center gap-2.5 text-green-800 text-sm">
                      <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-900">
                          Account name returned by bank: <span className="font-bold">{resolvedAccountName}</span>
                        </p>
                        <p className="text-xs text-green-700 mt-0.5">Account verified successfully</p>
                      </div>
                    </div>
                  )}
                  {resolutionStatus === "failed" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 text-red-800 text-sm">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900">Account verification failed</p>
                        <p className="text-xs text-red-700 mt-0.5">{resolutionError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. Ownership Declaration Checkbox */}
              <div className="pt-2">
                <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-xl border border-border/60">
                  <Checkbox
                    id="ownershipDeclaration"
                    checked={ownershipDeclared}
                    onCheckedChange={(checked) => {
                      setOwnershipDeclared(!!checked);
                      setTouched((prev) => ({ ...prev, ownership: true }));
                    }}
                    className="mt-0.5"
                    data-testid="checkbox-ownership-declaration"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="ownershipDeclaration"
                      className="text-sm font-medium text-foreground cursor-pointer select-none leading-relaxed"
                    >
                      I confirm that this bank account belongs to me or my registered business, and I authorise Rhemito to send
                      payouts to it.
                    </label>
                  </div>
                </div>
                {touched.ownership && !ownershipDeclared && (
                  <p className="text-xs text-destructive font-medium mt-1.5 ml-1">
                    Confirm that you own or are authorised to use this bank account.
                  </p>
                )}
              </div>

              {/* Dialog Footer Actions */}
              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border mt-4">
                <DialogClose asChild>
                  <Button variant="outline" onClick={handleCloseModal} disabled={isSubmitting} data-testid="button-cancel-payout-modal">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  onClick={handleSaveAccount}
                  disabled={!isFormValid || isSubmitting}
                  className="gap-2 min-w-[170px]"
                  data-testid="button-add-account"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingId ? "Saving changes…" : "Adding account…"}</span>
                    </>
                  ) : editingId ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save changes</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add settlement bank account</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Accounts Table or Mobile Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Accounts</h2>
          {isMobile ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm truncate">{account.bank}</div>
                        <div className="text-xs text-slate-500 truncate">{account.name}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                          <span className="font-mono text-[11px] text-blue-600 font-semibold">{account.refNo}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-[11px] text-slate-600">{maskAccountNumber(account.accountNumber)}</span>
                          {account.isDefault && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                              Default
                            </Badge>
                          )}
                        </div>
                        {formatBankDetailsDisplay(account) && (
                          <div className="mt-0.5 text-[11px] text-slate-400 font-mono">
                            {formatBankDetailsDisplay(account)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full">
                        {account.currency}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-1">
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${
                            account.activated ? "bg-green-500 animate-pulse" : "bg-gray-300"
                          }`}
                        />
                        {account.activated ? "Active" : "Inactive"}
                      </div>
                      {account.payout && (
                        <span className="text-[11px] text-slate-400 font-medium">{account.payout}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartEdit(account)}
                      className="h-8 px-3 text-xs font-medium rounded-lg text-blue-700 bg-blue-50/50 hover:bg-blue-100 border-blue-200 active:scale-95"
                      data-testid={`button-edit-${account.id}`}
                      aria-label={`Edit account ${account.refNo}`}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(account.id)}
                      className="h-8 px-3 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 hover:border-red-200 active:scale-95"
                      data-testid={`button-delete-${account.id}`}
                      aria-label={`Delete account ${account.refNo}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}

              {accounts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <p className="text-slate-400 text-sm">No settlement bank accounts added yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-primary text-white">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-medium">Ref No</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Account Holder</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Currency</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Bank</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Account Number</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Bank Details</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Payout</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Activated</th>
                    <th className="py-3 px-4 text-left text-sm font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4 font-medium">{account.refNo}</td>
                      <td className="py-4 px-4 font-medium text-foreground">{account.name}</td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-primary">{account.currency}</span>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">{account.bank}</td>
                      <td className="py-4 px-4 font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span>{maskAccountNumber(account.accountNumber)}</span>
                          {account.isDefault && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                              Default
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-sm text-muted-foreground">
                        {formatBankDetailsDisplay(account)}
                      </td>
                      <td className="py-4 px-4 font-medium">{account.payout}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`w-3 h-3 rounded-full inline-block ${
                            account.activated ? "bg-green-500 ring-4 ring-green-100" : "bg-gray-300"
                          }`}
                          title={account.activated ? "Activated" : "Inactive"}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleStartEdit(account)}
                                className="w-7 h-7 rounded bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                                data-testid={`button-edit-${account.id}`}
                                aria-label={`Edit account ${account.refNo}`}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-primary" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setShowDeleteConfirm(account.id)}
                                className="w-7 h-7 rounded bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                                data-testid={`button-delete-${account.id}`}
                                aria-label={`Delete account ${account.refNo}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {accounts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-muted-foreground">No settlement bank accounts added yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
            >
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Delete Account?</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Are you sure you want to delete this settlement bank account? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleDeleteAccount(showDeleteConfirm)}
                      data-testid="button-confirm-delete-account"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
