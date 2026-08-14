import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  QrCode,
  Search,
  User,
  Building2,
  AlertCircle,
  Landmark,
  ShieldCheck,
  ExternalLink,
  Download
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { knownSenders, type KnownSender } from "@/data/knownSenders";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

const COUNTRY_CODES = [
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
];

const VIRTUAL_ACCOUNTS: Record<string, {
  bankName: string;
  accountNumber: string;
  routingLabel: string;
  routingCode: string;
  iban?: string;
  bic?: string;
  country: string;
  rail: string;
}> = {
  GBP: {
    bankName: "Rhemito Virtual Bank UK (Barclays Rail)",
    accountNumber: "83920194",
    routingLabel: "Sort Code",
    routingCode: "20-45-67",
    iban: "GB29BARC20456783920194",
    bic: "BARCGB22",
    country: "United Kingdom",
    rail: "Faster Payments & BACS",
  },
  USD: {
    bankName: "Rhemito Virtual Bank US (Chase Rail)",
    accountNumber: "983410294",
    routingLabel: "Routing (ABA)",
    routingCode: "021000021",
    country: "United States",
    rail: "ACH & Fedwire",
  },
  EUR: {
    bankName: "Rhemito Virtual Bank EU (SEPA Partner)",
    accountNumber: "39201948",
    routingLabel: "BIC / SWIFT",
    routingCode: "BARCGB22",
    iban: "FR7630006000011234567890189",
    bic: "BARCFR22",
    country: "Eurozone",
    rail: "SEPA Instant",
  },
  NGN: {
    bankName: "Access Bank Nigeria (Rhemito Virtual)",
    accountNumber: "0194820194",
    routingLabel: "Bank Code",
    routingCode: "044",
    country: "Nigeria",
    rail: "NIBSS Instant Payment",
  },
};

interface FormData {
  amount: string;
  currency: string;
  senderType: "individual" | "business";
  senderFirstName: string;
  senderMiddleName: string;
  senderLastName: string;
  senderBusinessName: string;
  senderEmail: string;
  countryCode: string;
  senderPhone: string;
  reason: string;
}

const initialFormData: FormData = {
  amount: "",
  currency: "GBP",
  senderType: "individual",
  senderFirstName: "",
  senderMiddleName: "",
  senderLastName: "",
  senderBusinessName: "",
  senderEmail: "",
  countryCode: "+44",
  senderPhone: "",
  reason: "",
};

