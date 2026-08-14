import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, FileText, X, Check, Copy, CheckCircle2, Send, Search, User, Building2, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { knownSenders, type KnownSender } from "@/data/knownSenders";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

const currencies = [
  { label: "GBP - British Pound", value: "GBP" },
  { label: "USD - US Dollar", value: "USD" },
  { label: "EUR - Euro", value: "EUR" },
  { label: "NGN - Nigerian Naira", value: "NGN" },
  { label: "CAD - Canadian Dollar", value: "CAD" },
  { label: "AUD - Australian Dollar", value: "AUD" },
  { label: "JPY - Japanese Yen", value: "JPY" },
  { label: "CNY - Chinese Yuan", value: "CNY" },
  { label: "INR - Indian Rupee", value: "INR" },
  { label: "ZAR - South African Rand", value: "ZAR" },
  { label: "KES - Kenyan Shilling", value: "KES" },
  { label: "GHS - Ghanaian Cedi", value: "GHS" },
  { label: "AED - UAE Dirham", value: "AED" },
];

interface FormData {
  invoiceFile: File | null;
  invoiceAmount: string;
  currency: string;
  senderCurrency: string;
  absorbFee: boolean;
  recipientType: "individual" | "business";
  recipientFirstName: string;
  recipientMiddleName: string;
  recipientLastName: string;
  recipientBusinessName: string;
  recipientEmail: string;
  countryCode: string;
  recipientPhone: string;
  dueDate: string;
  notes: string;
}

const initialFormData: FormData = {
  invoiceFile: null,
  invoiceAmount: "",
  currency: "GBP",
  senderCurrency: "",
  absorbFee: false,
  recipientType: "individual",
  recipientFirstName: "",
  recipientMiddleName: "",
  recipientLastName: "",
  recipientBusinessName: "",
  recipientEmail: "",
  countryCode: "+44",
  recipientPhone: "",
  dueDate: "",
  notes: "",
};

