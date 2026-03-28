import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Check, ChevronRight, User, Building2,
    CreditCard, Wallet, Landmark, Smartphone, Banknote, Shield,
    ChevronDown, ArrowRightLeft, BarChart3, Search, UserPlus, X,
    Copy, Loader2, Clock, Mail, AlertTriangle
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

// Mock Data
const EXCHANGE_RATE = 2025.50; // 1 GBP = 2025.50 NGN
const FEE_PERCENTAGE = 0.01; // 1%

const recentRecipients = [
    { id: 1, name: "Akshita Gupta", bank: "UK Bank", account: "12345678", initials: "AG", color: "bg-blue-100 text-blue-600" },
    { id: 2, name: "Sarah Chen", bank: "Access Bank", account: "87654321", initials: "SC", color: "bg-purple-100 text-purple-600" },
    { id: 3, name: "David Okonkwo", bank: "GTBank", account: "11223344", initials: "DO", color: "bg-green-100 text-green-600" },
];

const steps = [
    { id: 1, title: "Amount" },
    { id: 2, title: "Recipient" },
    { id: 3, title: "Details" }, // Was "Bank" in screenshot, generalizing to Details
    { id: 4, title: "Summary" }, // Was "Summary"
    { id: 5, title: "Payment" }, // Was "Payment Method"
];