export default function ShowQRCode() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const requesterName = useMemo(() => {
    if (!user) return "John Doe";
    if (user.accountType === "business" && user.businessName) {
      return user.businessName;
    }
    const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
    return fullName || "John Doe";
  }, [user]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [senderSearch, setSenderSearch] = useState("");
  const [showSenderSuggestions, setShowSenderSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Single-use payment link token
  const paymentToken = useMemo(() => `qr_${Math.random().toString(36).substring(2, 9)}`, [isSuccess]);
  const paymentRef = useMemo(() => `RHM-${Math.floor(100000 + Math.random() * 900000)}`, [isSuccess]);

  const virtualAccount = VIRTUAL_ACCOUNTS[formData.currency] || VIRTUAL_ACCOUNTS.GBP;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const senderEmail = params.get("sender");
    if (senderEmail) {
      const sender = knownSenders.find(s => s.email === senderEmail);
      if (sender) {
        setFormData(prev => ({
          ...prev,
          senderType: sender.senderType,
          senderFirstName: sender.firstName,
          senderMiddleName: sender.middleName,
          senderLastName: sender.lastName,
          senderBusinessName: sender.businessName,
          senderEmail: sender.email,
          countryCode: sender.countryCode,
          senderPhone: sender.phone,
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
      senderType: sender.senderType,
      senderFirstName: sender.firstName,
      senderMiddleName: sender.middleName,
      senderLastName: sender.lastName,
      senderBusinessName: sender.businessName,
      senderEmail: sender.email,
      countryCode: sender.countryCode,
      senderPhone: sender.phone,
    }));
    setSenderSearch("");
    setShowSenderSuggestions(false);
  };

  const paymentLink = `rhemito.com/pay/${paymentToken}`;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${paymentLink}`);
    setCopied(true);
    toast({
      title: "Payment Link Copied",
      description: "Link has been copied to your clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendQR = () => {
    setIsSuccess(true);
  };

  const parsedAmount = parseFloat(formData.amount) || 0;
  const platformFee = parsedAmount * 0.03;
  const clientPays = parsedAmount * 1.03;
  const sym = CURRENCY_SYMBOLS[formData.currency] || "£";

  // Amount is strictly mandatory
  const isAmountValid = !!formData.amount && parsedAmount > 0;
  const isSenderValid = !!formData.senderEmail && (formData.senderType === "individual" ? !!formData.senderFirstName : !!formData.senderBusinessName);
  const canSubmit = isAmountValid && isSenderValid;

  if (isSuccess) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto mt-6 mb-12 space-y-6"
        >
          <Card className="text-center shadow-lg border-border bg-white overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-purple-500/10 via-primary/5 to-slate-50 border-b border-border/60 pb-6 pt-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.15 }}
                className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md"
              >
                <CheckCircle2 className="w-9 h-9 text-white" />
              </motion.div>

              <h2 className="text-2xl font-bold font-display text-slate-900">QR Code & Payment Details Ready!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The scannable QR code and virtual account details have been emailed to{" "}
                <span className="font-semibold text-foreground">{formData.senderEmail}</span> for{" "}
                <span className="font-semibold text-foreground">
                  {formData.senderType === "business" 
                    ? formData.senderBusinessName 
                    : [formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}
                </span>.
              </p>
            </CardHeader>

            <CardContent className="pt-6 pb-6 space-y-6">
              {/* QR Code Presentation Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-slate-50/80 p-5 rounded-2xl border border-slate-200 text-left">
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-3">
                  {/* Dynamic Scalable Vector QR Code */}
                  <div className="relative p-2 bg-white rounded-lg border-2 border-purple-200">
                    <svg
                      viewBox="0 0 160 160"
                      className="w-40 h-40"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Corner Position Detection Patterns */}
                      <rect x="10" y="10" width="40" height="40" rx="6" fill="#6B21A8" />
                      <rect x="18" y="18" width="24" height="24" rx="3" fill="white" />
                      <rect x="24" y="24" width="12" height="12" rx="2" fill="#6B21A8" />

                      <rect x="110" y="10" width="40" height="40" rx="6" fill="#6B21A8" />
                      <rect x="118" y="18" width="24" height="24" rx="3" fill="white" />
                      <rect x="124" y="24" width="12" height="12" rx="2" fill="#6B21A8" />

                      <rect x="10" y="110" width="40" height="40" rx="6" fill="#6B21A8" />
                      <rect x="18" y="118" width="24" height="24" rx="3" fill="white" />
                      <rect x="24" y="124" width="12" height="12" rx="2" fill="#6B21A8" />

                      {/* Mock Data Matrix Dots */}
                      <rect x="60" y="15" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="75" y="15" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="90" y="20" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="60" y="30" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="80" y="35" width="8" height="8" rx="1.5" fill="#1E293B" />
                      
                      <rect x="15" y="60" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="30" y="65" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="45" y="60" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="60" y="60" width="10" height="10" rx="2" fill="#6B21A8" />
                      <rect x="80" y="60" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="95" y="65" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="110" y="60" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="125" y="60" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="140" y="65" width="8" height="8" rx="1.5" fill="#1E293B" />

                      <rect x="20" y="80" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="35" y="85" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="55" y="80" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="70" y="80" width="10" height="10" rx="2" fill="#1E293B" />
                      <rect x="90" y="85" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="110" y="80" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="130" y="85" width="8" height="8" rx="1.5" fill="#1E293B" />

                      <rect x="60" y="110" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="75" y="115" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="95" y="110" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="110" y="110" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="125" y="115" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="140" y="125" width="8" height="8" rx="1.5" fill="#1E293B" />
                      
                      <rect x="60" y="135" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="80" y="130" width="8" height="8" rx="1.5" fill="#1E293B" />
                      <rect x="100" y="135" width="8" height="8" rx="1.5" fill="#6B21A8" />
                      <rect x="120" y="135" width="8" height="8" rx="1.5" fill="#1E293B" />

                      {/* Center Brand Badge */}
                      <circle cx="80" cy="80" r="14" fill="#6B21A8" />
                      <circle cx="80" cy="80" r="11" fill="white" />
                      <text x="80" y="84" textAnchor="middle" fill="#6B21A8" fontSize="10" fontWeight="bold" fontFamily="sans-serif">R</text>
                    </svg>
                  </div>

                  <div className="text-center space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Scan with Phone Camera</p>
                    <p className="text-[11px] text-muted-foreground">National & International Instant Pay</p>
                  </div>
                </div>

                {/* Virtual Account Data Card */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Virtual Account Details
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 ml-auto">
                      {virtualAccount.rail}
                    </Badge>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Beneficiary Name:</span>
                      <span className="font-semibold text-slate-800">{requesterName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Virtual Bank:</span>
                      <span className="font-medium text-slate-800">{virtualAccount.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {virtualAccount.iban ? "IBAN:" : "Account Number:"}
                      </span>
                      <span className="font-mono font-semibold text-slate-900">
                        {virtualAccount.iban || virtualAccount.accountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{virtualAccount.routingLabel}:</span>
                      <span className="font-mono font-medium text-slate-800">{virtualAccount.routingCode}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-100">
                      <span className="text-muted-foreground">Payment Reference:</span>
                      <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                        {paymentRef}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs bg-purple-50/70 p-2.5 rounded-lg border border-purple-200/60 text-purple-900">
                    <span className="font-medium">Amount to Pay:</span>
                    <span className="font-bold text-sm text-purple-950">
                      {sym}{parsedAmount.toFixed(2)} {formData.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="bg-gradient-to-br from-purple-50 to-primary/5 rounded-xl p-4 space-y-3 border border-purple-200/60 text-left">
                <p className="text-xs font-medium text-slate-700">You can also share this payment link directly:</p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`https://${paymentLink}`} 
                    readOnly 
                    className="text-sm bg-white font-mono"
                    data-testid="input-payment-link"
                  />
                  <Button 
                    onClick={handleCopyLink}
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    data-testid="button-copy-link"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setLocation("/")}
                  data-testid="button-back-to-dashboard"
                >
                  Back to Dashboard
                </Button>
                <Button 
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    setFormData(initialFormData);
                    setIsSuccess(false);
                  }}
                  data-testid="button-new-qr"
                >
                  Send Another QR Code
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
          
          <h1 className="text-2xl font-bold font-display">Send QR Code</h1>
          <p className="text-muted-foreground mt-1">Generate a smart QR code encapsulating your virtual account for instant payment</p>
        </motion.div>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="font-display">Payment Details</CardTitle>
            <CardDescription>Enter the mandatory amount and sender information to generate the QR code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-gradient-to-br from-purple-50/80 to-primary/5 rounded-xl p-5 border border-purple-200/60">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-11 h-11 bg-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                      <QrCode className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Virtual Account QR Payment</p>
                      <p className="text-xs text-muted-foreground">Scannable by international & national banking apps</p>
                    </div>
                  </div>
                  
                  {/* Amount to Receive (Mandatory) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="amount" className="text-sm font-semibold text-slate-900">
                        Amount to Receive <span className="text-destructive">*</span>
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                        Mandatory
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => handleInputChange("amount", e.target.value)}
                        className="flex-1 bg-white h-11 font-medium"
                        data-testid="input-qr-amount"
                      />
                      <Select value={formData.currency} onValueChange={(value) => handleInputChange("currency", value)}>
                        <SelectTrigger className="w-28 bg-white h-11 font-semibold" data-testid="select-qr-currency">
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
                    <p className="text-xs text-muted-foreground">
                      Enter the exact amount you are requesting from the sender.
                    </p>
                  </div>
                </div>

                {/* Virtual Account Binding Preview */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-purple-600" />
                      Target Virtual Account ({formData.currency})
                    </span>
                    <span className="text-[11px] text-muted-foreground">{virtualAccount.bankName}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Beneficiary: <strong>{requesterName}</strong></span>
                    <span>Rail: <strong>{virtualAccount.rail}</strong></span>
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <Label className="text-sm font-medium">Search Existing Sender</Label>
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
                      className="pl-9 bg-purple-50/40 border-purple-200 h-10"
                      data-testid="input-sender-search"
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
                            data-testid={`suggestion-sender-${sender.email.replace(/[@.]/g, '-')}`}
                          >
                            <div className="w-10 h-10 bg-purple/10 rounded-full flex items-center justify-center">
                              {sender.senderType === "business" ? (
                                <Building2 className="w-5 h-5 text-purple-600" />
                              ) : (
                                <User className="w-5 h-5 text-purple-600" />
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
                  <p className="text-xs text-muted-foreground">Select an existing sender or enter new details below</p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <Label>Sender Type *</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => handleInputChange("senderType", "individual")}
                      className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors ${
                        formData.senderType === "individual"
                          ? "border-purple-600 bg-purple-50/50"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-sender-type-individual"
                    >
                      <User className={`w-5 h-5 ${formData.senderType === "individual" ? "text-purple-600" : "text-muted-foreground"}`} />
                      <span className={`font-medium text-sm ${formData.senderType === "individual" ? "text-purple-900 font-semibold" : ""}`}>Individual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange("senderType", "business")}
                      className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors ${
                        formData.senderType === "business"
                          ? "border-purple-600 bg-purple-50/50"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-sender-type-business"
                    >
                      <Building2 className={`w-5 h-5 ${formData.senderType === "business" ? "text-purple-600" : "text-muted-foreground"}`} />
                      <span className={`font-medium text-sm ${formData.senderType === "business" ? "text-purple-900 font-semibold" : ""}`}>Business</span>
                    </button>
                  </div>
                </div>

                {formData.senderType === "individual" ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="senderFirstName">First Name *</Label>
                      <Input
                        id="senderFirstName"
                        placeholder="First name"
                        value={formData.senderFirstName}
                        onChange={(e) => handleInputChange("senderFirstName", e.target.value)}
                        data-testid="input-sender-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderMiddleName">Middle Name</Label>
                      <Input
                        id="senderMiddleName"
                        placeholder="Middle name"
                        value={formData.senderMiddleName}
                        onChange={(e) => handleInputChange("senderMiddleName", e.target.value)}
                        data-testid="input-sender-middle-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderLastName">Last Name</Label>
                      <Input
                        id="senderLastName"
                        placeholder="Last name"
                        value={formData.senderLastName}
                        onChange={(e) => handleInputChange("senderLastName", e.target.value)}
                        data-testid="input-sender-last-name"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="senderBusinessName">Business Name *</Label>
                    <Input
                      id="senderBusinessName"
                      placeholder="Enter business name"
                      value={formData.senderBusinessName}
                      onChange={(e) => handleInputChange("senderBusinessName", e.target.value)}
                      data-testid="input-sender-business-name"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="senderEmail">Sender Email *</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    placeholder="Where to email the QR code"
                    value={formData.senderEmail}
                    onChange={(e) => handleInputChange("senderEmail", e.target.value)}
                    data-testid="input-sender-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senderPhone">Sender Phone (Optional)</Label>
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
                      id="senderPhone"
                      type="tel"
                      placeholder="Mobile number"
                      value={formData.senderPhone}
                      onChange={(e) => handleInputChange("senderPhone", e.target.value)}
                      className="flex-1"
                      data-testid="input-sender-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Payment (Optional)</Label>
                  <Select
                    value={formData.reason}
                    onValueChange={(value) => handleInputChange("reason", value)}
                  >
                    <SelectTrigger id="reason" data-testid="select-reason">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="family_support">Family Support</SelectItem>
                      <SelectItem value="education_fees">Education Fees</SelectItem>
                      <SelectItem value="medical_expenses">Medical Expenses</SelectItem>
                      <SelectItem value="rent_payment">Rent Payment</SelectItem>
                      <SelectItem value="business_payment">Business Payment</SelectItem>
                      <SelectItem value="gift">Gift</SelectItem>
                      <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                      <SelectItem value="travel_expenses">Travel Expenses</SelectItem>
                      <SelectItem value="invoice_payment">Invoice Payment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
                    onClick={handleSendQR}
                    disabled={!canSubmit}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                    data-testid="button-send-qr"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate & Send QR
                  </Button>
                </div>
              </div>

              {/* Right Column: Amount & Fee Summary */}
              <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-24">
                <div className="border-2 border-purple-200/80 rounded-xl p-5 space-y-4 bg-white shadow-sm" data-testid="fee-breakdown">
                  <h3 className="font-semibold text-lg text-slate-900">Amount Summary</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">You Request:</span>
                      <span className="font-bold text-slate-800">
                        {isAmountValid ? `${sym}${parsedAmount.toFixed(2)} ${formData.currency}` : `0.00 ${formData.currency}`}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fee (3%):</span>
                      <span className="font-medium text-slate-700">
                        {isAmountValid ? `${sym}${platformFee.toFixed(2)} ${formData.currency}` : `0.00 ${formData.currency}`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-px bg-border" />
                  
                  <div className="flex justify-between pt-1 items-baseline">
                    <span className="font-medium text-slate-800">Sender Pays:</span>
                    <span className="font-bold text-lg text-teal">
                      {isAmountValid ? `${sym}${clientPays.toFixed(2)} ${formData.currency}` : `0.00 ${formData.currency}`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between bg-purple-50 -mx-5 px-5 py-3.5 -mb-5 rounded-b-xl border-t border-purple-200/60">
                    <span className="font-medium text-purple-950">You Receive:</span>
                    <span className="font-bold text-lg text-purple-700">
                      {isAmountValid ? `${sym}${parsedAmount.toFixed(2)} ${formData.currency}` : `0.00 ${formData.currency}`}
                    </span>
                  </div>
                </div>

                {!isAmountValid && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Please enter a valid request amount to generate the QR code.</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