export default function SendInvoice() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [senderSearch, setSenderSearch] = useState("");
  const [showSenderSuggestions, setShowSenderSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const senderEmail = params.get("sender");
    if (senderEmail) {
      const sender = knownSenders.find(s => s.email === senderEmail);
      if (sender) {
        setFormData(prev => ({
          ...prev,
          recipientType: sender.senderType,
          recipientFirstName: sender.firstName,
          recipientMiddleName: sender.middleName,
          recipientLastName: sender.lastName,
          recipientBusinessName: sender.businessName,
          recipientEmail: sender.email,
          countryCode: sender.countryCode,
          recipientPhone: sender.phone,
        }));
      }
    }
  }, []);

  const filteredSenders = knownSenders.filter(sender => {
    const displayName = sender.senderType === "business"
      ? sender.businessName.toLowerCase()
      : `${sender.firstName} ${sender.middleName} ${sender.lastName}`.toLowerCase();
    const searchLower = senderSearch.toLowerCase();
    return displayName.includes(searchLower) || sender.email.toLowerCase().includes(searchLower);
  });

  const selectKnownSender = (sender: KnownSender) => {
    setFormData(prev => ({
      ...prev,
      recipientType: sender.senderType,
      recipientFirstName: sender.firstName,
      recipientMiddleName: sender.middleName,
      recipientLastName: sender.lastName,
      recipientBusinessName: sender.businessName,
      recipientEmail: sender.email,
      countryCode: sender.countryCode,
      recipientPhone: sender.phone,
    }));
    setSenderSearch("");
    setShowSenderSuggestions(false);
  };

  const invoiceLink = `rhemito.com/invoice/inv${Math.random().toString(36).substring(2, 8)}`;

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (file: File | null) => {
    setFormData((prev) => ({ ...prev, invoiceFile: file }));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${invoiceLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = () => {
    setIsSuccess(true);
  };

  const canSubmit = formData.invoiceFile && formData.invoiceAmount && formData.recipientEmail &&
    (formData.recipientType === "individual" ? formData.recipientFirstName : formData.recipientBusinessName);

  if (isSuccess) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto mt-12"
        >
          <Card className="text-center">
            <CardContent className="pt-12 pb-8 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-display">Invoice Sent!</h2>
                <p className="text-muted-foreground text-sm">
                  The invoice and payment link have been emailed to{" "}
                  <span className="font-semibold text-foreground">{formData.recipientEmail}</span> for{" "}
                  <span className="font-semibold text-foreground">
                    {formData.recipientType === "business"
                      ? formData.recipientBusinessName
                      : [formData.recipientFirstName, formData.recipientMiddleName, formData.recipientLastName].filter(Boolean).join(" ")}
                  </span>.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-xs text-muted-foreground">You can also share this invoice link directly:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={`https://${invoiceLink}`}
                    readOnly
                    className="text-sm bg-white"
                    data-testid="input-invoice-link"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="shrink-0"
                    data-testid="button-copy-link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation("/")}
                  data-testid="button-back-to-dashboard"
                >
                  Back to Dashboard
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    setFormData(initialFormData);
                    setIsSuccess(false);
                  }}
                  data-testid="button-new-invoice"
                >
                  New Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="text-2xl font-bold font-display">Send Invoice</h1>
          <p className="text-muted-foreground mt-1">Upload an invoice and send it to your client</p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Invoice Details</CardTitle>
            <CardDescription>Upload your invoice and enter payment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-foreground">
                      Invoice Document <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                      Mandatory
                    </span>
                  </div>

                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : !formData.invoiceFile
                        ? "border-slate-300 hover:border-primary/50 bg-slate-50/50"
                        : "border-primary/40 bg-primary/5"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {formData.invoiceFile ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm text-foreground">{formData.invoiceFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(formData.invoiceFile.size / 1024).toFixed(1)} KB • Attached
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileChange(null)}
                          data-testid="button-remove-file"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium text-sm text-slate-800 mb-1">
                          Drag and drop your invoice here <span className="text-destructive">*</span>
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">PDF, PNG, or JPG up to 10MB (Mandatory)</p>
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-browse-files"
                          className="bg-white shadow-sm"
                        >
                          Browse Files
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                        />
                      </>
                    )}
                  </div>
                  {!formData.invoiceFile && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      An invoice document must be attached before sending.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceAmount">Invoice Amount *</Label>
                    <Input
                      id="invoiceAmount"
                      type="number"
                      placeholder="0.00"
                      value={formData.invoiceAmount}
                      onChange={(e) => handleInputChange("invoiceAmount", e.target.value)}
                      data-testid="input-invoice-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => handleInputChange("currency", value)}
                    >
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="NGN">NGN (₦)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 flex flex-col">
                  <Label>Sender Pays in (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !formData.senderCurrency && "text-muted-foreground"
                        )}
                        data-testid="combobox-sender-currency"
                      >
                        {formData.senderCurrency
                          ? currencies.find(
                            (currency) => currency.value === formData.senderCurrency
                          )?.label
                          : "Select currency sender pays in..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search currency..." />
                        <CommandList>
                          <CommandEmpty>No currency found.</CommandEmpty>
                          <CommandGroup>
                            {currencies.map((currency) => (
                              <CommandItem
                                value={currency.label}
                                key={currency.value}
                                onSelect={() => {
                                  handleInputChange("senderCurrency", currency.value);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currency.value === formData.senderCurrency
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {currency.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-[0.8rem] text-muted-foreground">
                    If specified, we'll convert the invoice amount to this currency for the sender.
                  </p>
                </div>

                {/* Fee Absorption Checkbox */}
                <div className="flex items-start space-x-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                  <Checkbox
                    id="absorbFee"
                    checked={formData.absorbFee}
                    onCheckedChange={(checked) => handleInputChange("absorbFee", checked === true)}
                    data-testid="checkbox-absorb-fee"
                    className="mt-0.5"
                  />
                  <div className="grid gap-1 leading-none cursor-pointer" onClick={() => handleInputChange("absorbFee", !formData.absorbFee)}>
                    <Label
                      htmlFor="absorbFee"
                      className="text-sm font-semibold cursor-pointer text-slate-900"
                    >
                      Absorb the 3% transaction fee
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The client pays the exact invoice amount requested ({CURRENCY_SYMBOLS[formData.currency] || "£"}{formData.invoiceAmount && parseFloat(formData.invoiceAmount) > 0 ? parseFloat(formData.invoiceAmount).toFixed(2) : "0.00"}), and the 3% fee is deducted from your received balance.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <Label>Search Existing Recipient</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Type name or email to search..."
                      value={senderSearch}
                      onChange={(e) => {
                        setSenderSearch(e.target.value);
                        setShowSenderSuggestions(true);
                      }}
                      onFocus={() => setShowSenderSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSenderSuggestions(false), 150)}
                      className="pl-9 bg-primary/5 border-primary/20"
                      data-testid="input-recipient-search"
                      autoComplete="off"
                    />
                  </div>
                  <AnimatePresence>
                    {showSenderSuggestions && senderSearch && filteredSenders.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-56 overflow-auto"
                      >
                        {filteredSenders.map((sender) => (
                          <button
                            key={sender.email}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b last:border-b-0"
                            onClick={() => selectKnownSender(sender)}
                            data-testid={`suggestion-recipient-${sender.email.replace(/[@.]/g, '-')}`}
                          >
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              {sender.senderType === "business" ? (
                                <Building2 className="w-5 h-5 text-primary" />
                              ) : (
                                <User className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {sender.senderType === "business"
                                  ? sender.businessName
                                  : `${sender.firstName} ${sender.middleName} ${sender.lastName}`.trim()}
                              </p>
                              <p className="text-xs text-muted-foreground">{sender.email}</p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <p className="text-xs text-muted-foreground">Select an existing recipient or enter new details below</p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <Label>Recipient Type *</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => handleInputChange("recipientType", "individual")}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${formData.recipientType === "individual"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                        }`}
                      data-testid="button-recipient-type-individual"
                    >
                      <User className={`w-5 h-5 ${formData.recipientType === "individual" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`font-medium ${formData.recipientType === "individual" ? "text-primary" : ""}`}>Individual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange("recipientType", "business")}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${formData.recipientType === "business"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                        }`}
                      data-testid="button-recipient-type-business"
                    >
                      <Building2 className={`w-5 h-5 ${formData.recipientType === "business" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`font-medium ${formData.recipientType === "business" ? "text-primary" : ""}`}>Business</span>
                    </button>
                  </div>
                </div>

                {formData.recipientType === "individual" ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="recipientFirstName">First Name *</Label>
                      <Input
                        id="recipientFirstName"
                        placeholder="First name"
                        value={formData.recipientFirstName}
                        onChange={(e) => handleInputChange("recipientFirstName", e.target.value)}
                        data-testid="input-recipient-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientMiddleName">Middle Name</Label>
                      <Input
                        id="recipientMiddleName"
                        placeholder="Middle name"
                        value={formData.recipientMiddleName}
                        onChange={(e) => handleInputChange("recipientMiddleName", e.target.value)}
                        data-testid="input-recipient-middle-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientLastName">Last Name</Label>
                      <Input
                        id="recipientLastName"
                        placeholder="Last name"
                        value={formData.recipientLastName}
                        onChange={(e) => handleInputChange("recipientLastName", e.target.value)}
                        data-testid="input-recipient-last-name"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="recipientBusinessName">Business Name *</Label>
                    <Input
                      id="recipientBusinessName"
                      placeholder="Enter business name"
                      value={formData.recipientBusinessName}
                      onChange={(e) => handleInputChange("recipientBusinessName", e.target.value)}
                      data-testid="input-recipient-business-name"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="Where to send the invoice"
                    value={formData.recipientEmail}
                    onChange={(e) => handleInputChange("recipientEmail", e.target.value)}
                    data-testid="input-recipient-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipientPhone">Recipient Phone (Optional)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.countryCode}
                      onValueChange={(value) => handleInputChange("countryCode", value)}
                    >
                      <SelectTrigger className="w-32" data-testid="select-country-code">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((country, index) => (
                          <SelectItem key={`${country.code}-${index}`} value={country.code}>
                            {country.flag} {country.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="recipientPhone"
                      type="tel"
                      placeholder="Mobile number"
                      value={formData.recipientPhone}
                      onChange={(e) => handleInputChange("recipientPhone", e.target.value)}
                      className="flex-1"
                      data-testid="input-recipient-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange("dueDate", e.target.value)}
                    data-testid="input-due-date"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/")}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    data-testid="button-send-invoice"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Invoice
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-24">
                <div className="border-2 border-primary/20 rounded-xl p-5 space-y-4 bg-white shadow-sm" data-testid="fee-breakdown">
                  <h3 className="font-semibold text-lg text-slate-900">Amount Summary</h3>

                  {(() => {
                    const parsed = parseFloat(formData.invoiceAmount) || 0;
                    const fee = parsed * 0.03;
                    const clientPays = formData.absorbFee ? parsed : parsed + fee;
                    const youReceive = formData.absorbFee ? parsed - fee : parsed;
                    const sym = CURRENCY_SYMBOLS[formData.currency] || "£";

                    return (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Invoice Amount:</span>
                            <span className="font-medium text-slate-800">
                              {sym}{parsed.toFixed(2)} {formData.currency}
                            </span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Fee (3%{formData.absorbFee ? " absorbed by you" : " added to client"}):
                            </span>
                            <span className={`font-medium ${formData.absorbFee ? "text-red-600" : "text-slate-800"}`}>
                              {formData.absorbFee ? "-" : "+"}{sym}{fee.toFixed(2)} {formData.currency}
                            </span>
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div className="flex justify-between pt-1 items-baseline">
                          <span className="font-medium text-slate-800">Client Pays:</span>
                          <span className="font-bold text-lg text-teal">
                            {sym}{clientPays.toFixed(2)} {formData.currency}
                          </span>
                        </div>

                        <div className="flex justify-between items-center bg-primary/5 -mx-5 px-5 py-3.5 -mb-5 rounded-b-xl border-t border-primary/10">
                          <div>
                            <span className="font-medium text-slate-900">You Receive:</span>
                            {formData.absorbFee && (
                              <p className="text-[10px] text-muted-foreground">Fee deducted from balance</p>
                            )}
                          </div>
                          <span className="font-bold text-lg text-primary">
                            {sym}{youReceive.toFixed(2)} {formData.currency}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
