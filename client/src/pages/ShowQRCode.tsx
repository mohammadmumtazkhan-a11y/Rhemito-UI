import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, CheckCircle2, QrCode } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
];

interface FormData {
  amount: string;
  currency: string;
  senderFirstName: string;
  senderMiddleName: string;
  senderLastName: string;
  senderEmail: string;
  countryCode: string;
  senderPhone: string;
  reason: string;
}

const initialFormData: FormData = {
  amount: "",
  currency: "GBP",
  senderFirstName: "",
  senderMiddleName: "",
  senderLastName: "",
  senderEmail: "",
  countryCode: "+44",
  senderPhone: "",
  reason: "",
};

export default function ShowQRCode() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const paymentLink = `rhemito.com/pay/qr${Math.random().toString(36).substring(2, 8)}`;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${paymentLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendQR = () => {
    setIsSuccess(true);
  };

  const canSubmit = formData.senderFirstName && formData.senderEmail;

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
                className="w-20 h-20 bg-purple rounded-full flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-display">QR Code Sent!</h2>
                <p className="text-muted-foreground">
                  Successfully sent to <span className="font-medium text-foreground">{[formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}</span>
                </p>
                {formData.amount && (
                  <p className="text-lg font-semibold text-purple">
                    {CURRENCY_SYMBOLS[formData.currency]}{parseFloat(formData.amount).toFixed(2)} {formData.currency}
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Share this payment link:</p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`https://${paymentLink}`} 
                    readOnly 
                    className="text-sm bg-white"
                    data-testid="input-payment-link"
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
                  className="flex-1 bg-purple hover:bg-purple/90"
                  onClick={() => {
                    setFormData(initialFormData);
                    setIsSuccess(false);
                  }}
                  data-testid="button-new-qr"
                >
                  Send Another
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
          <p className="text-muted-foreground mt-1">Send a QR code to your sender for instant payment</p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Payment Details</CardTitle>
            <CardDescription>Enter the amount and sender information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-gradient-to-br from-purple/5 to-primary/5 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center">
                      <QrCode className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">QR Code Payment</p>
                      <p className="text-sm text-muted-foreground">Sender will receive a scannable QR code</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount to Receive (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Leave empty for any amount"
                        value={formData.amount}
                        onChange={(e) => handleInputChange("amount", e.target.value)}
                        className="flex-1 bg-white"
                        data-testid="input-qr-amount"
                      />
                      <Select value={formData.currency} onValueChange={(value) => handleInputChange("currency", value)}>
                        <SelectTrigger className="w-24 bg-white" data-testid="select-qr-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="NGN">NGN</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set a specific amount or leave blank to let the sender choose
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-6">
                <div className="border-2 border-purple/20 rounded-xl p-5 space-y-4 bg-white" data-testid="fee-breakdown">
                  <h3 className="font-semibold text-lg">Amount</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">You Request</span>
                      <span className="font-medium">
                        {formData.amount && parseFloat(formData.amount) > 0
                          ? `${CURRENCY_SYMBOLS[formData.currency]}${parseFloat(formData.amount).toFixed(2)} ${formData.currency}`
                          : `0.00 ${formData.currency}`}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee (3%)</span>
                      <span className="font-medium">
                        {formData.amount && parseFloat(formData.amount) > 0
                          ? `${CURRENCY_SYMBOLS[formData.currency]}${(parseFloat(formData.amount) * 0.03).toFixed(2)} ${formData.currency}`
                          : `0.00 ${formData.currency}`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-px bg-border" />
                  
                  <div className="flex justify-between pt-1">
                    <span className="font-medium">Sender Pays</span>
                    <span className="font-bold text-lg text-teal">
                      {formData.amount && parseFloat(formData.amount) > 0
                        ? `${CURRENCY_SYMBOLS[formData.currency]}${(parseFloat(formData.amount) * 1.03).toFixed(2)} ${formData.currency}`
                        : `0.00 ${formData.currency}`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between bg-purple/10 -mx-5 px-5 py-3 -mb-5 rounded-b-xl border-t border-purple/20">
                    <span className="font-medium">You Receive</span>
                    <span className="font-bold text-lg text-purple">
                      {formData.amount && parseFloat(formData.amount) > 0
                        ? `${CURRENCY_SYMBOLS[formData.currency]}${parseFloat(formData.amount).toFixed(2)} ${formData.currency}`
                        : `0.00 ${formData.currency}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="senderEmail">Sender Email *</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  placeholder="Where to send the QR code"
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
                className="flex-1 bg-purple hover:bg-purple/90"
                data-testid="button-send-qr"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Send QR Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
