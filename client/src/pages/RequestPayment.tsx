import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  GBP: { NGN: 2000, USD: 1.27, EUR: 1.17 },
  USD: { NGN: 1575, GBP: 0.79, EUR: 0.92 },
  EUR: { NGN: 1712, GBP: 0.85, USD: 1.09 },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

interface FormData {
  receiveAmount: string;
  receiveCurrency: string;
  senderCurrency: string;
  paymentMethod: string;
  senderName: string;
  senderEmail: string;
  senderCountryCode: string;
  senderPhone: string;
  senderDob: string;
  reason: string;
}

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+1", country: "Canada", flag: "🇨🇦" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
];

const initialFormData: FormData = {
  receiveAmount: "",
  receiveCurrency: "GBP",
  senderCurrency: "NGN",
  paymentMethod: "sender_choice",
  senderName: "",
  senderEmail: "",
  senderCountryCode: "+44",
  senderPhone: "",
  senderDob: "",
  reason: "",
};

const steps = [
  { id: 1, title: "Transaction Details", description: "Set amount and method" },
  { id: 2, title: "Sender Information", description: "Who's paying you?" },
  { id: 3, title: "Review & Confirm", description: "Verify details" },
];

export default function RequestPayment() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const getExchangeRate = () => {
    const { receiveCurrency, senderCurrency } = formData;
    if (receiveCurrency === senderCurrency) return 1;
    return EXCHANGE_RATES[receiveCurrency]?.[senderCurrency] || 1;
  };

  const senderPays = formData.receiveAmount 
    ? (parseFloat(formData.receiveAmount) * getExchangeRate()).toLocaleString()
    : "0";

  const receiveSymbol = CURRENCY_SYMBOLS[formData.receiveCurrency] || "";
  const senderSymbol = CURRENCY_SYMBOLS[formData.senderCurrency] || "";

  const paymentLink = `rhemito.com/pay/ref${Math.random().toString(36).substring(2, 8)}`;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsSuccess(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${paymentLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.receiveAmount;
      case 2:
        return formData.senderName && formData.senderEmail;
      case 3:
        return true;
      default:
        return false;
    }
  };

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
                className="w-20 h-20 bg-teal rounded-full flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-display">Payment Request Sent!</h2>
                <p className="text-muted-foreground">
                  Successfully sent to <span className="font-medium text-foreground">{formData.senderName}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Share this link with your sender:</p>
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
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    setFormData(initialFormData);
                    setCurrentStep(1);
                    setIsSuccess(false);
                  }}
                  data-testid="button-new-request"
                >
                  New Request
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
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold font-display">Request Payment</h1>
          <p className="text-muted-foreground mt-1">Get paid by generating a payment link</p>
        </motion.div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: currentStep >= step.id ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: currentStep >= step.id ? "white" : "hsl(var(--muted-foreground))",
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                >
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </motion.div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${currentStep > step.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-display">{steps[currentStep - 1].title}</CardTitle>
                <CardDescription>{steps[currentStep - 1].description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentStep === 1 && (
                  <>
                    <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-6 space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="receiveAmount" className="text-sm font-medium">
                          I want to receive
                        </Label>
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">{receiveSymbol}</span>
                            <Input
                              id="receiveAmount"
                              type="number"
                              placeholder="0.00"
                              value={formData.receiveAmount}
                              onChange={(e) => handleInputChange("receiveAmount", e.target.value)}
                              className="pl-8 text-2xl font-bold h-14 bg-white"
                              data-testid="input-receive-amount"
                            />
                          </div>
                          <Select
                            value={formData.receiveCurrency}
                            onValueChange={(value) => handleInputChange("receiveCurrency", value)}
                          >
                            <SelectTrigger className="w-24 h-14 bg-white font-medium" data-testid="select-receive-currency">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GBP">GBP</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="h-px bg-border" />

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Sender pays (at 1 {formData.receiveCurrency} = {senderSymbol}{getExchangeRate().toLocaleString()})
                        </Label>
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-teal">{senderSymbol}</span>
                            <div className="pl-8 text-2xl font-bold h-14 bg-teal/10 rounded-lg flex items-center text-teal border border-teal/20">
                              {senderPays}
                            </div>
                          </div>
                          <Select
                            value={formData.senderCurrency}
                            onValueChange={(value) => handleInputChange("senderCurrency", value)}
                          >
                            <SelectTrigger className="w-24 h-14 bg-teal/10 border-teal/20 font-medium text-teal" data-testid="select-sender-currency">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NGN">NGN</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentMethod">Payment Method (Optional)</Label>
                      <Select
                        value={formData.paymentMethod}
                        onValueChange={(value) => handleInputChange("paymentMethod", value)}
                      >
                        <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                          <SelectValue placeholder="How will the sender pay?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sender_choice">Let the Sender Choose</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="card">Card Payment</SelectItem>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="senderName">Sender Name *</Label>
                        <Input
                          id="senderName"
                          placeholder="Full name of the person paying"
                          value={formData.senderName}
                          onChange={(e) => handleInputChange("senderName", e.target.value)}
                          data-testid="input-sender-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="senderEmail">Sender Email Address *</Label>
                        <Input
                          id="senderEmail"
                          type="email"
                          placeholder="We'll send the payment link here"
                          value={formData.senderEmail}
                          onChange={(e) => handleInputChange("senderEmail", e.target.value)}
                          data-testid="input-sender-email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="senderPhone">Sender Mobile Number (Optional)</Label>
                        <div className="flex gap-2">
                          <Select
                            value={formData.senderCountryCode}
                            onValueChange={(value) => handleInputChange("senderCountryCode", value)}
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
                        <Label htmlFor="senderDob">Sender Date of Birth (Optional)</Label>
                        <Input
                          id="senderDob"
                          type="date"
                          value={formData.senderDob}
                          onChange={(e) => handleInputChange("senderDob", e.target.value)}
                          data-testid="input-sender-dob"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason for Payment (Optional)</Label>
                        <Textarea
                          id="reason"
                          placeholder="e.g., Invoice #1234, Consulting services"
                          value={formData.reason}
                          onChange={(e) => handleInputChange("reason", e.target.value)}
                          rows={3}
                          data-testid="input-reason"
                        />
                      </div>
                    </div>
                  </>
                )}

                {currentStep === 3 && (
                  <>
                    <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">You Receive</p>
                          <p className="text-2xl font-bold text-primary">{receiveSymbol}{parseFloat(formData.receiveAmount || "0").toFixed(2)} {formData.receiveCurrency}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sender Pays</p>
                          <p className="text-2xl font-bold text-teal">{senderSymbol}{senderPays} {formData.senderCurrency}</p>
                        </div>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sender Name</span>
                          <span className="font-medium">{formData.senderName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sender Email</span>
                          <span className="font-medium">{formData.senderEmail}</span>
                        </div>
                        {formData.senderPhone && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sender Phone</span>
                            <span className="font-medium">{formData.senderCountryCode} {formData.senderPhone}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Payment Method</span>
                          <span className="font-medium capitalize">{formData.paymentMethod.replace("_", " ")}</span>
                        </div>
                        {formData.reason && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Reason</span>
                            <span className="font-medium">{formData.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        <strong>Important:</strong> Kindly contact your sender to ensure this request comes from you. This helps prevent fraud and keeps your transactions secure.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="flex-1"
                    data-testid="button-step-back"
                  >
                    {currentStep === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button 
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    data-testid="button-step-next"
                  >
                    {currentStep === 3 ? "Send Request" : "Continue"}
                    {currentStep < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
