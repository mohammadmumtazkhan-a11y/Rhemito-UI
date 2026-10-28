import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Check, ChevronRight, User, Building2,
    CreditCard, Wallet, Landmark, Smartphone, Banknote, Shield,
    ChevronDown, ArrowRightLeft, BarChart3, Search, UserPlus, X,
    Copy, Loader2, Clock, Mail, AlertTriangle, CheckCircle2
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
import { useToast } from "@/hooks/use-toast";
import { useRewards } from "@/hooks/use-rewards";
import { BONUS_COPY, UseBonusCredit, balanceFor, creditToApply, eligibleBonusBalance, formatMoney, type BonusChoice } from "@/features/bonus";
import { PromoCodeField, usePromoCode, PROMO_COPY, formatPromoMoney } from "@/features/promo";
import { CancelTransactionModal, type TransactionDetails } from "@/components/CancelTransactionModal";
import {
    cancelSendMoneyTransaction,
    createSendMoneyTransaction,
    paySendMoneyTransaction,
    SendMoneyApiError,
} from "@/lib/sendMoney";
import type { SendMoneyPaymentMethod, SendMoneyService } from "@shared/sendMoney";

// Mock Data
const EXCHANGE_RATE = 2025.50; // 1 GBP = 2025.50 NGN
const FEE_PERCENTAGE = 0.01; // 1%
const CURRENCY_FLAGS: Record<string, string> = {
    GBP: "gb", USD: "us", EUR: "eu", NGN: "ng", INR: "in", GHS: "gh", KES: "ke", ZAR: "za", CAD: "ca", AED: "ae", AUD: "au", CNY: "cn", JPY: "jp",
};
const CURRENCY_SYMBOLS: Record<string, string> = {
    GBP: "£", USD: "$", EUR: "€", NGN: "₦", INR: "₹", GHS: "GH₵", KES: "KSh ", ZAR: "R", CAD: "C$", AED: "AED ", AUD: "A$", CNY: "¥", JPY: "¥",
};
const RECEIVE_CURRENCIES = ["NGN", "INR", "GHS", "KES", "ZAR", "EUR", "USD", "GBP", "CAD", "AED", "AUD", "CNY", "JPY"];

const recentRecipients = [
    { id: 1, name: "Akshita Gupta",   bank: "Barclays",        account: "12345678",  sortCode: "20-45-67", iban: "",                       swift: "",          currency: "GBP", country: "UK",            narration: "",                    initials: "AG", color: "bg-blue-100 text-blue-600" },
    { id: 2, name: "Sarah Chen",      bank: "Access Bank",     account: "87654321",  sortCode: "",         iban: "",                       swift: "",          currency: "NGN", country: "Nigeria",       narration: "Family support",      initials: "SC", color: "bg-purple-100 text-purple-600" },
    { id: 3, name: "David Okonkwo",   bank: "GTBank",          account: "11223344",  sortCode: "",         iban: "",                       swift: "",          currency: "NGN", country: "Nigeria",       narration: "Business payment",    initials: "DO", color: "bg-green-100 text-green-600" },
    { id: 4, name: "Hans Müller",     bank: "Deutsche Bank",   account: "DE89370400440532013000", sortCode: "", iban: "DE89 3704 0044 0532 0130 00", swift: "DEUTDEFF", currency: "EUR", country: "Germany", narration: "Invoice #DE-2024", initials: "HM", color: "bg-orange-100 text-orange-600" },
    { id: 5, name: "James Peterson",  bank: "Chase Bank",      account: "987654321", sortCode: "",         iban: "",                       swift: "CHASUS33",  currency: "USD", country: "United States", narration: "",                    initials: "JP", color: "bg-teal-100 text-teal-600" },
];

const steps = [
    { id: 1, title: "Amount" },
    { id: 2, title: "Recipient" },
    { id: 3, title: "Details" }, // Was "Bank" in screenshot, generalizing to Details
    { id: 4, title: "Payment" }, // Was "Payment Method"
];