export default function SendMoney() {
    const [, setLocation] = useLocation();
    const [currentStep, setCurrentStep] = useState(1);

    // Form State
    const [amount, setAmount] = useState<string>("500");
    const [receiveAmount, setReceiveAmount] = useState<string>("");
    const [deliveryMethod, setDeliveryMethod] = useState("bank_deposit");
    const [promoCode, setPromoCode] = useState("");
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoMessage, setPromoMessage] = useState("");
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoLoading, setPromoLoading] = useState(false);

    const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
    const [recipientDetails, setRecipientDetails] = useState({
        firstName: "",
        lastName: "",
        relationship: "family",
        nickName: "",
        reason: "family_support",
        bankName: "",
        accountNumber: "",
        narration: ""
    });

    const [paymentMethod, setPaymentMethod] = useState("");
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Bank transfer modal
    const [showBankTransferModal, setShowBankTransferModal] = useState(false);
    const [bankTransferStatus, setBankTransferStatus] = useState<'details' | 'submitting' | 'submitted'>('details');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Session timer (rate lock countdown)
    const [sessionTimeLeft, setSessionTimeLeft] = useState(523); // ~8:43
    const [showExtendPopup, setShowExtendPopup] = useState(false);
    const [extendDismissed, setExtendDismissed] = useState(false);

    // Bonus State - Hardcoded for Prototype
    const [bonusBalance] = useState(5);
    const [useBonus, setUseBonus] = useState(false);
    const [bonusType, setBonusType] = useState<'pay_less' | 'send_more'>('pay_less');

    // Calculations
    const fee = parseFloat(amount || "0") * FEE_PERCENTAGE;

    // Promo Logic for SAVE20 (Amount Discount) vs Others (Fee Discount)
    const isAmountDiscount = promoCode === "SAVE20";

    // Effective fee is reduced only if it's a Standard Promo (not SAVE20). 
    // If SAVE20, fee remains full, but Total Pay is reduced by discount.
    const effectiveFee = isAmountDiscount ? fee : Math.max(0, fee - (promoApplied ? promoDiscount : 0));

    // Bonus Calculations
    const bonusAmount = useBonus ? Math.min(bonusBalance, parseFloat(amount || "0")) : 0;

    // Total Pay:
    // If Amount Discount (SAVE20), subtract promoDiscount from (Amount + Fee).
    // If Bonus "Pay Less" is active, subtract bonusAmount.
    const totalPay = isAmountDiscount
        ? (parseFloat(amount || "0") + fee) - (promoApplied ? promoDiscount : 0) - (useBonus && bonusType === 'pay_less' ? bonusAmount : 0)
        : (parseFloat(amount || "0") + effectiveFee) - (useBonus && bonusType === 'pay_less' ? bonusAmount : 0);

    // Adjusted Receive Amount for Bonus "Send More"
    const bonusReceiveParams = useBonus && bonusType === 'send_more' ? (bonusAmount * EXCHANGE_RATE) : 0;
    const finalReceiveAmount = (parseFloat(receiveAmount || "0") + bonusReceiveParams).toFixed(2);



    useEffect(() => {
        // Auto-calculate receive amount
        const val = parseFloat(amount || "0");
        setReceiveAmount((val * EXCHANGE_RATE).toFixed(2));
    }, [amount]);

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) {
            setPromoMessage("Please enter a promo code.");
            setPromoApplied(false);
            return;
        }

        setPromoLoading(true);

        // MOCK SAVE20 Logic


        try {
            const response = await fetch("/api/promocodes/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    amount: parseFloat(amount),
                    currency: "GBP",
                    userId: "user_123",
                    sourceCurrency: "GBP",
                    destCurrency: "NGN",
                    paymentMethod: paymentMethod || "bank_deposit",
                }),
            });

            const data = await response.json();
            if (response.ok) {
                setPromoApplied(true);
                setPromoDiscount(data.appliedDiscount || 0);
                setPromoMessage(data.displayText || "Promo code applied!");
            } else {
                setPromoApplied(false);
                setPromoDiscount(0);
                setPromoMessage(data.error || "Invalid promo code");
            }
        } catch (error) {
            setPromoApplied(false);
            setPromoDiscount(0);
            setPromoMessage("Failed to validate promo code");
        } finally {
            setPromoLoading(false);
        }
    };



    const handleNext = () => {
        if (currentStep < 5) setCurrentStep((prev) => prev + 1);
        else setLocation("/"); // Finish
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep((prev) => prev - 1);
        else setLocation("/");
    };

    // Format seconds to MM:SS
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return { minutes: m, seconds: s };
    };

    // Session countdown timer
    useEffect(() => {
        if (sessionTimeLeft <= 0) return;
        const interval = setInterval(() => {
            setSessionTimeLeft((prev) => {
                const next = prev - 1;
                if (next === 30 && !extendDismissed) {
                    setShowExtendPopup(true);
                }
                if (next <= 0) {
                    clearInterval(interval);
                    setLocation("/");
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [sessionTimeLeft <= 0, extendDismissed]);

    // Copy to clipboard helper
    const handleCopy = (value: string, fieldName: string) => {
        navigator.clipboard.writeText(value);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Copy all bank details
    const handleCopyAll = () => {
        const allDetails = `Transaction Reference No: 24426299\nAccount Name: Topupnigeria.com Nigeria Ltd\nBank Name: United Bank of Africa PLC (UBA)\nBank Account Number: 1018984719\nSort Code: 20-45-45`;
        navigator.clipboard.writeText(allDetails);
        setCopiedField('all');
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Handle bank transfer submission
    const handleBankTransferSubmit = async () => {
        setBankTransferStatus('submitting');
        // Simulate 2 second processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setBankTransferStatus('submitted');
    };

    const timerDisplay = formatTime(sessionTimeLeft);

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto pb-10">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Send Money</h1>
                    <div className="text-sm text-muted-foreground">step {currentStep} of 5</div>
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-between mb-8 px-4 md:px-12 relative">
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 -z-10" />
                    {steps.map((step) => (
                        <div key={step.id} className="flex flex-col items-center bg-background px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mb-2 transition-colors ${currentStep >= step.id ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                                }`}>
                                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                            </div>
                            <span className={`text-xs ${currentStep >= step.id ? "text-primary font-medium" : "text-gray-400"}`}>
                                {step.title}
                            </span>
                        </div>
                    ))}
                </div>

                <div className={currentStep === 1 || currentStep === 2 || currentStep === 3 || currentStep === 4 || currentStep === 5 ? "block w-full" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
                    {/* Main Content Area */}
                    <div className={currentStep === 1 || currentStep === 2 || currentStep === 3 || currentStep === 4 || currentStep === 5 ? "w-full space-y-6" : "lg:col-span-2 space-y-6"}>

                        {/* Step 1: Amount */}
                        {currentStep === 1 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full"
                            >
                                <div className="lg:col-span-3 space-y-8">
                                    <div className="space-y-2">
                                        <Label className="text-gray-500">You Send</Label>
                                        <div className="flex bg-white border rounded-lg overflow-hidden h-14 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                                            <div className="flex items-center gap-2 px-4 bg-gray-50 border-r min-w-[120px]">
                                                <img src="https://flagcdn.com/w40/gb.png" alt="GBP" className="w-8 h-6 object-cover rounded shadow-sm" />
                                                <span className="font-semibold text-lg">GBP</span>
                                                <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                                            </div>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                className="flex-1 px-4 text-lg font-medium outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-500">They Receive</Label>
                                        <div className="flex bg-white border rounded-lg overflow-hidden h-14 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                                            <div className="flex items-center gap-2 px-4 bg-gray-50 border-r min-w-[120px]">
                                                <img src="https://flagcdn.com/w40/ng.png" alt="NGN" className="w-8 h-6 object-cover rounded shadow-sm" />
                                                <span className="font-semibold text-lg">NGN</span>
                                                <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                                            </div>
                                            <input
                                                readOnly
                                                value={receiveAmount}
                                                className="flex-1 px-4 text-lg font-medium outline-none bg-gray-50 text-gray-500"
                                            />
                                        </div>
                                    </div>


                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg">How will they receive the money?</h3>
                                        <div className="flex flex-wrap gap-4">
                                            {[
                                                { id: "bank_deposit", label: "Bank Deposit", icon: Landmark },
                                                { id: "mobile_money", label: "Mobile Money", icon: Smartphone },
                                                { id: "cash_pickup", label: "Cash Pickup", icon: Banknote }
                                            ].map((method) => (
                                                <div
                                                    key={method.id}
                                                    onClick={() => setDeliveryMethod(method.id)}
                                                    className={`
                                                        flex items-center gap-2 px-6 py-3 rounded-full cursor-pointer transition-all font-medium
                                                        ${deliveryMethod === method.id
                                                            ? "bg-blue-50 text-blue-600 border border-blue-200 shadow-sm"
                                                            : "text-gray-500 hover:bg-gray-50 border border-transparent"}
                                                    `}
                                                >
                                                    <method.icon className={`w-5 h-5 ${deliveryMethod === method.id ? "text-blue-600" : "text-gray-400"}`} />
                                                    {method.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <div className="flex items-center justify-between py-2">
                                            <div className="flex items-center gap-3 text-gray-600">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <Wallet className="w-4 h-4" />
                                                </div>
                                                <span>Amount Sent</span>
                                            </div>
                                            <span className="font-medium">{(parseFloat(amount) - effectiveFee).toFixed(2)} GBP</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <div className="flex items-center gap-3 text-gray-600">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <BarChart3 className="w-4 h-4" />
                                                </div>
                                                <span>Fee</span>
                                            </div>
                                            <span className="font-medium">{fee.toFixed(2)} GBP</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 bg-blue-50 px-4 rounded-lg -mx-4">
                                            <div className="flex items-center gap-3 text-gray-600">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600">
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                </div>
                                                <span>Exchange Rate</span>
                                            </div>
                                            <span className="font-medium text-gray-900">1 GBP = {EXCHANGE_RATE.toFixed(2)} USD</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="flex-1 h-14 text-lg rounded-xl"
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            onClick={handleNext}
                                            className="flex-1 h-14 text-lg bg-blue-600 hover:bg-blue-700 rounded-xl"
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                </div>

                                {/* Right Column: Sticky Summary */}
                                <div className="lg:col-span-2 hidden lg:block">
                                    <div className="sticky top-6">
                                        <Card className="border border-blue-100 shadow-sm">
                                            <CardHeader className="pb-4 border-b">
                                                <CardTitle className="text-base font-bold text-gray-900">Amount</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4 text-sm pt-6">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">You Send</span>
                                                    <span className="font-medium text-gray-900">{parseFloat(amount).toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Amount Sent</span>
                                                    <span className="font-medium text-gray-900">{(parseFloat(amount) - effectiveFee).toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Fee</span>
                                                    <span className="font-medium text-gray-900">{fee.toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Exchange Rate</span>
                                                    <span className="font-medium text-gray-900">1 GBP = {EXCHANGE_RATE.toFixed(2)} USD</span>
                                                </div>

                                                <div className="pt-4 mt-4 border-t flex justify-between items-center">
                                                    <span className="text-gray-600 font-medium">They Receive</span>
                                                    <span className="font-bold text-lg text-blue-600">{receiveAmount} USD</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Recipient */}
                        {/* Step 2: Recipient */}
                        {currentStep === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full"
                            >
                                {/* Left Column: Recipient Selection */}
                                <div className="lg:col-span-3 space-y-8">
                                    <div className="space-y-6">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="gap-2 text-gray-600 hover:text-gray-900"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            Back
                                        </Button>
                                        <h2 className="text-xl font-bold text-gray-900">Who are you sending to?</h2>

                                        {/* Recent Recipients - Circles */}
                                        <div className="space-y-4">
                                            <Label className="text-gray-500 font-medium">Recent Recipients</Label>
                                            <div className="flex gap-6 overflow-x-auto pb-4">
                                                {recentRecipients.slice(0, 5).map(r => (
                                                    <div key={r.id} className="flex flex-col items-center gap-2 cursor-pointer group min-w-[80px]" onClick={() => { setSelectedRecipient(r); handleNext(); }}>
                                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${r.color} group-hover:ring-2 ring-primary ring-offset-2 transition-all`}>
                                                            {r.initials}
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-600 text-center truncate w-full">{r.name.split(' ')[0]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Search and New Recipient */}
                                        <div className="flex gap-4">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search recipient"
                                                    className="w-full h-10 pl-10 pr-4 rounded-lg border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                />
                                            </div>
                                            <Button variant="outline" className="gap-2 h-10 whitespace-nowrap bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm" onClick={() => { setSelectedRecipient(null); handleNext(); }}>
                                                <UserPlus className="w-4 h-4" />
                                                New Recipient
                                            </Button>
                                        </div>

                                        {/* All Recipients List */}
                                        <div className="space-y-1">
                                            {recentRecipients.map(r => (
                                                <div
                                                    key={r.id}
                                                    onClick={() => { setSelectedRecipient(r); handleNext(); }}
                                                    className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${r.color} relative`}>
                                                            {r.initials}
                                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-900">{r.name}</div>
                                                            <div className="text-sm text-gray-500">UK Bank</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <div className="text-blue-500 font-medium">Bank Deposit</div>
                                                        <div className="text-gray-400">12345678</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl">
                                            Show More
                                        </Button>
                                    </div>
                                </div>

                                {/* Right Column: Sticky Summary */}
                                <div className="lg:col-span-2 hidden lg:block">
                                    <div className="sticky top-6">
                                        <Card className="border border-blue-100 shadow-sm">
                                            <CardHeader className="pb-4 border-b">
                                                <div className="flex justify-between items-center">
                                                    <CardTitle className="text-base font-bold text-gray-900">Amount</CardTitle>
                                                    {/* Session Timer */}
                                                    <div className={`flex gap-1 font-mono text-sm px-2 py-1 rounded ${sessionTimeLeft <= 60 ? 'text-red-600 bg-red-50 animate-pulse' : 'text-blue-600 bg-blue-50'}`}>
                                                        <span>{timerDisplay.minutes}</span>:<span>{timerDisplay.seconds}</span>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4 text-sm pt-6">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">You Send</span>
                                                    <span className="font-medium text-gray-900">{parseFloat(amount).toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Amount Sent</span>
                                                    <span className="font-medium text-gray-900">{(parseFloat(amount) - effectiveFee).toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">They Receive</span>
                                                    <span className="font-medium text-gray-900">{receiveAmount} USD</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Transaction Fee</span>
                                                    <span className="font-medium text-gray-900">{fee.toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Exchange Rate</span>
                                                    <span className="font-medium text-gray-900">1 GBP = {EXCHANGE_RATE.toFixed(2)} USD</span>
                                                </div>
                                                <div className="flex justify-between pt-2">
                                                    <span className="text-gray-600">Collection Method</span>
                                                    <span className="font-medium text-gray-900 capitalize">{deliveryMethod.replace('_', ' ')}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Details */}
                        {currentStep === 3 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full"
                            >
                                {/* Left Column: Form Details */}
                                <div className="lg:col-span-3 space-y-8">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Recipient Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>First Name</Label>
                                                    <Input
                                                        defaultValue={selectedRecipient?.name?.split(' ')[0] || ""}
                                                        onChange={e => setRecipientDetails({ ...recipientDetails, firstName: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Last Name</Label>
                                                    <Input
                                                        defaultValue={selectedRecipient?.name?.split(' ')[1] || ""}
                                                        onChange={e => setRecipientDetails({ ...recipientDetails, lastName: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Relationship</Label>
                                                    <Select defaultValue="family">
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="family">Family</SelectItem>
                                                            <SelectItem value="friend">Friend</SelectItem>
                                                            <SelectItem value="business">Business Service</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Nickname (Optional)</Label>
                                                    <Input placeholder="e.g. My Brother" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Reason for transfer</Label>
                                                <Select defaultValue="family_support">
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="family_support">Family Support</SelectItem>
                                                        <SelectItem value="education">Education</SelectItem>
                                                        <SelectItem value="bills">Bills</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Narration <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                                                <Textarea
                                                    placeholder="e.g. Monthly allowance for February"
                                                    value={recipientDetails.narration}
                                                    onChange={e => setRecipientDetails({ ...recipientDetails, narration: e.target.value })}
                                                    className="resize-none"
                                                    rows={3}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="pt-4 flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="flex-1 h-14 text-lg rounded-xl"
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            onClick={handleNext}
                                            className="flex-1 h-14 text-lg bg-blue-600 hover:bg-blue-700 rounded-xl"
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                </div>

                                {/* Right Column: Sticky Summary */}
                                <div className="lg:col-span-2 hidden lg:block">
                                    <div className="sticky top-6">
                                        <Card className="border border-blue-100 shadow-sm">
                                            <CardHeader className="pb-4 border-b">
                                                <div className="flex justify-between items-center">
                                                    <CardTitle className="text-base font-bold text-gray-900">Amount</CardTitle>
                                                    {/* Session Timer */}
                                                    <div className={`flex gap-1 font-mono text-sm px-2 py-1 rounded ${sessionTimeLeft <= 60 ? 'text-red-600 bg-red-50 animate-pulse' : 'text-blue-600 bg-blue-50'}`}>
                                                        <span>{timerDisplay.minutes}</span>:<span>{timerDisplay.seconds}</span>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4 text-sm pt-6">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">You Send</span>
                                                    <span className="font-medium text-gray-900">{parseFloat(amount).toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Fees</span>
                                                    <span className="font-medium text-gray-900">{fee.toFixed(2)} GBP</span>
                                                </div>
                                                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                                                    <span className="text-gray-900 font-bold text-base">Total to Pay</span>
                                                    <span className="font-bold text-lg text-gray-900">{(parseFloat(amount) + effectiveFee).toFixed(2)} GBP</span>
                                                </div>

                                                <div className="pt-4 mt-2 bg-blue-50/50 -mx-6 px-6 py-4 mb-[-24px]">
                                                    <div className="text-sm text-gray-600 mb-1">They Receive</div>
                                                    <div className="text-xl font-bold text-blue-600">{receiveAmount} NGN</div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4: Summary */}
                        {currentStep === 4 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full pb-10">
                                    <div className="lg:col-span-3 space-y-8">
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                                            <div className="text-sm text-blue-800">
                                                Please check your transaction summary below. If you are ok with all the details, click the "Continue" button to complete your transaction. If you would like to make changes to your transaction, click the "Back" button.
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Amount Section */}
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-lg text-gray-900 border-b pb-2">Amount</h3>
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">You Send</span>
                                                        <span className="font-medium">{parseFloat(amount).toFixed(2)} GBP</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Amount Sent</span>
                                                        <span className="font-medium">{(parseFloat(amount) - effectiveFee).toFixed(2)} GBP</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">They Receive</span>
                                                        <span className="font-medium">{receiveAmount} NGN</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Rate</span>
                                                        <span className="font-medium">1 GBP = {EXCHANGE_RATE} NGN</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Transaction Fee</span>
                                                        <span className="font-medium">{effectiveFee.toFixed(2)} GBP</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Recipient Section */}
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-lg text-gray-900 border-b pb-2">Recipient</h3>
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Service Type</span>
                                                        <span className="font-medium capitalize">{deliveryMethod.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Recipient Type</span>
                                                        <span className="font-medium">Individual</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Country</span>
                                                        <span className="font-medium">UK</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Currency</span>
                                                        <span className="font-medium">GBP</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Full Name</span>
                                                        <span className="font-medium">
                                                            {selectedRecipient ? selectedRecipient.name : `${recipientDetails.firstName} ${recipientDetails.lastName}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Routing/Sort Code</span>
                                                        <span className="font-medium">606004</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Bank Account Number</span>
                                                        <span className="font-medium italic">
                                                            {selectedRecipient ? selectedRecipient.account : "12345678"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Narration</span>
                                                        <span className="font-medium">{recipientDetails.narration || "—"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Total Section */}
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-lg text-gray-900 border-b pb-2">Total</h3>
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Due</span>
                                                        <span className="font-medium">{(parseFloat(amount) + effectiveFee).toFixed(2)} GBP</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">They Receive</span>
                                                        <span className="font-medium">{receiveAmount} NGN</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-orange-800 text-sm">
                                            By clicking the Continue button you're submitting this transaction, you also agree and accept Rhemito's Terms of Use and Privacy Policy. Kindly proceed by selecting how you'd like to pay us.
                                        </div>
                                        <div className="pt-4 flex gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={handleBack}
                                                className="flex-1 h-14 text-lg rounded-xl"
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                onClick={handleNext}
                                                className="flex-1 h-14 text-lg bg-blue-600 hover:bg-blue-700 rounded-xl"
                                            >
                                                Continue
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Right Column: Sticky Summary */}
                                    <div className="lg:col-span-2 hidden lg:block">
                                        <div className="sticky top-6">
                                            <Card className="border border-blue-100 shadow-sm">
                                                <CardHeader className="pb-4 border-b">
                                                    <div className="flex justify-between items-center">
                                                        <CardTitle className="text-base font-bold text-gray-900">Amount</CardTitle>
                                                        <div className={`flex gap-1 font-mono text-sm px-2 py-1 rounded ${sessionTimeLeft <= 60 ? 'text-red-600 bg-red-50 animate-pulse' : 'text-blue-600 bg-blue-50'}`}>
                                                            <span>{timerDisplay.minutes}</span>:<span>{timerDisplay.seconds}</span>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4 text-sm pt-6">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">You Send</span>
                                                        <span className="font-medium text-gray-900">{parseFloat(amount).toFixed(2)} GBP</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Fees</span>
                                                        <span className="font-medium text-gray-900">{fee.toFixed(2)} GBP</span>
                                                    </div>
                                                    <div className="border-t pt-2 mt-2 flex justify-between items-center">
                                                        <span className="text-gray-900 font-bold text-base">Total to Pay</span>
                                                        <span className="font-bold text-lg text-gray-900">{(parseFloat(amount) + effectiveFee).toFixed(2)} GBP</span>
                                                    </div>

                                                    <div className="pt-4 mt-2 bg-blue-50/50 -mx-6 px-6 py-4 mb-[-24px]">
                                                        <div className="text-sm text-gray-600 mb-1">They Receive</div>
                                                        <div className="text-xl font-bold text-blue-600">{receiveAmount} NGN</div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 5: Payment Method */}
                        {currentStep === 5 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-8 pb-24"
                            >
                                {/* Left Column: Input Sections */}
                                <div className="lg:col-span-3 space-y-6">



                                    {/* Bonus Redemption Section */}
                                    <Card className="border-green-100 bg-green-50/30">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                    <Wallet className="w-4 h-4" />
                                                </div>
                                                <CardTitle className="text-base text-green-800">Referral Bonus Available</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id="use-bonus"
                                                    checked={useBonus}
                                                    onCheckedChange={(checked) => setUseBonus(checked as boolean)}
                                                    className="mt-1 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                />
                                                <div className="space-y-1">
                                                    <Label htmlFor="use-bonus" className="text-base font-medium cursor-pointer">
                                                        Redeem your <span className="font-bold text-green-700">£{bonusBalance.toFixed(2)}</span> bonus
                                                    </Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        You have earned this from referring friends!
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pl-7 space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <p className="text-sm font-medium text-gray-700">How would you like to use it?</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div
                                                        onClick={() => { setUseBonus(true); setBonusType('pay_less'); }}
                                                        className={`
                                                            cursor-pointer border rounded-lg p-3 flex items-center gap-3 transition-all
                                                            ${useBonus && bonusType === 'pay_less' ? 'bg-green-100 border-green-300 ring-1 ring-green-300' : 'bg-white hover:bg-gray-50 border-gray-200'}
                                                        `}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${useBonus && bonusType === 'pay_less' ? 'border-green-600' : 'border-gray-400'}`}>
                                                            {useBonus && bonusType === 'pay_less' && <div className="w-2 h-2 rounded-full bg-green-600" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">Pay Less</div>
                                                            <div className="text-xs text-muted-foreground">Save £{Math.min(bonusBalance, parseFloat(amount)).toFixed(2)} now</div>
                                                        </div>
                                                    </div>

                                                    <div
                                                        onClick={() => { setUseBonus(true); setBonusType('send_more'); }}
                                                        className={`
                                                            cursor-pointer border rounded-lg p-3 flex items-center gap-3 transition-all
                                                            ${useBonus && bonusType === 'send_more' ? 'bg-green-100 border-green-300 ring-1 ring-green-300' : 'bg-white hover:bg-gray-50 border-gray-200'}
                                                        `}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${useBonus && bonusType === 'send_more' ? 'border-green-600' : 'border-gray-400'}`}>
                                                            {useBonus && bonusType === 'send_more' && <div className="w-2 h-2 rounded-full bg-green-600" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">Send More</div>
                                                            <div className="text-xs text-muted-foreground">Recipient gets +£{Math.min(bonusBalance, parseFloat(amount)).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Promo Code Section */}
                                    <Card>
                                        <CardHeader className="pb-4">
                                            <CardTitle className="text-base">Promo Code</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Label className="text-sm">Have a promo code?</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Enter code (e.g. WELCOME, SAVE20)"
                                                    value={promoCode}
                                                    onChange={(e) => {
                                                        setPromoCode(e.target.value.toUpperCase());
                                                        setPromoApplied(false);
                                                        setPromoMessage("");
                                                    }}
                                                    className="uppercase font-mono"
                                                    disabled={promoLoading}
                                                />
                                                <Button
                                                    variant="outline"
                                                    onClick={handleApplyPromo}
                                                    disabled={promoLoading || !promoCode}
                                                >
                                                    {promoLoading ? "Checking..." : "Apply"}
                                                </Button>
                                            </div>
                                            {promoMessage && (
                                                <p className={`text-xs mt-1 font-medium ${promoApplied ? "text-green-600" : "text-red-500"}`}>
                                                    {promoApplied ? "✓ " : "✗ "}{promoMessage}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Payment Method Selection */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">How would you like to pay?</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {[
                                                { id: "instant_bank", title: "Instant Pay By Bank", desc: `You pay GBP ${totalPay.toFixed(2)}`, icon: Landmark },
                                                { id: "card", title: "Credit/Debit Card", desc: `You pay GBP ${totalPay.toFixed(2)}`, icon: CreditCard },
                                                { id: "manual_transfer", title: "Manual Bank Transfer", desc: "Send to our local account", icon: Building2 },
                                                { id: "wallet", title: "Wallet Balance", desc: `Available: GBP 300.20`, icon: Wallet },
                                            ].map((method) => (
                                                <div
                                                    key={method.id}
                                                    onClick={() => setPaymentMethod(method.id)}
                                                    className={`p-4 border rounded-xl cursor-pointer flex items-center gap-4 transition-all ${paymentMethod === method.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-gray-300"
                                                        }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white border ${paymentMethod === method.id ? "text-primary border-primary" : "text-gray-500 border-gray-200"
                                                        }`}>
                                                        <method.icon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{method.title}</div>
                                                        <div className="text-xs text-muted-foreground">{method.desc}</div>
                                                    </div>
                                                    {paymentMethod === method.id && <div className="ml-auto text-primary"><Check className="w-5 h-5" /></div>}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    <div className="mt-6 flex items-start gap-2 p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                                        <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                                        <p>By clicking "Send Money", you agree to our Terms of Use and Privacy Policy. Funds are usually delivered within minutes.</p>
                                    </div>
                                </div>

                                {/* Right Column: Amount Summary (Sticky) */}
                                <div className="lg:col-span-2">
                                    <div className="sticky top-6 space-y-6">
                                        <Card className="border-2 border-gray-200 shadow-sm">
                                            <CardHeader className="pb-4 bg-gray-50/50 border-b">
                                                <CardTitle className="text-base">Amount Summary</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3 text-sm pt-4">
                                                {/* Promo Discount Row (Top if applied) - SAVE20 Style */}
                                                {promoApplied && promoDiscount > 0 && (
                                                    <div className="flex justify-between font-medium text-gray-900">
                                                        <span>Discount: ({promoCode})</span>
                                                        <span>{promoDiscount.toFixed(2)} GBP</span>
                                                    </div>
                                                )}

                                                {/* Bonus Applied Row - Pay Less */}
                                                {useBonus && bonusType === "pay_less" && (
                                                    <div className="flex justify-between font-medium text-green-700 bg-green-50 px-2 py-1 -mx-2 rounded">
                                                        <span>Referral Bonus</span>
                                                        <span>- {Math.min(bonusBalance, parseFloat(amount)).toFixed(2)} GBP</span>
                                                    </div>
                                                )}

                                                {/* Bonus Applied Row - Send More */}
                                                {useBonus && bonusType === "send_more" && (
                                                    <div className="flex justify-between font-medium text-green-700 bg-green-50 px-2 py-1 -mx-2 rounded">
                                                        <span>Referral Bonus (Recipient)</span>
                                                        <span>+ {Math.min(bonusBalance, parseFloat(amount)).toFixed(2)} GBP</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">You Send</span>
                                                    <span className="font-medium">{totalPay.toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Amount Sent</span>
                                                    <span className="font-medium">{(parseFloat(amount)).toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">They Receive</span>
                                                    <span className="font-medium">
                                                        {finalReceiveAmount} NGN
                                                        {useBonus && bonusType === "send_more" && (
                                                            <span className="text-xs text-green-600 ml-2 font-bold">(+Bonus)</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Transaction Fee</span>
                                                    <span className="font-medium">{effectiveFee.toFixed(2)} GBP</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Exchange Rate</span>
                                                    <span className="font-medium">1 GBP = {EXCHANGE_RATE.toFixed(2)} NGN</span>
                                                </div>
                                                <div className="flex justify-between pt-2">
                                                    <span className="text-gray-600">Connection Method</span>
                                                    <span className="font-medium text-right capitalize">
                                                        {deliveryMethod.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <div className="pt-4 mt-2">
                                                    <Button
                                                        className="w-full bg-blue-600 hover:bg-blue-700 h-auto py-4 flex flex-col gap-0.5 items-center justify-center leading-tight transition-all"
                                                        onClick={async () => {
                                                            if (useBonus) {
                                                                // Redeem Bonus Logic
                                                                try {
                                                                    await fetch("/api/bonus/redeem", {
                                                                        method: "POST",
                                                                        headers: { "Content-Type": "application/json" },
                                                                        body: JSON.stringify({
                                                                            amount: Math.min(bonusBalance, parseFloat(amount)),
                                                                            userId: "user_123"
                                                                        }),
                                                                    });
                                                                } catch (e) {
                                                                    console.error("Failed to redeem bonus", e);
                                                                }
                                                            }
                                                            if (paymentMethod === 'manual_transfer') {
                                                                setBankTransferStatus('details');
                                                                setShowBankTransferModal(true);
                                                            } else {
                                                                setShowConfirmation(true);
                                                            }
                                                        }}
                                                    >
                                                        <span className="text-lg font-bold">Pay {totalPay.toFixed(2)} GBP</span>
                                                        {(promoApplied || useBonus) && (
                                                            <span className="text-xs font-medium text-blue-100/90">
                                                                Includes {promoApplied && "Promo Code"}{promoApplied && useBonus && " & "}{useBonus && (bonusType === 'pay_less' ? "Bonus Discount" : "Bonus Credit")}
                                                            </span>
                                                        )}
                                                    </Button>
                                                </div>
                                                <div className="pt-2">
                                                    <button
                                                        className="w-full text-center text-blue-600 font-medium hover:underline text-base"
                                                        onClick={() => { }}
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}





                    </div>
                </div>
            </div>
            {/* Manual Bank Transfer Modal */}
            <AnimatePresence>
                {showBankTransferModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            {/* Top accent bar */}
                            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-600" />

                            {/* Header */}
                            <div className="px-6 pt-5 pb-4">
                                <div className="flex items-center justify-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">R</span>
                                        </div>
                                        <span className="text-lg font-bold text-gray-900 font-display">Rhemito</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900">Pay with Bank Transfer</h3>
                                    <button
                                        onClick={handleCopyAll}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Copy all details"
                                    >
                                        {copiedField === 'all' ? (
                                            <Check className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <Copy className="w-5 h-5 text-gray-500" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="border-t" />

                            {/* Body */}
                            <div className="px-6 py-5 space-y-5">
                                <div className="space-y-1">
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        Kindly make a payment of <span className="font-bold text-gray-900">NGN {receiveAmount}</span> to the bank account details below
                                    </p>
                                    <p className="text-xs text-gray-500">Please make payment in the next 3 hours</p>
                                </div>

                                {/* Bank Details */}
                                <div className="space-y-0 divide-y divide-gray-100">
                                    {[
                                        { label: "Transaction Reference No.", value: "24426299", key: "ref" },
                                        { label: "Account Name", value: "Topupnigeria.com Nigeria Ltd", key: "name" },
                                        { label: "Bank Name", value: "United Bank of Africa PLC (UBA)", key: "bank" },
                                        { label: "Bank Account Number", value: "1018984719", key: "account" },
                                        { label: "Sort Code", value: "20-45-45", key: "sort" },
                                    ].map((item) => (
                                        <div key={item.key} className="flex items-center justify-between py-3">
                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                                                <p className="text-sm font-semibold text-gray-900 truncate">{item.value}</p>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(item.value, item.key)}
                                                className="ml-3 p-1.5 hover:bg-gray-100 rounded-md transition-colors shrink-0"
                                                title={`Copy ${item.label}`}
                                            >
                                                {copiedField === item.key ? (
                                                    <Check className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <Copy className="w-4 h-4 text-gray-400" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Email notice */}
                                <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-lg">
                                    <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-blue-700 leading-relaxed">
                                        An email with the bank account details has been sent to your registered email address
                                    </p>
                                </div>

                                {/* Success message - appears after submission */}
                                <AnimatePresence>
                                    {bankTransferStatus === 'submitted' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-200 rounded-lg"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                <Check className="w-3.5 h-3.5 text-green-600" />
                                            </div>
                                            <p className="text-sm font-medium text-green-800">
                                                Transaction successfully submitted!
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Footer */}
                            <div className="px-6 pb-6">
                                {bankTransferStatus === 'details' && (
                                    <Button
                                        onClick={handleBankTransferSubmit}
                                        className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold"
                                    >
                                        Submit Transaction
                                    </Button>
                                )}
                                {bankTransferStatus === 'submitting' && (
                                    <Button
                                        disabled
                                        className="w-full h-12 text-base bg-gray-400 rounded-xl font-semibold"
                                    >
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting transaction...
                                    </Button>
                                )}
                                {bankTransferStatus === 'submitted' && (
                                    <Button
                                        onClick={() => {
                                            setShowBankTransferModal(false);
                                            setBankTransferStatus('details');
                                        }}
                                        variant="outline"
                                        className="w-full h-12 text-base rounded-xl font-semibold border-2"
                                    >
                                        Close
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Session Extend Popup */}
            <AnimatePresence>
                {showExtendPopup && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4"
                        >
                            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                                <AlertTriangle className="w-7 h-7 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Rate Expiring Soon</h3>
                            <p className="text-sm text-gray-600">
                                Your exchange rate will expire in <span className="font-bold text-red-600">{sessionTimeLeft}</span> seconds. Would you like to extend your session?
                            </p>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-xl"
                                    onClick={() => {
                                        setShowExtendPopup(false);
                                        setExtendDismissed(true);
                                    }}
                                >
                                    Dismiss
                                </Button>
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl"
                                    onClick={() => {
                                        setSessionTimeLeft((prev) => prev + 120);
                                        setShowExtendPopup(false);
                                        setExtendDismissed(false);
                                    }}
                                >
                                    Extend 2 min
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Promo Confirmation Popup */}
            <AnimatePresence>
                {showConfirmation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex flex-col items-center text-center space-y-4 pt-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                                    <Check className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Success!</h3>
                                <p className="text-gray-600 text-base">
                                    {promoApplied && useBonus
                                        ? `Promo Code and Referral Bonus ${bonusType === 'pay_less' ? 'discount' : 'credit'} have been applied to your transaction.`
                                        : promoApplied
                                            ? "Promo Code has been applied to your transaction."
                                            : useBonus
                                                ? `Referral Bonus ${bonusType === 'pay_less' ? 'discount' : 'credit'} has been applied to your transaction.`
                                                : "Transaction submitted successfully."
                                    }
                                </p>
                                <Button
                                    onClick={() => setShowConfirmation(false)}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                                >
                                    OK
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout >
    );
}
