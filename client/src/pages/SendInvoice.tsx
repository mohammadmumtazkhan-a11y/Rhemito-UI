import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, FileText, X, Check, Copy, CheckCircle2, Send, Search, User, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { knownSenders, type KnownSender } from "@/data/knownSenders";

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

interface FormData {
  invoiceFile: File | null;
  invoiceAmount: string;
  currency: string;
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

  const handleInputChange = (field: keyof FormData, value: string) => {
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

  const canSubmit = formData.invoiceFile && formData.invoiceAmount && formData.recipientFirstName && formData.recipientEmail;

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
                <p className="text-muted-foreground">
                  Successfully sent to <span className="font-medium text-foreground">{[formData.recipientFirstName, formData.recipientMiddleName, formData.recipientLastName].filter(Boolean).join(" ")}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Share this invoice link:</p>
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
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
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
                        <p className="font-medium">{formData.invoiceFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(formData.invoiceFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFileChange(null)}
                        data-testid="button-remove-file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium mb-1">Drag and drop your invoice here</p>
                      <p className="text-sm text-muted-foreground mb-4">PDF, PNG, or JPG up to 10MB</p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-browse-files"
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
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                        formData.recipientType === "individual"
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
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                        formData.recipientType === "business"
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

              <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-6">
                <div className="border-2 border-primary/20 rounded-xl p-5 space-y-4 bg-white" data-testid="fee-breakdown">
                  <h3 className="font-semibold text-lg">Amount</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Invoice Amount</span>
                      <span className="font-medium">
                        {formData.invoiceAmount && parseFloat(formData.invoiceAmount) > 0
                          ? `${CURRENCY_SYMBOLS[formData.currency]}${parseFloat(formData.invoiceAmount).toFixed(2)} ${formData.currency}`
                          : `0.00 ${formData.currency}`}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee (3%)</span>
                      <span className="font-medium">
                        {formData.invoiceAmount && parseFloat(formData.invoiceAmount) > 0
                          ? `${CURRENCY_SYMBOLS[formData.currency]}${(parseFloat(formData.invoiceAmount) * 0.03).toFixed(2)} ${formData.currency}`
                          : `0.00 ${formData.currency}`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-px bg-border" />
                  
                  <div className="flex justify-between pt-1">
                    <span className="font-medium">Client Pays</span>
                    <span className="font-bold text-lg text-teal">
                      {formData.invoiceAmount && parseFloat(formData.invoiceAmount) > 0
                        ? `${CURRENCY_SYMBOLS[formData.currency]}${(parseFloat(formData.invoiceAmount) * 1.03).toFixed(2)} ${formData.currency}`
                        : `0.00 ${formData.currency}`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between bg-primary/5 -mx-5 px-5 py-3 -mb-5 rounded-b-xl border-t border-primary/10">
                    <span className="font-medium">You Receive</span>
                    <span className="font-bold text-lg text-primary">
                      {formData.invoiceAmount && parseFloat(formData.invoiceAmount) > 0
                        ? `${CURRENCY_SYMBOLS[formData.currency]}${parseFloat(formData.invoiceAmount).toFixed(2)} ${formData.currency}`
                        : `0.00 ${formData.currency}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