export default function SendMoney() {
    const [, setLocation] = useLocation();
    const searchParams = useSearch();
    const parsedSearch = new URLSearchParams(
        searchParams || (typeof window !== "undefined" ? window.location.search : ""),
    );
    const initialRewardParam = parsedSearch.get("reward");
    const initialCurrencyParam = parsedSearch.get("currency")?.toUpperCase();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(1);

    // Form State
    const [sendCurrencyState, setSendCurrencyState] = useState<string>(
        initialCurrencyParam && ["GBP", "USD", "EUR"].includes(initialCurrencyParam)
            ? initialCurrencyParam
            : "GBP",
    );
    const SEND_CURRENCY = sendCurrencyState;
    const [amount, setAmount] = useState<string>("500");
    const [receiveAmount, setReceiveAmount] = useState<string>("");
    const [deliveryMethod, setDeliveryMethod] = useState("bank_deposit");

    const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
    const [recipientDetails, setRecipientDetails] = useState({
        firstName: "",
        lastName: "",
        relationship: "family",
        nickName: "",
        reason: "family_support",
        otherReason: "",
        // Banking fields
        bankName: "",
        accountNumber: "",
        sortCode: "",
        iban: "",
        swift: "",
        currency: "NGN",
        country: "Nigeria",
        narration: ""
    });

    const [paymentMethod, setPaymentMethod] = useState("");
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Transaction submission state
    const [transactionSubmitted, setTransactionSubmitted] = useState(false);
    const [submittingTransaction, setSubmittingTransaction] = useState(false);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [transactionRef, setTransactionRef] = useState("");

    // Cancel transaction modal
    const [cancelTarget, setCancelTarget] = useState<TransactionDetails | null>(null);

    // Bank transfer inline page
    const [showBankTransferPage, setShowBankTransferPage] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Payment countdown (30 minutes for bank transfer)
    const [paymentTimeLeft, setPaymentTimeLeft] = useState(1800); // 30 min
    const [paymentTimerActive, setPaymentTimerActive] = useState(false);
    const [transferComplete, setTransferComplete] = useState(false);

    // Session timer (rate lock countdown)
    const [sessionTimeLeft, setSessionTimeLeft] = useState(523); // ~8:43
    const [showExtendPopup, setShowExtendPopup] = useState(false);
    const [extendDismissed, setExtendDismissed] = useState(false);

    // Manual Bank Transfer Confirmation
    const [showManualTransferConfirm, setShowManualTransferConfirm] = useState(false);
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
    const [showExpiryPopup, setShowExpiryPopup] = useState(false);
    const [expiryCountdown, setExpiryCountdown] = useState(5);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [bonusPanelOpen, setBonusPanelOpen] = useState(
        initialRewardParam === "referral" || initialRewardParam === "bonus",
    );
    const [activeRewardTab, setActiveRewardTab] = useState<"referral" | "bonus">(
        initialRewardParam === "bonus" ? "bonus" : "referral",
    );

    // Referral bonus — live wallet from the rewards API (US-5.2 / US-5.3)
    const rewards = useRewards();
    const activeOffer =
        rewards.data?.offers?.find(
            (o) =>
                o.currency === SEND_CURRENCY &&
                (!o.receive_currency || o.receive_currency.toUpperCase() === (recipientDetails.currency || "NGN").toUpperCase()),
        ) ??
        rewards.data?.offers?.find((o) => o.currency === SEND_CURRENCY) ??
        (rewards.data?.offer?.currency === SEND_CURRENCY ? rewards.data?.offer : rewards.data?.offer);
    // One bonus balance, in the currency of this transfer; no minimum to use it (BONUS-RHEMITO 7.5)
    const bonusWallet = balanceFor(rewards.data?.wallet, SEND_CURRENCY);

    useEffect(() => {
        const qs = new URLSearchParams(
            searchParams || (typeof window !== "undefined" ? window.location.search : ""),
        );
        const rewardParam = qs.get("reward");
        const curParam = qs.get("currency")?.toUpperCase();
        if (rewardParam === "referral" || rewardParam === "bonus") {
            setActiveRewardTab(rewardParam);
            setBonusPanelOpen(true);
        }
        if (curParam && ["GBP", "USD", "EUR"].includes(curParam)) {
            setSendCurrencyState(curParam);
        }
    }, [searchParams]);
    const bonusBalance = eligibleBonusBalance(
        bonusWallet,
        parseFloat(amount || "0"),
        activeOffer?.floor,
        recipientDetails.currency || "NGN",
        activeOffer?.receive_currency,
        activeRewardTab,
    );
    const [bonusChoice, setBonusChoiceState] = useState<BonusChoice>("none");
    const useBonus = bonusChoice !== "none" && bonusBalance > 0;
    const bonusType: 'pay_less' | 'send_more' = bonusChoice === "send_more" ? "send_more" : "pay_less";

    useEffect(() => {
        if (bonusChoice !== "none" && bonusBalance <= 0) {
            setBonusChoiceState("none");
        }
    }, [bonusBalance, bonusChoice]);

    // Calculations
    const fee = parseFloat(amount || "0") * FEE_PERCENTAGE;

    // Promo codes are validated by Mito Money; the discount it approves comes off the fee (features/promo).
    const promo = usePromoCode({
        amount: parseFloat(amount || "0"),
        fee,
        sendCurrency: SEND_CURRENCY,
        receiveCurrency: recipientDetails.currency || "NGN",
        paymentMethod: paymentMethod || null,
    });
    const promoApplied = promo.applied;
    useEffect(() => {
        if (promoApplied && bonusChoice !== "none") {
            setBonusChoiceState("none");
        }
    }, [promoApplied, bonusChoice]);
    const promoDiscount = promo.discount;
    const promoCode = promo.appliedCode ?? "";
    const promoOnAmount = promoApplied && promo.appliesTo === "amount";
    // Fee promos reduce the fee (never below 0); a Fixed amount promo comes off the whole amount to pay instead
    const effectiveFee = Math.max(0, fee - (promoApplied && !promoOnAmount ? promoDiscount : 0));
    const amountPromoDiscount = promoOnAmount ? Math.min(promoDiscount, parseFloat(amount || "0")) : 0;

    // Bonus Calculations
    const bonusAmount = useBonus ? creditToApply(bonusBalance, parseFloat(amount || "0"), SEND_CURRENCY) : 0;
    const setBonusChoice = (choice: BonusChoice) => {
        setBonusChoiceState(choice);
        const value = formatMoney(creditToApply(bonusBalance, parseFloat(amount || "0"), SEND_CURRENCY), SEND_CURRENCY);
        if (choice === "pay_less") toast(BONUS_COPY.toastPayLess(value));
        if (choice === "send_more") toast(BONUS_COPY.toastSendMore(value));
    };
    /** The server refused the bonus: reset the choice and reload the balance (BONUS-RHEMITO 7.5). */
    const bonusRefused = (e: SendMoneyApiError) => {
        if (e.code !== "BONUS_UNAVAILABLE") setBonusChoiceState("none");
        void rewards.refetch();
        toast({ title: e.code === "BONUS_CHANGED" ? BONUS_COPY.changedTitle : "Bonus not applied", description: e.message, variant: "destructive" });
    };

    // Total Pay = You Send + fee (after promo) - (Pay Less bonus). Never below 0 (AC-5.2.7)
    const totalPay = Math.max(0, (parseFloat(amount || "0") + effectiveFee) - amountPromoDiscount - (useBonus && bonusType === 'pay_less' ? bonusAmount : 0));

    // Amount Summary rows:
    //   You Send     = amount the customer entered (never includes fee or bonus)
    //   Amount Sent  = GBP actually converted for the recipient
    //                  (Pay Less: = You Send; Send More: = You Send + bonus)
    //   They Receive = Amount Sent x rate
    //   Total to Pay = You Send + fee - promo - (Pay Less bonus)
    const youSendAmount = parseFloat(amount || "0");
    const amountSentGBP = youSendAmount + (useBonus && bonusType === 'send_more' ? bonusAmount : 0);
    const finalReceiveAmount = (amountSentGBP * EXCHANGE_RATE).toFixed(2);
    const sendSymbol = CURRENCY_SYMBOLS[SEND_CURRENCY] ?? "£";
    const receiveSymbol = CURRENCY_SYMBOLS[recipientDetails.currency || "NGN"] ?? "₦";



    useEffect(() => {
        // Auto-calculate receive amount
        const val = parseFloat(amount || "0");
        setReceiveAmount((val * EXCHANGE_RATE).toFixed(2));
    }, [amount]);

    // Pre-fill banking details from selected recipient
    useEffect(() => {
        if (selectedRecipient) {
            setRecipientDetails(prev => ({
                ...prev,
                firstName: selectedRecipient.name?.split(' ')[0] || prev.firstName,
                lastName: selectedRecipient.name?.split(' ').slice(1).join(' ') || prev.lastName,
                bankName: selectedRecipient.bank || prev.bankName,
                accountNumber: selectedRecipient.account || prev.accountNumber,
                sortCode: selectedRecipient.sortCode || prev.sortCode,
                iban: selectedRecipient.iban || prev.iban,
                swift: selectedRecipient.swift || prev.swift,
                currency: selectedRecipient.currency || prev.currency,
                country: selectedRecipient.country || prev.country,
                narration: selectedRecipient.narration || prev.narration,
            }));
        }
    }, [selectedRecipient]);




    const handleNext = () => {
        if (currentStep < 4) setCurrentStep((prev) => prev + 1);
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
        const allDetails = `Amount to Pay: GBP ${totalPay.toFixed(2)}\nPayee Name: Rhemito – Firopo Akin-Agunbiade\nAccount Number: 20739483\nSort Code: 04-14-04\nPayment Reference: 20092400804\nTransaction Ref: ${transactionRef}`;
        navigator.clipboard.writeText(allDetails);
        setCopiedField('all');
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Handle transaction submission on Step 3 Continue — creates the real
    // server-owned transaction (status awaiting_payment) so the Dashboard
    // unified table, cancel flow and notifications all work off server state.
    const handleSubmitTransaction = async () => {
        setSubmittingTransaction(true);
        try {
            const recipientName = selectedRecipient?.name
                ?? (`${recipientDetails.firstName} ${recipientDetails.lastName}`.trim() || "Unknown");
            const created = await createSendMoneyTransaction({
                recipientName,
                service: deliveryMethod as SendMoneyService,
                sendCurrency: "GBP",
                sendAmount: parseFloat(amount || "0").toFixed(2),
                receiveCurrency: recipientDetails.currency || "NGN",
                receiveAmount: finalReceiveAmount,
                fee: effectiveFee.toFixed(2),
                exchangeRate: String(EXCHANGE_RATE),
                ...(promoApplied && promoCode ? { promoCode, feeBeforePromo: fee.toFixed(2), ...(promoOnAmount ? { promoAppliesTo: "amount" as const, promoDiscount: amountPromoDiscount.toFixed(2) } : {}) } : {}),
            });
            setTransactionId(created.id);
            setTransactionRef(created.reference);
            setTransactionSubmitted(true);
            setCurrentStep(4);
        } catch (err) {
            toast({
                title: "Transaction not created",
                description: err instanceof Error ? err.message : "Please try again shortly.",
                variant: "destructive",
            });
        } finally {
            setSubmittingTransaction(false);
        }
    };

    // Payment countdown timer (30 min for bank transfer page)
    useEffect(() => {
        if (!paymentTimerActive || paymentTimeLeft <= 0) return;
        const interval = setInterval(() => {
            setPaymentTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setPaymentTimerActive(false);
                    setShowExpiryPopup(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [paymentTimerActive, paymentTimeLeft <= 0]);

    // Auto-redirect countdown when expiry popup is shown
    useEffect(() => {
        if (!showExpiryPopup) return;
        setExpiryCountdown(5);
        const interval = setInterval(() => {
            setExpiryCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleExpiryRedirect();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [showExpiryPopup]);

    const handleExpiryRedirect = useCallback(() => {
        setShowExpiryPopup(false);
        setShowBankTransferPage(false);
        setPaymentTimerActive(false);
        setPaymentTimeLeft(1800);
        setExpiryCountdown(5);
        setPaymentMethod("");
        setLocation("/");
        // Show toast after redirect so it's visible on the dashboard
        setTimeout(() => {
            toast({
                title: "Transaction Aborted",
                description: "Your transaction has been aborted due to payment timeout. An email notification has been sent to your registered email address.",
                variant: "destructive",
            });
        }, 500);
    }, [setLocation, toast]);

    const handleCancelClick = () => {
        const serviceLabels: Record<string, string> = {
            bank_deposit: "Bank Deposit",
            mobile_money: "Mobile Money",
            cash_pickup: "Cash Pickup",
        };
        setCancelTarget({
            id: transactionRef,
            recipient: selectedRecipient?.name
                ?? (`${recipientDetails.firstName} ${recipientDetails.lastName}`.trim() || "Unknown"),
            amount: `GBP ${totalPay.toFixed(2)}`,
            service: serviceLabels[deliveryMethod] ?? deliveryMethod ?? "Bank Transfer",
        });
    };

    const handleCancelConfirm = async (_transactionId: string): Promise<void> => {
        // Cancel the real server-owned transaction — the bell notification is
        // dispatched server-side with the same payload shape this page used to
        // send itself, and the Dashboard picks the change up via polling.
        if (transactionId) {
            try {
                await cancelSendMoneyTransaction(transactionId);
            } catch {
                // Already cancelled or store unavailable — continue with the UX flow.
            }
        }
        void queryClient.invalidateQueries({ queryKey: ["/api/send-money/transactions"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

        setCancelTarget(null);
        setShowBankTransferPage(false);
        setPaymentTimerActive(false);
        setPaymentTimeLeft(1800);
        setPaymentMethod("");
        toast({
            title: "Transaction Cancelled",
            description: `Ref #${transactionRef} has been cancelled successfully. A confirmation has been sent to your registered email address.`,
            variant: "destructive",
        });
        setLocation("/");
    };

    const handleCancelModalClose = () => setCancelTarget(null);

    const formatPaymentTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const timerDisplay = formatTime(sessionTimeLeft);

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto pb-10">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold">Send Money</h1>
                    <div className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</div>
                </div>

                {/* Stepper — hidden on Bank Transfer payment screen per design spec */}
                {!(currentStep === 4 && showBankTransferPage) && (
                    <div className="flex items-center justify-between mb-5 px-1 sm:px-4 md:px-12 relative overflow-hidden">
                        <div className="absolute left-6 right-6 top-4 h-0.5 bg-gray-200 -z-10" />
                        {steps.map((step) => (
                            <div key={step.id} className="flex flex-col items-center bg-background px-1 sm:px-2 z-10">
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold mb-1.5 transition-colors ${currentStep >= step.id ? "bg-primary text-white shadow-xs" : "bg-gray-100 text-gray-400"
                                    }`}>
                                    {currentStep > step.id ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : step.id}
                                </div>
                                <span className={`text-[11px] sm:text-xs text-center leading-tight ${currentStep >= step.id ? "text-primary font-medium" : "text-gray-400"}`}>
                                    {step.title}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div className={currentStep >= 1 && currentStep <= steps.length ? "block w-full" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
                    {/* Main Content Area */}
                    <div className={currentStep >= 1 && currentStep <= steps.length ? "w-full space-y-6" : "lg:col-span-2 space-y-6"}>

                        {/* Step 1: Amount */}
                        {currentStep === 1 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-6 w-full"
                            >
                                <div className="lg:col-span-3 space-y-5">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-gray-500">You Send</Label>
                                            {promo.enabled && (
                                                promoApplied ? (
                                                    <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full" data-testid="step1-promo-applied-pill">
                                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                                        <span>Promo <strong className="font-mono">{promoCode}</strong> (−{formatPromoMoney(promoDiscount, SEND_CURRENCY).replace(/^−/, "")})</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPromoModal(true)}
                                                            className="text-blue-600 hover:underline ml-1"
                                                        >
                                                            Change
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={promo.remove}
                                                            className="text-gray-500 hover:text-red-600 ml-0.5"
                                                            aria-label="Remove promo code"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={useBonus}
                                                        title={useBonus ? "You can only use one reward at a time" : undefined}
                                                        onClick={() => setShowPromoModal(true)}
                                                        data-testid="step1-use-promo-btn"
                                                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${useBonus ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed" : "text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 cursor-pointer"}`}
                                                    >
                                                        <span>🏷️ Use Promo Code</span>
                                                    </button>
                                                )
                                            )}
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={promoApplied || (useBonus && activeRewardTab === "bonus")}
                                                    title={promoApplied || (useBonus && activeRewardTab === "bonus") ? "You can only use one reward at a time" : undefined}
                                                    onClick={() => {
                                                        if (activeRewardTab !== "referral") setBonusChoiceState("none");
                                                        setActiveRewardTab("referral");
                                                        setBonusPanelOpen(true);
                                                    }}
                                                    data-testid="step1-use-referral-btn"
                                                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${promoApplied || (useBonus && activeRewardTab === "bonus") ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed" : activeRewardTab === "referral" && bonusPanelOpen ? "bg-teal-600 text-white border border-teal-600 cursor-pointer" : "text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200/80 cursor-pointer"}`}
                                                >
                                                    <span>🎁 Use Referral</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={promoApplied || (useBonus && activeRewardTab === "referral")}
                                                    title={promoApplied || (useBonus && activeRewardTab === "referral") ? "You can only use one reward at a time" : undefined}
                                                    onClick={() => {
                                                        if (activeRewardTab !== "bonus") setBonusChoiceState("none");
                                                        setActiveRewardTab("bonus");
                                                        setBonusPanelOpen(true);
                                                    }}
                                                    data-testid="step1-use-bonus-btn"
                                                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${promoApplied || (useBonus && activeRewardTab === "referral") ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed" : activeRewardTab === "bonus" && bonusPanelOpen ? "bg-indigo-600 text-white border border-indigo-600 cursor-pointer" : "text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 cursor-pointer"}`}
                                                >
                                                    <span>✨ Use Bonus</span>
                                                </button>
                                            </div>
                                        </div>
                                        {(promoApplied || useBonus) && (
                                            <p className="text-[11px] font-medium text-slate-500 text-right" data-testid="one-reward-at-a-time-note">
                                                You can only use one reward at a time.
                                            </p>
                                        )}
                                        <div className="flex bg-white border rounded-xl overflow-hidden h-12 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-2xs">
                                            <div className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 bg-gray-50 border-r min-w-[95px] sm:min-w-[120px] shrink-0">
                                                <img src={`https://flagcdn.com/w40/${CURRENCY_FLAGS[SEND_CURRENCY] ?? "gb"}.png`} alt={SEND_CURRENCY} className="w-6 sm:w-8 h-4 sm:h-6 object-cover rounded shadow-2xs" />
                                                <span className="font-semibold text-base">{SEND_CURRENCY}</span>
                                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                                                <select
                                                    aria-label="Send currency"
                                                    data-testid="send-currency-select"
                                                    value={SEND_CURRENCY}
                                                    onChange={(e) => setSendCurrencyState(e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                >
                                                    {(rewards.data?.sendCurrencies?.length ? rewards.data.sendCurrencies : ["GBP", "USD", "EUR"]).map((cur) => (
                                                        <option key={cur} value={cur}>{cur}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                className="flex-1 min-w-0 px-3 sm:px-4 text-base font-medium outline-none bg-transparent"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-500">They Receive</Label>
                                        <div className="flex bg-white border rounded-xl overflow-hidden h-12 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-2xs">
                                            <div className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 bg-gray-50 border-r min-w-[95px] sm:min-w-[120px] shrink-0">
                                                <img src={`https://flagcdn.com/w40/${CURRENCY_FLAGS[recipientDetails.currency || "NGN"] ?? "ng"}.png`} alt={recipientDetails.currency || "NGN"} className="w-6 sm:w-8 h-4 sm:h-6 object-cover rounded shadow-2xs" />
                                                <span className="font-semibold text-base">{recipientDetails.currency || "NGN"}</span>
                                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                                                <select
                                                    aria-label="Receive currency"
                                                    data-testid="receive-currency-select"
                                                    value={recipientDetails.currency || "NGN"}
                                                    onChange={(e) => setRecipientDetails((prev) => ({ ...prev, currency: e.target.value }))}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                >
                                                    {RECEIVE_CURRENCIES.map((cur) => (
                                                        <option key={cur} value={cur}>{cur}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <input
                                                readOnly
                                                value={receiveAmount}
                                                className="flex-1 min-w-0 px-3 sm:px-4 text-base font-medium outline-none bg-gray-50/70 text-gray-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-base">How will they receive the money?</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                                            {[
                                                { id: "bank_deposit", label: "Bank Deposit", icon: Landmark },
                                                { id: "mobile_money", label: "Mobile Money", icon: Smartphone },
                                                { id: "cash_pickup", label: "Cash Pickup", icon: Banknote }
                                            ].map((method) => (
                                                <div
                                                    key={method.id}
                                                    onClick={() => setDeliveryMethod(method.id)}
                                                    className={`
                                                        flex items-center justify-center sm:justify-start gap-2.5 px-4 py-3 rounded-xl cursor-pointer transition-all font-medium text-sm active:scale-[0.98]
                                                        ${deliveryMethod === method.id
                                                            ? "bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs"
                                                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}
                                                    `}
                                                >
                                                    <method.icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${deliveryMethod === method.id ? "text-blue-600" : "text-gray-400"}`} />
                                                    <span className="truncate">{method.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bonus is offered as soon as the customer lands on Step 1 (one reward at a time) */}
                                    {bonusPanelOpen && !promoApplied && (
                                        <UseBonusCredit
                                            balance={bonusWallet}
                                            unused={rewards.data?.wallet.unused}
                                            currency={SEND_CURRENCY}
                                            sendAmount={parseFloat(amount || "0")}
                                            receiveCurrency={recipientDetails.currency || "NGN"}
                                            exchangeRate={EXCHANGE_RATE}
                                            choice={bonusChoice}
                                            onChoice={setBonusChoice}
                                            onClose={() => setBonusPanelOpen(false)}
                                            activeTab={activeRewardTab}
                                            blocked={rewards.data?.wallet.bonus_blocked}
                                            referralFloor={activeOffer?.floor}
                                            referralReceiveCurrency={activeOffer?.receive_currency}
                                        />
                                    )}


                                    <div className="space-y-1 pt-2 lg:hidden">
                                        <div className="flex items-center justify-between py-2">
                                            <div className="flex items-center gap-3 text-gray-600">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <Wallet className="w-4 h-4" />
                                                </div>
                                                <span>Amount Sent</span>
                                            </div>
                                            <span className="font-medium whitespace-nowrap">{sendSymbol}{(parseFloat(amount) - effectiveFee).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <div className="flex items-center gap-3 text-gray-600">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <BarChart3 className="w-4 h-4" />
                                                </div>
                                                <span>Fee</span>
                                            </div>
                                            <span className="font-medium whitespace-nowrap">{sendSymbol}{fee.toFixed(2)}</span>
                                        </div>
                                        {promoApplied && (
                                            <div className="flex items-center justify-between py-2 text-green-600 font-medium">
                                                <span>Promo ({promoCode})</span>
                                                <span className="whitespace-nowrap">- {formatPromoMoney(promoDiscount, SEND_CURRENCY).replace(/^−/, "")}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between py-2 bg-blue-50 px-4 rounded-lg -mx-4">
                                            <div className="flex items-center gap-3 text-gray-600">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600">
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                </div>
                                                <span>Exchange Rate</span>
                                            </div>
                                            <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}1 = {receiveSymbol}{EXCHANGE_RATE.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="flex-1 h-12 text-base rounded-xl"
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            onClick={handleNext}
                                            className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 rounded-xl"
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
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{parseFloat(amount).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Amount Sent</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{(parseFloat(amount) - effectiveFee).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Fee</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{fee.toFixed(2)}</span>
                                                </div>
                                                {promoApplied && (
                                                    <div className="flex justify-between font-medium text-green-600 bg-green-50 px-2 py-1 -mx-2 rounded" data-testid="summary-promo-step1">
                                                        <span>Promo ({promoCode})</span>
                                                        <span className="whitespace-nowrap">- {formatPromoMoney(promoDiscount, SEND_CURRENCY).replace(/^−/, "")}</span>
                                                    </div>
                                                )}
                                                {useBonus && (
                                                    <div className="flex justify-between font-medium text-teal-700 bg-teal-50 px-2 py-1 -mx-2 rounded" data-testid="summary-bonus-step1">
                                                        <span>{bonusType === "pay_less" ? "Bonus discount" : "Bonus credit"}</span>
                                                        <span className="whitespace-nowrap">{bonusType === "pay_less" ? "-" : "+"} {sendSymbol}{bonusAmount.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Exchange Rate</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}1 = {receiveSymbol}{EXCHANGE_RATE.toFixed(2)}</span>
                                                </div>
                                                {(promoApplied || useBonus) && (
                                                    <div className="flex justify-between pt-2 border-t font-bold text-gray-900">
                                                        <span>Total to Pay</span>
                                                        <span className="whitespace-nowrap">{sendSymbol}{totalPay.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                <div className="pt-4 mt-4 border-t flex justify-between items-center">
                                                    <span className="text-gray-600 font-medium">They Receive</span>
                                                    <span className="font-bold text-lg text-blue-600 whitespace-nowrap">{receiveSymbol}{receiveAmount}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 1 Promo Code Modal */}
                        {showPromoModal && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                                onClick={() => setShowPromoModal(false)}
                                data-testid="step1-promo-modal"
                            >
                                <div
                                    className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-4"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between border-b pb-3">
                                        <h3 className="text-base font-bold text-gray-900">Insert Promo Code</h3>
                                        <button
                                            type="button"
                                            onClick={() => setShowPromoModal(false)}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                                            aria-label="Close promo code modal"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Have a promotional discount code? Enter it below to see your discount reflected immediately in your transfer summary.
                                    </p>
                                    <PromoCodeField promo={promo} bare />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Recipient */}
                        {/* Step 2: Recipient */}
                        {currentStep === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-6 w-full"
                            >
                                {/* Left Column: Recipient Selection */}
                                <div className="lg:col-span-3 space-y-5">
                                    <div className="space-y-6">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="gap-2 text-gray-600 hover:text-gray-900"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            Back
                                        </Button>
                                        <h2 className="text-lg font-bold text-gray-900">Who are you sending to?</h2>

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
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search recipient"
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                                                />
                                            </div>
                                            <Button variant="outline" className="gap-2 h-11 whitespace-nowrap bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-xs rounded-xl" onClick={() => { setSelectedRecipient(null); handleNext(); }}>
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
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${r.color} relative flex-shrink-0`}>
                                                            {r.initials}
                                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-gray-900">{r.name}</div>
                                                            <div className="text-sm text-gray-500">{r.bank}</div>
                                                            {/* Banking detail chips */}
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                                                                    Acct: {r.account.length > 16 ? `${r.account.slice(0, 4)}…${r.account.slice(-4)}` : r.account}
                                                                </span>
                                                                {r.sortCode && (
                                                                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">
                                                                        Sort: {r.sortCode}
                                                                    </span>
                                                                )}
                                                                {r.iban && (
                                                                    <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-mono">
                                                                        IBAN: {r.iban.slice(0, 12)}…
                                                                    </span>
                                                                )}
                                                                {r.swift && (
                                                                    <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-mono">
                                                                        SWIFT: {r.swift}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Narration */}
                                                            {(r.narration || r.currency === "NGN") && (
                                                                <div className="text-xs text-gray-400 italic mt-0.5 truncate max-w-[220px]">
                                                                    "{r.narration || (r.currency === "NGN" ? "Money transfer" : "")}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-sm flex-shrink-0 ml-2">
                                                        <div className="text-blue-500 font-medium">Bank Deposit</div>
                                                        <div className="text-gray-400 font-mono">{r.currency}</div>
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
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{parseFloat(amount).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Amount Sent</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{(parseFloat(amount) - effectiveFee).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">They Receive</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{receiveSymbol}{receiveAmount}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Transaction Fee</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{fee.toFixed(2)}</span>
                                                </div>
                                                {promoApplied && (
                                                    <div className="flex justify-between font-medium text-green-600 bg-green-50 px-2 py-1 -mx-2 rounded">
                                                        <span>Promo ({promoCode})</span>
                                                        <span className="whitespace-nowrap">- {formatPromoMoney(promoDiscount, SEND_CURRENCY).replace(/^−/, "")}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Exchange Rate</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}1 = {receiveSymbol}{EXCHANGE_RATE.toFixed(2)}</span>
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
                                className="grid grid-cols-1 lg:grid-cols-5 gap-6 w-full"
                            >
                                {/* Left Column: Form Details */}
                                <div className="lg:col-span-3 space-y-5">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Recipient Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                                                <Label>Reason for transfer <span className="text-destructive">*</span></Label>
                                                <Select
                                                    value={recipientDetails.reason}
                                                    onValueChange={(val) => setRecipientDetails(prev => ({ ...prev, reason: val }))}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="family_support">Family Support</SelectItem>
                                                        <SelectItem value="education">Education</SelectItem>
                                                        <SelectItem value="bills">Bills</SelectItem>
                                                        <SelectItem value="medical">Medical Expenses</SelectItem>
                                                        <SelectItem value="other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {recipientDetails.reason === "other" && (
                                                <div className="space-y-2">
                                                    <Label>Please specify reason <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        placeholder="e.g. Consulting, Event sponsorship, etc."
                                                        value={recipientDetails.otherReason}
                                                        onChange={e => setRecipientDetails(prev => ({ ...prev, otherReason: e.target.value }))}
                                                        required
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Label>Narration
                                                    {recipientDetails.currency === "NGN"
                                                        ? <span className="text-red-500 ml-1">*</span>
                                                        : <span className="text-muted-foreground font-normal"> (Optional)</span>
                                                    }
                                                </Label>
                                                <Textarea
                                                    placeholder="e.g. Monthly allowance for February"
                                                    value={recipientDetails.narration}
                                                    onChange={e => setRecipientDetails({ ...recipientDetails, narration: e.target.value })}
                                                    className="resize-none"
                                                    rows={3}
                                                />
                                                {recipientDetails.currency === "NGN" && (
                                                    <p className="text-xs text-amber-600">Narration is required for Nigerian accounts.</p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Banking Details Card — conditional by destination */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Banking Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Bank Name</Label>
                                                <Input
                                                    placeholder="e.g. Barclays, Access Bank"
                                                    value={recipientDetails.bankName}
                                                    onChange={e => setRecipientDetails({ ...recipientDetails, bankName: e.target.value })}
                                                />
                                            </div>

                                            {/* Nigeria (NGN): account number only */}
                                            {recipientDetails.currency === "NGN" && (
                                                <div className="space-y-2">
                                                    <Label>Account Number <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        placeholder="10-digit account number"
                                                        value={recipientDetails.accountNumber}
                                                        onChange={e => setRecipientDetails({ ...recipientDetails, accountNumber: e.target.value })}
                                                        maxLength={10}
                                                    />
                                                </div>
                                            )}

                                            {/* UK (GBP): account number + sort code */}
                                            {recipientDetails.currency === "GBP" && (
                                                <>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Account Number <span className="text-red-500">*</span></Label>
                                                            <Input
                                                                placeholder="8-digit number"
                                                                value={recipientDetails.accountNumber}
                                                                onChange={e => setRecipientDetails({ ...recipientDetails, accountNumber: e.target.value })}
                                                                maxLength={8}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Sort Code <span className="text-red-500">*</span></Label>
                                                            <Input
                                                                placeholder="e.g. 20-45-67"
                                                                value={recipientDetails.sortCode}
                                                                onChange={e => setRecipientDetails({ ...recipientDetails, sortCode: e.target.value })}
                                                                maxLength={8}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* International (EUR / USD / other): IBAN + SWIFT */}
                                            {recipientDetails.currency !== "NGN" && recipientDetails.currency !== "GBP" && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label>IBAN / Account Number <span className="text-red-500">*</span></Label>
                                                        <Input
                                                            placeholder="e.g. DE89 3704 0044 0532 0130 00"
                                                            value={recipientDetails.iban || recipientDetails.accountNumber}
                                                            onChange={e => setRecipientDetails({ ...recipientDetails, iban: e.target.value, accountNumber: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>SWIFT / BIC <span className="text-red-500">*</span></Label>
                                                        <Input
                                                            placeholder="e.g. DEUTDEFF"
                                                            value={recipientDetails.swift}
                                                            onChange={e => setRecipientDetails({ ...recipientDetails, swift: e.target.value })}
                                                            maxLength={11}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <div className="pt-4 flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="flex-1 h-12 text-base rounded-xl"
                                            disabled={submittingTransaction}
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            onClick={handleSubmitTransaction}
                                            disabled={submittingTransaction}
                                            className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 rounded-xl"
                                        >
                                            {submittingTransaction ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Processing...</span>
                                                </div>
                                            ) : "Continue"}
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
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{parseFloat(amount).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Fees</span>
                                                    <span className="font-medium text-gray-900 whitespace-nowrap">{sendSymbol}{fee.toFixed(2)}</span>
                                                </div>
                                                {promoApplied && (
                                                    <div className="flex justify-between font-medium text-green-600 bg-green-50 px-2 py-1 -mx-2 rounded">
                                                        <span>Promo ({promoCode})</span>
                                                        <span className="whitespace-nowrap">- {formatPromoMoney(promoDiscount, SEND_CURRENCY).replace(/^−/, "")}</span>
                                                    </div>
                                                )}
                                                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                                                    <span className="text-gray-900 font-bold text-base">Total to Pay</span>
                                                    <span className="font-bold text-lg text-gray-900 whitespace-nowrap">{sendSymbol}{totalPay.toFixed(2)}</span>
                                                </div>

                                                <div className="pt-4 mt-2 bg-blue-50/50 -mx-6 px-6 py-4 mb-[-24px]">
                                                    <div className="text-sm text-gray-600 mb-1">They Receive</div>
                                                    <div className="text-xl font-bold text-blue-600 whitespace-nowrap">{receiveSymbol}{receiveAmount}</div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4: Payment Method */}
                        {currentStep === 4 && !showBankTransferPage && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-5 gap-6 pb-24"
                            >
                                {/* Left Column: Input Sections */}
                                <div className="lg:col-span-3 space-y-6">

                                    {/* Promo & Bonus are selected on Step 1 and summarized in the right-hand Amount Summary */}


                                    {/* Promo Code Section (features/promo) */}


                                    {/* Payment Method Selection */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">How would you like to pay?</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {[
                                                { id: "instant_bank", title: "Instant Pay By Bank", desc: `You pay GBP ${totalPay.toFixed(2)}`, icon: Landmark },
                                                { id: "card", title: "Credit/Debit Card", desc: `You pay GBP ${totalPay.toFixed(2)}`, icon: CreditCard },
                                                { id: "manual_transfer", title: "Manual Bank Transfer", desc: "Send to our local account (Pay within 30 minutes)", icon: Building2 },
                                                { id: "wallet", title: "Wallet Balance", desc: `Available: GBP 300.20`, icon: Wallet },
                                            ].map((method) => (
                                                <div
                                                    key={method.id}
                                                    onClick={async () => {
                                                        setPaymentMethod(method.id);
                                                        // Record the payment method on the server-owned
                                                        // transaction (instant methods complete it).
                                                        if (transactionId) {
                                                            try {
                                                                if (promoApplied) promo.lock();
                                                                await paySendMoneyTransaction(transactionId, method.id as SendMoneyPaymentMethod, promoApplied ? { code: promoCode, discount: promoDiscount } : null, useBonus ? { mode: bonusType, amount: bonusAmount } : null);
                                                            } catch (e) {
                                                                // The bonus is used with the payment; if it can't be, the transfer is not paid (BONUS-RHEMITO B-23)
                                                                if (e instanceof SendMoneyApiError && e.code.startsWith("BONUS_")) {
                                                                    bonusRefused(e);
                                                                    setPaymentMethod("");
                                                                    return;
                                                                }
                                                                // A promo code that can no longer be used stops the payment before any money moves (PROMO-RHEMITO §6.4)
                                                                if (e instanceof SendMoneyApiError && e.code.startsWith("PROMO_")) {
                                                                    promo.reject(e.message);
                                                                    setPaymentMethod("");
                                                                    toast({ title: "Payment not made", description: e.message, variant: "destructive" });
                                                                    return;
                                                                }
                                                                console.error("Failed to record payment method", e);
                                                                const description = e instanceof SendMoneyApiError ? e.message : "We couldn't complete your payment. Please try again.";
                                                                toast({ title: "Payment not completed", description, variant: "destructive" });
                                                                setPaymentMethod("");
                                                                return;
                                                            }
                                                        }
                                                        void rewards.refetch();
                                                        if (method.id === 'manual_transfer') {
                                                            setShowManualTransferConfirm(true);
                                                        } else {
                                                            setShowConfirmation(true);
                                                        }
                                                    }}
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
                                        <p>By selecting a payment option, you agree to our Terms of Use and Privacy Policy. Funds are usually delivered within minutes.</p>
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
                                                {/* Promo Discount Row (shown when a code is applied) */}
                                                {promoApplied && promoDiscount > 0 && (
                                                    <div className="flex justify-between font-medium text-green-700" data-testid="summary-promo">
                                                        <span>{PROMO_COPY.summaryLabel(promoCode)}</span>
                                                        <span className="whitespace-nowrap">−{formatPromoMoney(promoDiscount, SEND_CURRENCY).replace(/^−/, "")}</span>
                                                    </div>
                                                )}

                                                {/* Bonus Applied Row - Pay Less */}
                                                {useBonus && bonusType === "pay_less" && (
                                                    <div className="flex justify-between font-medium text-teal-700 bg-teal-50 px-2 py-1 -mx-2 rounded" data-testid="summary-bonus">
                                                        <span>{BONUS_COPY.summaryPayLess}</span>
                                                        <span className="whitespace-nowrap">- {sendSymbol}{bonusAmount.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                {/* Bonus Applied Row - Send More */}
                                                {useBonus && bonusType === "send_more" && (
                                                    <div className="flex justify-between font-medium text-teal-700 bg-teal-50 px-2 py-1 -mx-2 rounded" data-testid="summary-bonus">
                                                        <span>{BONUS_COPY.summarySendMore}</span>
                                                        <span className="whitespace-nowrap">+ {sendSymbol}{bonusAmount.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">You Send</span>
                                                    <span className="font-medium whitespace-nowrap">{sendSymbol}{youSendAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Amount Sent</span>
                                                    <span className="font-medium whitespace-nowrap">{sendSymbol}{amountSentGBP.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">They Receive</span>
                                                    <span className="font-medium whitespace-nowrap">
                                                        {receiveSymbol}{finalReceiveAmount}
                                                        {useBonus && bonusType === "send_more" && (
                                                            <span className="text-xs text-green-600 ml-2 font-bold">(+Bonus)</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Transaction Fee</span>
                                                    <span className="font-medium whitespace-nowrap">{sendSymbol}{effectiveFee.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Exchange Rate</span>
                                                    <span className="font-medium whitespace-nowrap">{sendSymbol}1 = {receiveSymbol}{EXCHANGE_RATE.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between pt-2">
                                                    <span className="text-gray-600">Connection Method</span>
                                                    <span className="font-medium text-right capitalize">
                                                        {deliveryMethod.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <div className="pt-4 mt-2 border-t">
                                                    <div className="flex justify-between items-center pt-2">
                                                        <span className="text-gray-900 font-bold text-base">Total to Pay</span>
                                                        <span className="font-bold text-lg text-gray-900 whitespace-nowrap" data-testid="summary-total">{sendSymbol}{Math.max(0, totalPay).toFixed(2)}</span>
                                                    </div>
                                                    {(promoApplied || useBonus) && (
                                                        <p className="text-xs text-green-600 font-medium mt-1">
                                                            Includes {promoApplied && "promo code"}{promoApplied && useBonus && " & "}{useBonus && (bonusType === 'pay_less' ? "Bonus Discount" : "Bonus Credit")}
                                                        </p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4 — Bank Transfer Details (Inline Page — Payment Brief 05/06 Web & 06/06 Mobile) */}
                        {currentStep === 4 && showBankTransferPage && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="w-full max-w-3xl mx-auto space-y-5 pb-10"
                            >
                                {/* Back Button */}
                                <button
                                    onClick={() => { setShowBankTransferPage(false); setPaymentTimerActive(false); }}
                                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group"
                                >
                                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                                    <span className="text-sm font-medium">Back to Payment Methods</span>
                                </button>

                                {/* 4-Stage Status Card */}
                                <div className="rounded-2xl border border-slate-200/80 bg-white px-3 sm:px-6 py-4 shadow-2xs">
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        {[
                                            { label: "Transaction\nCreated", icon: Check, active: false, completed: true },
                                            { label: "Awaiting\nPayment", icon: Clock, active: !transferComplete, completed: transferComplete },
                                            { label: "Payment\nReceived", icon: Banknote, active: false, completed: transferComplete },
                                            { label: "Processing\nTransfer", icon: ArrowRightLeft, active: false, completed: transferComplete },
                                        ].map((step, idx) => (
                                            <div key={idx} className="flex flex-col items-center gap-1.5">
                                                <div
                                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                                        step.completed
                                                            ? "bg-emerald-50 text-emerald-600"
                                                            : step.active
                                                            ? "bg-blue-50 text-[#2563EB]"
                                                            : "bg-slate-100 text-slate-500"
                                                    }`}
                                                >
                                                    {step.completed ? (
                                                        <Check className="w-4 h-4 stroke-[2.5]" />
                                                    ) : (
                                                        <step.icon className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <span
                                                    className={`text-[11px] sm:text-xs leading-tight whitespace-pre-line ${
                                                        step.completed
                                                            ? "font-medium text-slate-700"
                                                            : step.active
                                                            ? "font-bold text-[#2563EB]"
                                                            : "font-medium text-slate-500"
                                                    }`}
                                                >
                                                    {step.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Unified Mint "Transaction created" + Timer Banner */}
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-2xl bg-[#EAFBF3] border border-emerald-200/80 p-4 sm:p-5 space-y-2"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                            <span className="text-sm sm:text-base font-bold text-emerald-900">
                                                Transaction created
                                            </span>
                                        </div>
                                        <span
                                            className={`text-lg sm:text-2xl font-extrabold tabular-nums tracking-tight ${
                                                paymentTimeLeft <= 300 ? "text-red-700" : "text-[#92400E]"
                                            }`}
                                        >
                                            {formatPaymentTime(paymentTimeLeft)} left
                                        </span>
                                    </div>
                                    <div className="pl-0 sm:pl-7 space-y-1">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base font-extrabold text-emerald-950">
                                            <span>Ref: {transactionRef || "TXN-202610-00001"}</span>
                                            <span>Amount: GBP {totalPay.toFixed(2)}</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                                            Pay within 30 minutes to complete your transfer. Unpaid transfers are automatically cancelled.
                                        </p>
                                    </div>
                                </motion.div>

                                {/* Main Payment Brief Card (05/06 Web 2-Col Split & 06/06 Mobile Stacked) */}
                                <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                                    {/* Top Header Row inside Card */}
                                    <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                                                PAY BY BANK TRANSFER
                                            </p>
                                            <p className="text-3xl sm:text-[34px] font-extrabold text-slate-950 tabular-nums tracking-tight mt-1">
                                                GBP {totalPay.toFixed(2)}
                                            </p>
                                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                                Send the exact amount to this account.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleCopyAll}
                                            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors shrink-0 shadow-2xs"
                                            title="Copy all details"
                                        >
                                            {copiedField === "all" ? (
                                                <>
                                                    <Check className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-emerald-700">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4 text-slate-600" />
                                                    <span>Copy All</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Split Body: Left Blue Panel + Right White Details Panel (Stacks on Mobile) */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-100">
                                        {/* Left Royal Blue Payee Panel */}
                                        <div className="md:col-span-6 bg-[#2563EB] text-white p-5 sm:p-6 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-100">
                                                    USE THIS ACCOUNT / PAYEE NAME
                                                </p>
                                                <span className="inline-block mt-2.5 px-2.5 py-1 rounded-md bg-white/15 border border-white/25 text-xs font-semibold text-white">
                                                    Type exactly as shown
                                                </span>
                                                <p className="mt-3.5 text-2xl sm:text-[28px] font-extrabold leading-tight text-white break-words">
                                                    Rhemito – Firopo Akin-Agunbiade
                                                </p>
                                                <p className="mt-3 text-xs sm:text-sm text-blue-50 leading-relaxed">
                                                    Enter this exact name as the payee in your banking app.
                                                </p>
                                                <p className="mt-2.5 text-xs sm:text-sm text-blue-100/95 leading-relaxed">
                                                    (Ensure you enter this name as is in your bank account — this is your dedicated Rhemito funding account, not your personal savings.)
                                                </p>
                                            </div>
                                            <div className="mt-5 pt-1">
                                                <button
                                                    onClick={() => handleCopy("Rhemito – Firopo Akin-Agunbiade", "name")}
                                                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#2563EB] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors shadow-2xs"
                                                >
                                                    {copiedField === "name" ? (
                                                        <>
                                                            <Check className="w-4 h-4 text-emerald-600" />
                                                            <span className="text-emerald-700">Copied payee name!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-4 h-4" />
                                                            <span>Copy payee name</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Right White Account / Sort Code / Payment Reference Panel */}
                                        <div className="md:col-span-6 bg-white p-5 sm:p-6 flex flex-col justify-between divide-y divide-slate-100">
                                            {/* Account number */}
                                            <div className="pb-4 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Account number</p>
                                                    <p className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums mt-0.5">
                                                        20739483
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy("20739483", "account")}
                                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shrink-0"
                                                    title="Copy Account number"
                                                >
                                                    {copiedField === "account" ? (
                                                        <Check className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Sort code */}
                                            <div className="py-4 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Sort code</p>
                                                    <p className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums mt-0.5">
                                                        04-14-04
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy("04-14-04", "sort")}
                                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shrink-0"
                                                    title="Copy Sort code"
                                                >
                                                    {copiedField === "sort" ? (
                                                        <Check className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Payment reference */}
                                            <div className="pt-4">
                                                <div className="rounded-2xl bg-[#EEF5FF] p-4 flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs sm:text-sm font-bold text-[#2563EB]">
                                                                Payment reference
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-md bg-white text-[#2563EB] text-[11px] font-semibold shadow-2xs">
                                                                Required
                                                            </span>
                                                        </div>
                                                        <p className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums mt-1">
                                                            20092400804
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopy("20092400804", "ref")}
                                                        className="w-10 h-10 rounded-xl border border-blue-100 bg-white hover:bg-blue-50 flex items-center justify-center text-slate-700 transition-colors shrink-0"
                                                        title="Copy Payment reference"
                                                    >
                                                        {copiedField === "ref" ? (
                                                            <Check className="w-4 h-4 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Section inside Main Card */}
                                    <div className="p-5 sm:p-6 space-y-4">
                                        {/* Email Confirmation Banner */}
                                        <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                                            <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs sm:text-sm font-bold text-slate-900">
                                                    Bank details sent to your email
                                                </p>
                                                <p className="text-xs text-slate-600 mt-0.5">
                                                    These details are also available in your registered email.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Completed your bank transfer? + Instant verification */}
                                        <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-center">
                                            <span className="text-sm sm:text-base font-bold text-slate-900">
                                                Completed your bank transfer?
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-md bg-[#EEF5FF] text-[#2563EB] text-xs font-semibold">
                                                Instant verification
                                            </span>
                                        </div>

                                        {/* Primary CTA: I have made the Payment */}
                                        {!transferComplete ? (
                                            <button
                                                onClick={() => {
                                                    setTransferComplete(true);
                                                    setPaymentTimerActive(false);
                                                    toast({
                                                        title: "Payment confirmation received",
                                                        description: "We are verifying your bank transfer and processing your transaction.",
                                                    });
                                                }}
                                                className="w-full py-3.5 px-6 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-xs transition-all text-center cursor-pointer"
                                            >
                                                I have made the Payment
                                            </button>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                            >
                                                <button
                                                    onClick={() => setLocation("/")}
                                                    className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-xs transition-all text-center cursor-pointer"
                                                >
                                                    Done — Go to Dashboard
                                                </button>
                                            </motion.div>
                                        )}

                                        {/* Secondary CTA: I've noted the details — take me to Dashboard */}
                                        {!transferComplete && (
                                            <button
                                                onClick={() => setLocation("/")}
                                                className="w-full py-3.5 px-6 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm border border-slate-200 transition-colors text-center cursor-pointer"
                                            >
                                                I've noted the details — take me to Dashboard
                                            </button>
                                        )}

                                        {/* Footer helper text + Cancel Transaction + Currency Cloud */}
                                        <div className="pt-1 text-center space-y-2.5">
                                            {!transferComplete && (
                                                <p className="text-xs text-slate-500">
                                                    I'll complete the payment within 30 minutes
                                                </p>
                                            )}

                                            {!transferComplete && (
                                                <div>
                                                    <button
                                                        onClick={handleCancelClick}
                                                        className="text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                                                    >
                                                        Cancel Transaction
                                                    </button>
                                                </div>
                                            )}

                                            <p className="text-xs text-slate-500 pt-1">
                                                (Payment account solution provided by Currency Cloud)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Simulate Expiry - Demo Only */}
                                <div className="flex justify-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-slate-400 hover:text-red-500"
                                        onClick={() => setPaymentTimeLeft(3)}
                                    >
                                        Simulate Expiry (Demo)
                                    </Button>
                                </div>
                            </motion.div>
                        )}


                    </div>
                </div>
            </div>

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
                                        ? `Your promo code and Bonus ${bonusType === 'pay_less' ? 'discount' : 'credit'} have been applied to your transaction.`
                                        : promoApplied
                                            ? "Your promo code has been applied to your transaction."
                                            : useBonus
                                                ? `Bonus ${bonusType === 'pay_less' ? 'discount' : 'credit'} has been applied to your transaction.`
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
            {/* Manual Bank Transfer Confirmation Popup */}
            <AnimatePresence>
                {showManualTransferConfirm && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full relative"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Building2 className="w-7 h-7 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Confirm Payment Method</h3>
                                <p className="text-sm text-gray-600">
                                    You have selected <span className="font-semibold text-gray-900">Manual Bank Transfer. Send to our local account (Pay within 30 minutes)</span> option for payment. Do you want to proceed?
                                </p>
                                <div className="flex gap-3 w-full pt-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 rounded-xl"
                                        onClick={() => setShowManualTransferConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-sm"
                                        disabled={isSubmittingTransaction}
                                        onClick={async () => {
                                            setIsSubmittingTransaction(true);
                                            // Record manual transfer as the payment method — the
                                            // transaction stays awaiting_payment inside the 30-min window.
                                            if (transactionId) {
                                                try {
                                                    if (promoApplied) promo.lock();
                                                    await paySendMoneyTransaction(transactionId, "manual_transfer", promoApplied ? { code: promoCode, discount: promoDiscount } : null, useBonus ? { mode: bonusType, amount: bonusAmount } : null);
                                                } catch (e) {
                                                    if (e instanceof SendMoneyApiError && e.code.startsWith("BONUS_")) {
                                                        bonusRefused(e);
                                                        setIsSubmittingTransaction(false);
                                                        setShowManualTransferConfirm(false);
                                                        setPaymentMethod("");
                                                        return;
                                                    }
                                                    if (e instanceof SendMoneyApiError && e.code.startsWith("PROMO_")) {
                                                        promo.reject(e.message);
                                                        setIsSubmittingTransaction(false);
                                                        setShowManualTransferConfirm(false);
                                                        setPaymentMethod("");
                                                        toast({ title: "Payment not made", description: e.message, variant: "destructive" });
                                                        return;
                                                    }
                                                    console.error("Failed to record payment method", e);
                                                    const description = e instanceof SendMoneyApiError ? e.message : "We couldn't complete your payment. Please try again.";
                                                    toast({ title: "Payment not completed", description, variant: "destructive" });
                                                    setIsSubmittingTransaction(false);
                                                    setShowManualTransferConfirm(false);
                                                    setPaymentMethod("");
                                                    return;
                                                }
                                            }
                                            setIsSubmittingTransaction(false);
                                            setShowManualTransferConfirm(false);
                                            setShowBankTransferPage(true);
                                            setPaymentTimerActive(true);
                                        }}
                                    >
                                        {isSubmittingTransaction ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Submitting Transaction...
                                            </span>
                                        ) : (
                                            "Proceed"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Transaction Expiry Popup */}
            <AnimatePresence>
                {showExpiryPopup && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full relative"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="w-7 h-7 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Transaction Expired</h3>
                                <p className="text-sm text-gray-600">
                                    The payment time has expired. This transaction will now be <span className="font-semibold text-red-600">aborted</span>. You will be redirected to the dashboard in <span className="font-semibold text-gray-900">{expiryCountdown}s</span>.
                                </p>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-red-500 rounded-full"
                                        initial={{ width: "100%" }}
                                        animate={{ width: "0%" }}
                                        transition={{ duration: 5, ease: "linear" }}
                                    />
                                </div>
                                <Button
                                    className="w-full bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
                                    onClick={handleExpiryRedirect}
                                >
                                    Go to Dashboard
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <CancelTransactionModal
                open={cancelTarget !== null}
                transaction={cancelTarget}
                onConfirm={handleCancelConfirm}
                onCancel={handleCancelModalClose}
            />

        </DashboardLayout >
    );
}
