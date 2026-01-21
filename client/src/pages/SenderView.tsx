import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CreditCard, Building2, Calendar, ShieldCheck, ArrowRight, Wallet, Loader2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";

export default function SenderView() {
  const [, setLocation] = useLocation();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"method" | "card_details" | "processing_instant" | "manual_transfer" | "manual_transfer_complete">("method");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPaid || paymentStep === "manual_transfer_complete") {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setLocation("/marketing");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPaid, paymentStep, setLocation]);

  const requestDetails = {
    requesterName: "Olayinka",
    amountGBP: 100,
    amountNGN: 200000,
    reason: "Consulting services - Invoice #1234",
    date: "20 May, 2024",
    expiresIn: "2 days"
  };

  const handlePay = () => {
    setShowPaymentModal(false);
    setIsPaid(true);
    setPaymentStep("method");
  };

  const handleInstantPay = () => {
    setPaymentStep("processing_instant");
    setTimeout(() => {
      handlePay();
    }, 3000);
  };

  const PaymentMethodRow = ({
    icon: Icon,
    title,
    subtitle,
    onClick
  }: {
    icon: any,
    title: string,
    subtitle: string,
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all text-left group bg-white"
    >
      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
        <Icon className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
      </div>
      <div>
        <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </button>
  );

  if (isPaid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="text-center border-none shadow-xl shadow-slate-200/50">
            <CardContent className="pt-12 pb-10 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-teal/10 rounded-full flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-teal" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-display text-slate-800">Payment Successful</h2>
                <p className="text-slate-500">
                  You've successfully sent <span className="font-semibold text-slate-900">₦{requestDetails.amountNGN.toLocaleString()}</span> to {requestDetails.requesterName}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500 border border-slate-100">
                <p>A receipt has been sent to your email.</p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-slate-100"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={175.93}
                      strokeDashoffset={175.93 - (175.93 * countdown) / 5}
                      className="text-blue-600 transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className="absolute text-xl font-bold text-blue-600">{countdown}</span>
                </div>
                <p className="text-sm font-medium text-blue-600 animate-pulse">
                  Redirecting to exclusive offers...
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full rounded-full h-12 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center">
              <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight font-display">Rhemito</span>
          </div>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/60 overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-x-10 -translate-y-10" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <span className="text-2xl font-bold">{requestDetails.requesterName.substring(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-blue-200 text-sm font-medium mb-0.5">Payment Request from</p>
                  <h2 className="text-xl font-bold">{requestDetails.requesterName}</h2>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-blue-200 text-xs uppercase font-semibold tracking-wider opacity-80">They Receive</span>
                  <p className="text-4xl font-bold tracking-tight">₦ {requestDetails.amountNGN.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 text-blue-200/90 font-medium">
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 pt-px">You Pay</span>
                  <p className="text-lg">≈ £{requestDetails.amountGBP.toFixed(2)} GBP</p>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 backdrop-blur-sm flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-blue-200/70 tracking-wider">Rate</span>
                    <span className="text-sm font-semibold text-white">1 GBP = ₦2,000.00</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 backdrop-blur-sm flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-blue-200/70 tracking-wider">Fee</span>
                    <span className="text-sm font-semibold text-white">£0.00</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Date Requested</span>
                </div>
                <p className="font-medium text-slate-700">{requestDetails.date}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secure Payment</span>
                </div>
                <p className="font-medium text-slate-700">Protected by Rhemito</p>
              </div>
            </div>

            {requestDetails.reason && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment For</p>
                <p className="text-slate-700 font-medium leading-relaxed">{requestDetails.reason}</p>
              </div>
            )}

            <div className="space-y-4">
              <Button
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
                onClick={() => setShowPaymentModal(true)}
                data-testid="button-pay-now"
              >
                Pay Now
                <ArrowRight className="w-5 h-5 ml-2 opacity-80" />
              </Button>

              <p className="text-center text-xs text-slate-400">
                By paying, you agree to Rhemito's Terms of Service and Privacy Policy.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showPaymentModal} onOpenChange={(open) => {
        setShowPaymentModal(open);
        if (!open) setPaymentStep("method");
      }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
          <DialogHeader className="p-6 pb-2 bg-white">
            <DialogTitle className="font-display text-xl text-slate-900">

              {paymentStep === "method" && "How would you like to pay?"}
              {paymentStep === "card_details" && "Enter Card Details"}
              {paymentStep === "processing_instant" && "Connecting to Bank"}
              {paymentStep === "manual_transfer" && "Bank Transfer Details"}
              {paymentStep === "manual_transfer_complete" && "Thank You"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 pt-2">
            {paymentStep === "method" ? (
              <div className="space-y-3">
                <PaymentMethodRow
                  icon={Building2}
                  title="Instant Pay By Bank"
                  subtitle={`You pay GBP ${requestDetails.amountGBP.toFixed(2)}`}
                  onClick={handleInstantPay}
                />

                <PaymentMethodRow
                  icon={CreditCard}
                  title="Credit/Debit Card"
                  subtitle={`You pay GBP ${requestDetails.amountGBP.toFixed(2)}`}
                  onClick={() => setPaymentStep("card_details")}
                />

                <PaymentMethodRow
                  icon={Building2}
                  title="Manual Bank Transfer"
                  subtitle="Send to our local account"
                  onClick={() => setPaymentStep("manual_transfer")}
                />

                <PaymentMethodRow
                  icon={Wallet}
                  title="Wallet Balance"
                  subtitle="Available: GBP 300.20"
                  onClick={handlePay}
                />
              </div>
            ) : paymentStep === "processing_instant" ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100" />
                  <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute top-0 left-0" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-semibold text-lg text-slate-900">Processing Payment</h3>
                  <p className="text-slate-500 text-sm">Securely connecting to your bank...</p>
                </div>
              </div>
            ) : paymentStep === "manual_transfer" ? (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-blue-700 font-medium">
                    An email has been sent to your email ID <span className="font-bold">Jo***oe*@gmail.com</span> containing the Beneficiary Bank Details.
                  </p>
                  <p className="text-sm text-blue-700 font-medium">Please transfer exactly <span className="font-bold">£{requestDetails.amountGBP.toFixed(2)}</span> to the details below:</p>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                      <span className="text-sm text-slate-500">Bank Name</span>
                      <span className="font-semibold text-slate-900">Rhemito Ltd</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                      <span className="text-sm text-slate-500">Sort Code</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">12-34-56</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                      <span className="text-sm text-slate-500">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">12345678</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Reference</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 bg-blue-100 px-2 py-0.5 rounded">REF12345</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setPaymentStep("method")}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                    onClick={() => {
                      setPaymentStep("manual_transfer_complete");
                    }}
                  >
                    I have sent it
                  </Button>
                </div>
              </div>

            ) : paymentStep === "manual_transfer_complete" ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-2 px-6">
                  <h3 className="text-xl font-bold text-slate-900">Transfer Initiated</h3>
                  <p className="text-slate-500">
                    Thank you. We will verify your transfer shortly and notify you via email once completed.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-blue-600 animate-pulse">
                    Redirecting you to exclusive offers in {countdown}s...
                  </p>
                  <div className="h-1 w-24 bg-slate-100 rounded-full mx-auto overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                      style={{ width: `${(countdown / 5) * 100}%` }}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full max-w-[200px]"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentStep("method");
                  }}
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      data-testid="input-card-number"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input
                        id="expiry"
                        placeholder="MM / YY"
                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        data-testid="input-card-expiry"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVC / CVC</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        data-testid="input-card-cvv"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Cardholder Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. John Doe"
                      className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      data-testid="input-card-name"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setPaymentStep("method")}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                    onClick={handlePay}
                    data-testid="button-confirm-card-payment"
                  >
                    Pay ₦{requestDetails.amountNGN.toLocaleString()}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
