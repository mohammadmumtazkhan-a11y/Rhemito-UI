import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Check, ChevronRight, User, Building2,
    CreditCard, Wallet, Landmark, Smartphone, Banknote, Shield
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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

    const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
    const [recipientDetails, setRecipientDetails] = useState({
        firstName: "",
        lastName: "",
        relationship: "family",
        nickName: "",
        reason: "family_support",
        bankName: "",
        accountNumber: ""
    });

    const [paymentMethod, setPaymentMethod] = useState("");

    // Calculations
    const fee = parseFloat(amount || "0") * FEE_PERCENTAGE;
    const totalPay = parseFloat(amount || "0") + fee;

    useEffect(() => {
        // Auto-calculate receive amount
        const val = parseFloat(amount || "0");
        setReceiveAmount((val * EXCHANGE_RATE).toFixed(2));
    }, [amount]);

    const handleApplyPromo = () => {
        if (promoCode.toUpperCase() === "WELCOME") {
            setPromoApplied(true);
            setPromoMessage("Promo code applied! Fees waived.");
        } else {
            setPromoApplied(false);
            setPromoMessage("Invalid promo code.");
        }
    };

    const effectiveFee = promoApplied ? 0 : fee;

    const handleNext = () => {
        if (currentStep < 5) setCurrentStep((prev) => prev + 1);
        else setLocation("/"); // Finish
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep((prev) => prev - 1);
        else setLocation("/");
    };

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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Step 1: Amount */}
                        {currentStep === 1 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <Card>
                                    <CardContent className="pt-6 space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>You Send</Label>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 border-r pr-3">
                                                        <img src="https://flagcdn.com/w20/gb.png" alt="GBP" className="w-5" />
                                                        <span className="font-semibold text-sm">GBP</span>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        value={amount}
                                                        onChange={e => setAmount(e.target.value)}
                                                        className="pl-24 h-12 text-lg font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>They Receive</Label>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 border-r pr-3">
                                                        <img src="https://flagcdn.com/w20/ng.png" alt="NGN" className="w-5" />
                                                        <span className="font-semibold text-sm">NGN</span>
                                                    </div>
                                                    <Input
                                                        readOnly
                                                        value={receiveAmount}
                                                        className="pl-24 h-12 text-lg font-medium bg-gray-50"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label>How will they receive the money?</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div
                                                    onClick={() => setDeliveryMethod("bank_deposit")}
                                                    className={`p-4 border rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${deliveryMethod === "bank_deposit" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-gray-300"}`}
                                                >
                                                    <Landmark className={`w-6 h-6 ${deliveryMethod === "bank_deposit" ? "text-primary" : "text-gray-400"}`} />
                                                    <span className="text-sm font-medium">Bank Deposit</span>
                                                </div>
                                                <div
                                                    onClick={() => setDeliveryMethod("mobile_money")}
                                                    className={`p-4 border rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${deliveryMethod === "mobile_money" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-gray-300"}`}
                                                >
                                                    <Smartphone className={`w-6 h-6 ${deliveryMethod === "mobile_money" ? "text-primary" : "text-gray-400"}`} />
                                                    <span className="text-sm font-medium">Mobile Money</span>
                                                </div>
                                                <div
                                                    onClick={() => setDeliveryMethod("cash_pickup")}
                                                    className={`p-4 border rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${deliveryMethod === "cash_pickup" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-gray-300"}`}
                                                >
                                                    <Banknote className={`w-6 h-6 ${deliveryMethod === "cash_pickup" ? "text-primary" : "text-gray-400"}`} />
                                                    <span className="text-sm font-medium">Cash Pickup</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Promo Code Section */}
                                        <div className="pt-4 border-t">
                                            <Label className="mb-2 block">Have a promo code?</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Enter code (e.g. WELCOME)"
                                                    value={promoCode}
                                                    onChange={(e) => setPromoCode(e.target.value)}
                                                    className="uppercase"
                                                />
                                                <Button variant="outline" onClick={handleApplyPromo}>Apply</Button>
                                            </div>
                                            {promoMessage && (
                                                <p className={`text-xs mt-1 ${promoApplied ? "text-green-600" : "text-red-500"}`}>
                                                    {promoMessage}
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* Step 2: Recipient */}
                        {currentStep === 2 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Who are you sending to?</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label>Recent Recipients</Label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {recentRecipients.map(r => (
                                                    <div
                                                        key={r.id}
                                                        onClick={() => { setSelectedRecipient(r); handleNext(); }}
                                                        className="border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                                                    >
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${r.color}`}>
                                                            {r.initials}
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="font-medium text-sm truncate w-full">{r.name}</div>
                                                            <div className="text-xs text-muted-foreground">{r.bank}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t pt-4">
                                            <Button variant="outline" className="w-full h-12 gap-2" onClick={() => { setSelectedRecipient(null); handleNext(); }}>
                                                <User className="w-4 h-4" />
                                                New Recipient
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* Step 3: Details */}
                        {currentStep === 3 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* Step 4: Summary */}
                        {currentStep === 4 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Review Transaction</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                                            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                                            <p className="text-sm text-blue-800">
                                                Please check your transaction summary below. If everything looks good, click "Continue" to select payment method.
                                            </p>
                                        </div>

                                        <div className="space-y-3 text-sm">
                                            <h3 className="font-semibold text-gray-900 border-b pb-2">Amount</h3>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">You Send</span>
                                                <span className="font-medium">{parseFloat(amount).toFixed(2)} GBP</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Total Fees</span>
                                                <span className="font-medium">{effectiveFee.toFixed(2)} GBP</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Exchange Rate</span>
                                                <span className="font-medium">1 GBP = {EXCHANGE_RATE} NGN</span>
                                            </div>
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="font-semibold">They Receive</span>
                                                <span className="font-bold text-lg text-primary">{receiveAmount} NGN</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 text-sm pt-2">
                                            <h3 className="font-semibold text-gray-900 border-b pb-2">Recipient</h3>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Name</span>
                                                <span className="font-medium">
                                                    {selectedRecipient ? selectedRecipient.name : `${recipientDetails.firstName} ${recipientDetails.lastName}`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Collection Method</span>
                                                <span className="font-medium capitalize">{deliveryMethod.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* Step 5: Payment Method */}
                        {currentStep === 5 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
                            </motion.div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="pt-6 flex justify-between">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                className="w-32"
                            >
                                {currentStep === 1 ? "Cancel" : "Back"}
                            </Button>
                            <Button
                                onClick={handleNext}
                                className="w-32 bg-primary hover:bg-primary/90"
                                data-testid="button-continue"
                            >
                                {currentStep === 5 ? "Send Money" : "Continue"}
                            </Button>
                        </div>
                    </div>

                    {/* Sidebar Summary (Visible on Steps 1, 2, 3) */}
                    {currentStep < 4 && (
                        <div className="hidden lg:block space-y-6">
                            <Card className="border-2 border-primary/10 shadow-sm sticky top-6">
                                <CardHeader className="bg-gray-50/50 border-b pb-4">
                                    <CardTitle className="text-base">Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">You Send</span>
                                        <span className="font-medium">{parseFloat(amount).toFixed(2)} GBP</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Fees</span>
                                        <span className={`font-medium ${promoApplied ? "line-through text-gray-400" : ""}`}>
                                            {fee.toFixed(2)} GBP
                                        </span>
                                    </div>
                                    {promoApplied && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-600">Promo Discount</span>
                                            <span className="font-medium text-green-600">-{fee.toFixed(2)} GBP</span>
                                        </div>
                                    )}
                                    <div className="border-t pt-3 flex justify-between">
                                        <span className="font-semibold">Total to Pay</span>
                                        <span className="font-bold text-lg">{effectiveFee > 0 ? (parseFloat(amount) + effectiveFee).toFixed(2) : amount} GBP</span>
                                    </div>

                                    <div className="bg-primary/5 p-3 rounded-lg mt-4">
                                        <div className="text-xs text-muted-foreground mb-1">They Receive</div>
                                        <div className="text-xl font-bold text-primary">{receiveAmount} NGN</div>
                                        <div className="text-xs text-muted-foreground mt-1">Rate: 1 GBP = {EXCHANGE_RATE} NGN</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
