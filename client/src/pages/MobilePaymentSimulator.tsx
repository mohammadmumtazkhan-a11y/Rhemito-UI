import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Check, CreditCard, Building2, Wallet, Gift,
    ChevronRight, X, Smartphone, Battery, Wifi, Signal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Mock Data
const EXCHANGE_RATE = 2025.50;
const MOCK_TRANSACTION = {
    recipientName: "Akshita Gupta",
    recipientBank: "Access Bank",
    sendAmount: 500,
    sendCurrency: "GBP",
    receiveCurrency: "NGN",
    fee: 5.00,
};

// Simulated Promo Codes
const PROMO_CODES: Record<string, number> = {
    "WELCOME10": 10,
    "SAVE20": 20,
    "BONUS5": 5,
};

export default function MobilePaymentSimulator() {
    // Promo State
    const [promoCode, setPromoCode] = useState("");
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [promoApplied, setPromoApplied] = useState(false);

    // Bonus State
    const [bonusBalance] = useState(5.00); // Simulated referral bonus
    const [bonusMode, setBonusMode] = useState<"pay_less" | "send_more" | null>(null);

    // Payment State
    const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // Calculations
    const baseAmount = MOCK_TRANSACTION.sendAmount;
    const fee = MOCK_TRANSACTION.fee;
    const bonusAmount = bonusMode ? bonusBalance : 0;

    // Final calculations based on bonus mode
    const finalPayGBP = bonusMode === "pay_less"
        ? Math.max(0, baseAmount + fee - promoDiscount - bonusAmount)
        : Math.max(0, baseAmount + fee - promoDiscount);

    const finalReceiveNGN = bonusMode === "send_more"
        ? (baseAmount * EXCHANGE_RATE) + (bonusAmount * EXCHANGE_RATE)
        : baseAmount * EXCHANGE_RATE;

    // Handlers
    const handleApplyPromo = () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) {
            setPromoMessage({ type: "error", text: "Please enter a promo code" });
            return;
        }

        const discount = PROMO_CODES[code];
        if (discount) {
            setPromoDiscount(discount);
            setPromoApplied(true);
            setPromoMessage({ type: "success", text: `£${discount} discount applied!` });
        } else {
            setPromoMessage({ type: "error", text: "Invalid promo code" });
            setPromoDiscount(0);
            setPromoApplied(false);
        }
    };

    const toggleBonusMode = (mode: "pay_less" | "send_more") => {
        setBonusMode(bonusMode === mode ? null : mode);
    };

    const handlePayment = () => {
        setShowSuccess(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 flex items-center justify-center p-4 md:p-8">
            {/* Android Phone Frame */}
            <div className="relative w-full max-w-[380px]">
                {/* Phone Body */}
                <div className="bg-slate-900 rounded-[40px] p-3 shadow-2xl">
                    {/* Screen */}
                    <div className="bg-white rounded-[32px] overflow-hidden min-h-[750px] relative">

                        {/* Android Status Bar */}
                        <div className="bg-primary h-7 flex items-center justify-between px-5 text-white text-[11px] font-medium">
                            <span>12:30</span>
                            <div className="flex items-center gap-1.5">
                                <Signal className="w-3.5 h-3.5" />
                                <Wifi className="w-3.5 h-3.5" />
                                <Battery className="w-4 h-3.5" />
                            </div>
                        </div>

                        {/* App Header */}
                        <div className="bg-primary px-4 pb-4 pt-2">
                            <div className="flex items-center gap-3">
                                <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <ArrowLeft className="w-4 h-4 text-white" />
                                </button>
                                <h1 className="text-lg font-bold text-white">Payment</h1>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4 overflow-y-auto pb-24" style={{ maxHeight: 'calc(750px - 120px - 80px)' }}>

                            {/* Transaction Summary Card */}
                            <div className="bg-gradient-to-r from-primary/5 to-teal/5 rounded-2xl p-4 border border-primary/10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-muted-foreground">Sending to</span>
                                    <span className="text-sm font-semibold text-foreground">{MOCK_TRANSACTION.recipientName}</span>
                                </div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-muted-foreground">Amount</span>
                                    <span className="text-lg font-bold text-primary">£{baseAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">They receive</span>
                                    <span className="text-lg font-bold text-teal">₦{finalReceiveNGN.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Promo Code Section */}
                            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
                                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <Gift className="w-4 h-4 text-purple" />
                                    Promo Code
                                </h3>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter code"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value)}
                                        className="flex-1 h-10"
                                        disabled={promoApplied}
                                    />
                                    <Button
                                        onClick={handleApplyPromo}
                                        variant={promoApplied ? "secondary" : "default"}
                                        className="h-10 px-4"
                                        disabled={promoApplied}
                                    >
                                        {promoApplied ? <Check className="w-4 h-4" /> : "Apply"}
                                    </Button>
                                </div>
                                {promoMessage && (
                                    <p className={`text-xs mt-2 ${promoMessage.type === "success" ? "text-teal" : "text-destructive"}`}>
                                        {promoMessage.text}
                                    </p>
                                )}
                            </div>

                            {/* Referral Bonus Section */}
                            <div className="bg-gradient-to-br from-teal/10 to-teal/5 rounded-2xl border border-teal/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center">
                                        <Gift className="w-4 h-4 text-teal" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Referral Bonus</h3>
                                        <p className="text-xs text-muted-foreground">You have £{bonusBalance.toFixed(2)} available</p>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground mb-3">How would you like to use your bonus?</p>

                                <div className="grid grid-cols-2 gap-2">
                                    {/* Pay Less Option */}
                                    <button
                                        onClick={() => toggleBonusMode("pay_less")}
                                        className={`p-3 rounded-xl border-2 transition-all text-left ${bonusMode === "pay_less"
                                            ? "border-teal bg-teal/10"
                                            : "border-transparent bg-white/70 hover:border-teal/30"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${bonusMode === "pay_less" ? "border-teal" : "border-muted-foreground/30"
                                                }`}>
                                                {bonusMode === "pay_less" && <div className="w-2 h-2 rounded-full bg-teal" />}
                                            </div>
                                            <span className="text-sm font-semibold text-foreground">Pay Less</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground ml-6">Save £{bonusBalance.toFixed(2)} now</p>
                                    </button>

                                    {/* Send More Option */}
                                    <button
                                        onClick={() => toggleBonusMode("send_more")}
                                        className={`p-3 rounded-xl border-2 transition-all text-left ${bonusMode === "send_more"
                                            ? "border-teal bg-teal/10"
                                            : "border-transparent bg-white/70 hover:border-teal/30"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${bonusMode === "send_more" ? "border-teal" : "border-muted-foreground/30"
                                                }`}>
                                                {bonusMode === "send_more" && <div className="w-2 h-2 rounded-full bg-teal" />}
                                            </div>
                                            <span className="text-sm font-semibold text-foreground">Send More</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground ml-6">+₦{(bonusBalance * EXCHANGE_RATE).toLocaleString()}</p>
                                    </button>
                                </div>
                            </div>

                            {/* Payment Summary */}
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Amount</span>
                                    <span className="text-foreground">£{baseAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Fee</span>
                                    <span className="text-foreground">£{fee.toFixed(2)}</span>
                                </div>
                                {promoDiscount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-teal">Promo Discount</span>
                                        <span className="text-teal">-£{promoDiscount.toFixed(2)}</span>
                                    </div>
                                )}
                                {bonusMode === "pay_less" && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-teal">Bonus Discount</span>
                                        <span className="text-teal">-£{bonusAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="border-t border-border pt-2 mt-2">
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-foreground">Total to Pay</span>
                                        <span className="font-bold text-lg text-primary">£{finalPayGBP.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-foreground">Select Payment Method</h3>

                                {[
                                    { id: "bank", icon: Building2, title: "Pay by Bank", subtitle: "Instant transfer" },
                                    { id: "card", icon: CreditCard, title: "Card Payment", subtitle: "Credit/Debit card" },
                                    { id: "wallet", icon: Wallet, title: "Wallet Balance", subtitle: "Available: £300.20" },
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        onClick={() => setSelectedPayment(method.id)}
                                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${selectedPayment === method.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border bg-white hover:border-primary/30"
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedPayment === method.id ? "bg-primary text-white" : "bg-slate-100 text-muted-foreground"
                                            }`}>
                                            <method.icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium text-foreground">{method.title}</p>
                                            <p className="text-xs text-muted-foreground">{method.subtitle}</p>
                                        </div>
                                        <ChevronRight className={`w-5 h-5 ${selectedPayment === method.id ? "text-primary" : "text-muted-foreground/50"
                                            }`} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sticky Pay Button */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-border">
                            <Button
                                onClick={handlePayment}
                                disabled={!selectedPayment}
                                className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90"
                            >
                                Pay £{finalPayGBP.toFixed(2)}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Phone Side Buttons */}
                <div className="absolute right-0 top-28 w-1 h-16 bg-slate-700 rounded-l-sm" />
                <div className="absolute left-0 top-24 w-1 h-8 bg-slate-700 rounded-r-sm" />
                <div className="absolute left-0 top-36 w-1 h-14 bg-slate-700 rounded-r-sm" />
            </div>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                        >
                            <button
                                onClick={() => setShowSuccess(false)}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full bg-teal/20 flex items-center justify-center mb-4">
                                    <Check className="w-8 h-8 text-teal" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">Payment Successful!</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    {promoApplied && bonusMode
                                        ? "Promo code and referral bonus have been applied."
                                        : promoApplied
                                            ? "Promo code discount applied to your transaction."
                                            : bonusMode
                                                ? `Referral bonus applied (${bonusMode === "pay_less" ? "Pay Less" : "Send More"}).`
                                                : "Your transaction has been processed successfully."
                                    }
                                </p>
                                <Button
                                    onClick={() => setShowSuccess(false)}
                                    className="w-full bg-teal hover:bg-teal/90"
                                >
                                    Done
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
