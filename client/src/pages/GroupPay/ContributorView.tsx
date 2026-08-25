import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Target, CheckCircle2, Mail, User, CreditCard, ArrowRight, ArrowLeftRight, ShieldCheck, Loader2, Lock, KeyRound, Building2, Wallet, Copy, Star, Gift, Zap, PauseCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import ForgotPassword from "@/pages/Auth/components/ForgotPassword";
import { Label } from "@/components/ui/label";
import { PremiumDatePicker } from "@/components/ui/premium-date-picker";
import { SUPPORTED_CURRENCIES, MOCK_FX_RATES, MITO_FEE_CONFIG, CURRENCY_SYMBOLS } from "./mockData";
import { fetchPublicCampaign, addContribution } from "@/lib/groupPay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campaign } from "./types";
import { useToast } from "@/hooks/use-toast";
import { countries, genderOptions } from "@/data/countries";
import PhoneInput from "@/pages/Auth/components/PhoneInput";
import { checkEmailRegistered, sendCampaignContributorPin, verifyCampaignContributorPin } from "@/lib/requests";
import { DEMO_PAYER_CREDENTIALS } from "@shared/schema";
// @ts-ignore
import logo from "../../assets/rhemito-logo-blue.png";

type AuthStep = "check_email" | "login" | "pin" | "register" | "payment" | "marketing";

export default function ContributorView() {
    const { toast } = useToast();
    const [, params] = useRoute("/contribute/:campaignId");
    const campaignId = params?.campaignId || "";

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [summary, setSummary] = useState({ totalRaised: 0, contributorCount: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isRightSectionLoading, setIsRightSectionLoading] = useState(true);
    const [authStep, setAuthStep] = useState<AuthStep>("check_email");
    // Forgot-password reset flow (replaces the login step while active)
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    // Identifier-first auth state (real API, in sync with Send Invoice / Request Payment)
    const [pinCode, setPinCode] = useState("");
    const [devPin, setDevPin] = useState("");
    const [pinCooldown, setPinCooldown] = useState(0);
    const [authBusy, setAuthBusy] = useState(false);
    const [authError, setAuthError] = useState("");
    // Registration details (dob doubles as the mini-KYC birthdate check)
    const [dob, setDob] = useState<Date | undefined>(undefined);
    const [regCountry, setRegCountry] = useState("");
    const [regGender, setRegGender] = useState("");
    const [regPhoneCode, setRegPhoneCode] = useState("");
    const [regPhoneNumber, setRegPhoneNumber] = useState("");
    const [isPaid, setIsPaid] = useState(false);
    const [wasManualTransfer, setWasManualTransfer] = useState(false);
    const [paymentStep, setPaymentStep] = useState<"method" | "card_details" | "processing_instant" | "manual_transfer" | "manual_transfer_complete">("method");
    const [countdown, setCountdown] = useState(1);
    const [amount, setAmount] = useState("");
    const [selectedCurrency, setSelectedCurrency] = useState<string>("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Server-side lookup so shared links resolve in any browser
                const camp = await fetchPublicCampaign(campaignId);
                if (cancelled) return;
                if (camp) {
                    setCampaign(camp);
                    setSummary(camp.summary);
                }
            } catch (err) {
                console.error("Error loading campaign:", err);
            } finally {
                if (cancelled) return;
                setIsLoading(false);
                // Show right section loader for a bit longer
                setTimeout(() => {
                    setIsRightSectionLoading(false);
                }, 300);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    // PIN resend cooldown ticker
    useEffect(() => {
        const timer = setInterval(() => setPinCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isPaid || paymentStep === "manual_transfer_complete") {
            timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setAuthStep("marketing");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isPaid, paymentStep]);

    const formatCurrency = (val: number, currency: string) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency,
        }).format(val);
    };

    // Calculate FX conversion details
    const getConversionDetails = () => {
        if (!amount || !campaign) return null;
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) return null;

        const effectiveCurrency = selectedCurrency || campaign.currency;
        const rate = MOCK_FX_RATES[effectiveCurrency]?.[campaign.currency] || 1;
        const convertedAmount = amountNum * rate;
        const mitoFee = Math.max(convertedAmount * MITO_FEE_CONFIG.PERCENTAGE, MITO_FEE_CONFIG.MIN_FEE);
        const netAmount = convertedAmount - mitoFee;

        return {
            sendingAmount: amountNum,
            sendingCurrency: effectiveCurrency,
            fxRate: rate,
            convertedAmount,
            mitoFee,
            netAmount,
            receivingCurrency: campaign.currency,
            isSameCurrency: effectiveCurrency === campaign.currency,
        };
    };

    const conversion = getConversionDetails();

    const progress = campaign ? (summary.totalRaised / campaign.targetAmount) * 100 : 0;

    // ─── Identifier-first auth (real API, in sync with Send Invoice / Request Payment) ──

    const deriveNamesFromEmail = (value: string) => {
        const namePart = value.split('@')[0];
        const parts = namePart.split(/[._]/);
        if (parts.length >= 2) {
            setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
            setLastName(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
        } else {
            setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
            setLastName("");
        }
    };

    const requestPin = async (isResend: boolean) => {
        setAuthBusy(true);
        setAuthError("");
        try {
            const result = await sendCampaignContributorPin(campaignId, email.trim().toLowerCase());
            setDevPin(result.devPin ?? "");
            setPinCooldown(result.resendAfterSeconds ?? 60);
            setPinCode("");
            setAuthStep("pin");
            toast({
                title: isResend ? "New PIN Sent" : "Verification PIN Sent",
                description: `A 6-digit PIN has been sent to ${email}. It expires in 10 minutes.`,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "The PIN could not be sent.";
            setAuthError(message);
            toast({ title: "PIN Not Sent", description: message, variant: "destructive" });
        } finally {
            setAuthBusy(false);
        }
    };

    const checkEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authBusy) return;
        const normalized = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            setAuthError("Please enter a valid email address.");
            return;
        }
        setEmail(normalized);
        deriveNamesFromEmail(normalized);
        setAuthBusy(true);
        setAuthError("");
        try {
            const result = await checkEmailRegistered(normalized);
            if (result.registered) {
                setAuthStep("login");
            } else {
                await requestPin(false);
            }
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : "Could not check this email address.");
        } finally {
            setAuthBusy(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authBusy || !password) return;
        setAuthBusy(true);
        setAuthError("");
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.message ?? "Invalid email or password");
            // Use the signed-in profile for the contributor record
            try {
                const me = await fetch("/api/auth/me", { credentials: "include" });
                const meJson = await me.json().catch(() => null);
                if (meJson?.user) {
                    setFirstName(meJson.user.firstName || firstName);
                    setLastName(meJson.user.lastName || lastName);
                }
            } catch { /* profile lookup is best-effort */ }
            toast({ title: "Signed In", description: "You are verified. Please continue with your contribution." });
            setAuthStep("payment");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Sign in failed.";
            setAuthError(message);
            toast({ title: "Sign In Failed", description: message, variant: "destructive" });
        } finally {
            setAuthBusy(false);
        }
    };

    const handlePinVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authBusy || pinCode.length !== 6) return;
        setAuthBusy(true);
        setAuthError("");
        try {
            await verifyCampaignContributorPin(campaignId, email, pinCode);
            toast({ title: "Email Verified", description: "Create your account to continue with the contribution." });
            setRegCountry("");
            setRegGender("");
            setRegPhoneCode("");
            setRegPhoneNumber("");
            setPassword("");
            setConfirmPassword("");
            setAuthStep("register");
        } catch (err) {
            const message = err instanceof Error ? err.message : "The PIN could not be verified.";
            setAuthError(message);
            toast({ title: "Verification Failed", description: message, variant: "destructive" });
        } finally {
            setAuthBusy(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authBusy) return;
        if (!firstName.trim() || !lastName.trim()) { setAuthError("First name and last name are required."); return; }
        if (!regCountry) { setAuthError("Country is required."); return; }
        if (!dob) { setAuthError("Date of birth is required."); return; }
        const today = new Date();
        const adultDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        if (dob > adultDate) { setAuthError("You must be at least 18 years old to use Rhemito."); return; }
        if (!regGender) { setAuthError("Gender is required."); return; }
        if (!regPhoneCode || regPhoneNumber.trim().length < 7) { setAuthError("A valid mobile number is required."); return; }
        if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
            setAuthError("Password must be at least 8 characters with 1 uppercase letter, 1 number and 1 special character.");
            return;
        }
        if (password !== confirmPassword) { setAuthError("Passwords do not match."); return; }
        setAuthBusy(true);
        setAuthError("");
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    accountType: "individual",
                    email,
                    password,
                    confirmPassword,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    country: regCountry,
                    dateOfBirth: dob.toISOString().slice(0, 10),
                    gender: regGender,
                    mobileCode: regPhoneCode,
                    mobileNumber: regPhoneNumber.trim(),
                    // Verified-payer registration: the campaign PIN session
                    // activates the account and signs the contributor in.
                    paymentRequestToken: campaignId,
                    isEmailLink: false,
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.message ?? "Registration failed");
            toast({ title: "Account Created", description: "You are signed in. Please continue with your contribution." });
            setAuthStep("payment");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Registration failed.";
            setAuthError(message);
            toast({ title: "Registration Failed", description: message, variant: "destructive" });
        } finally {
            setAuthBusy(false);
        }
    };

    const handlePay = (method: "instant_bank" | "card") => {
        setIsPaid(true);
        // Save the net amount in campaign currency so progress is tracked correctly relative to goal
        const contributionAmount = conversion ? conversion.netAmount : parseFloat(amount);

        // Persist server-side; totals reconcile from the authoritative response
        // (the server also rejects contributions if the campaign was paused
        // after this page loaded)
        addContribution(campaignId, {
            name: firstName + " " + lastName,
            email,
            amount: contributionAmount,
            paymentMethod: method,
        })
            .then((result) => {
                setSummary(result.summary);
            })
            .catch((err) => {
                toast({
                    title: "Contribution Not Saved",
                    description: err instanceof Error ? err.message : "Your payment went through but we could not update the campaign totals.",
                    variant: "destructive",
                });
            });

        setPaymentStep("method");
    };

    const handleInstantPay = () => {
        setPaymentStep("processing_instant");
        setTimeout(() => {
            handlePay("instant_bank");
        }, 500);
    };

    const handleManualTransferMade = () => {
        // Save the net amount in campaign currency; recorded server-side as
        // "pending" until the creator confirms the transfer arrived.
        const contributionAmount = conversion ? conversion.netAmount : parseFloat(amount);

        addContribution(campaignId, {
            name: firstName + " " + lastName,
            email,
            amount: contributionAmount,
            paymentMethod: "manual_transfer",
        }).catch((err) => {
            toast({
                title: "Transfer Not Logged",
                description: err instanceof Error ? err.message : "We could not record your transfer. Please contact the campaign creator so your contribution is not missed.",
                variant: "destructive",
            });
        });

        setWasManualTransfer(true);
        setPaymentStep("manual_transfer_complete");
    };

    const PaymentMethodRow = ({ icon: Icon, title, subtitle, onClick, isSelected = false }: any) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left group bg-white ${isSelected
                ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500"
                : "border-slate-200 hover:border-blue-500 hover:bg-slate-50 hover:shadow-md"
                }`}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected
                ? "bg-blue-100 text-blue-600"
                : "bg-slate-100/60 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 border border-slate-100"
                }`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
                <p className={`font-semibold text-base mb-0.5 ${isSelected ? "text-blue-700" : "text-slate-900 group-hover:text-blue-700"}`}>
                    {title}
                </p>
                <p className={`text-sm ${isSelected ? "text-blue-600/80" : "text-slate-500"}`}>
                    {subtitle}
                </p>
            </div>
        </button>
    );

    // Full-screen loader only used until campaign data is available
    if (isLoading && !campaign) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-8 relative z-10"
                >
                    <div className="w-24 h-24 md:w-32 md:h-32 relative">
                        <img
                            src={logo}
                            alt="Mito.Money"
                            className="w-full h-full object-contain filter drop-shadow-xl"
                        />
                        <motion.div
                            className="absolute -inset-4 border-4 border-blue-600/10 rounded-full"
                            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-5xl mb-4 flex items-center justify-center relative z-20">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
                            <img src={logo} alt="Mito Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight font-display">Mito.Money</span>
                    </div>
                </div>
                <Card className="max-w-md w-full" data-testid="campaign-not-found">
                    <CardContent className="py-12 text-center space-y-2">
                        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-2">
                            <Target className="w-7 h-7 text-slate-400" />
                        </div>
                        <p className="text-base font-semibold text-slate-800">Campaign not found</p>
                        <p className="text-sm text-muted-foreground leading-6">
                            This contribution link is not valid or the campaign has ended. Please check the link you
                            received or contact the campaign creator.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:py-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />

            {/* Logo Header */}
            <div className="w-full max-w-5xl mb-4 flex items-center justify-start relative z-20">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
                        <img src={logo} alt="Mito Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight font-display">Mito.Money</span>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-5xl relative z-10"
            >
                <Card className="border-none shadow-xl shadow-slate-200/60 bg-white/80 backdrop-blur-xl overflow-hidden">
                    <div className="grid md:grid-cols-2">
                        {/* Left Column: Campaign Summary */}
                        <div className="p-6 md:p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden flex flex-col justify-between hidden md:flex">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-x-20 -translate-y-20" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-x-20 translate-y-20" />

                            <div className="relative z-10 space-y-6">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-4">
                                        <Users className="w-3 h-3" />
                                        <span>Funding Campaign</span>
                                    </div>
                                    <h1 className="text-2xl font-bold mb-2 tracking-tight">{campaign.name}</h1>
                                    <p className="text-blue-200/80 leading-relaxed mb-4">{campaign.description}</p>

                                    <div className="flex items-center gap-2 pt-2 text-blue-100/60">
                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/20 flex items-center justify-center">
                                            <User className="w-3 h-3" />
                                        </div>
                                        <p className="text-xs font-medium">Requested by <span className="text-white font-bold">{campaign.creatorName}</span></p>
                                    </div>
                                </div>

                                {/* Contribution Preview - shows when amount is entered */}


                                <div className="space-y-6 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Raised So Far</p>
                                            <p className="text-3xl font-bold tracking-tight">{formatCurrency(summary.totalRaised, campaign.currency)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Goal</p>
                                            <p className="text-xl font-medium opacity-80">{formatCurrency(campaign.targetAmount, campaign.currency)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(progress, 100)}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 shadow-[0_0_15px_rgba(96,165,250,0.5)]"
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs font-medium uppercase tracking-tighter">
                                            <span className="text-blue-300">{progress.toFixed(0)}% Funded</span>
                                            <span className="text-blue-300">{summary.contributorCount} Contributors</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-blue-200">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Secure Funding</p>
                                            <p className="text-sm opacity-80">All contributions are processed securely.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 mt-auto pt-8">
                                <p className="text-blue-200/60 text-xs flex items-center gap-2">
                                    Powered by <span className="font-bold text-white opacity-80 uppercase tracking-widest text-[10px]">Mito.Money</span>
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Flow */}
                        <div className="p-8 md:p-10 bg-white/50 relative min-h-[450px] flex flex-col justify-center">
                            <AnimatePresence mode="wait">
                                {isRightSectionLoading ? (
                                    <motion.div
                                        key="right-loader"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col items-center gap-6"
                                    >
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-full border-4 border-slate-100" />
                                            <Loader2 className="w-14 h-14 text-blue-600 animate-spin absolute top-0 left-0" />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Securing Connection</h3>
                                            <p className="text-slate-500 text-sm font-medium">Entering Campaign Workspace...</p>
                                        </div>
                                    </motion.div>
                                ) : campaign.status !== "active" ? (
                                    <motion.div
                                        key="not-accepting"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex flex-col items-center text-center space-y-4 py-8"
                                        data-testid="campaign-not-accepting"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                                            <PauseCircle className="w-7 h-7 text-amber-600" />
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                                                {campaign.status === "paused" ? "Contributions Paused" : "Campaign Unavailable"}
                                            </h2>
                                            <p className="text-sm text-slate-500 leading-6 max-w-xs mx-auto">
                                                {campaign.status === "paused"
                                                    ? "This campaign is currently paused and is not accepting contributions. Please check back later or contact the campaign creator."
                                                    : "This campaign is no longer accepting contributions."}
                                            </p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <>
                                        {authStep === 'check_email' && (
                                            <motion.div
                                                key="check_email"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-2xl font-bold text-slate-900">Make a Contribution</h2>
                                                    <p className="text-slate-500">Enter your email and the amount you'd like to contribute.</p>
                                                </div>

                                                <form onSubmit={checkEmail} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="email">Email Address</Label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                            <Input
                                                                id="email"
                                                                type="email"
                                                                placeholder="name@example.com"
                                                                className="pl-10 h-11"
                                                                value={email}
                                                                onChange={(e) => setEmail(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="amount">Contribution Amount</Label>
                                                        <div className="flex gap-2">
                                                            <Select
                                                                value={selectedCurrency || campaign.currency}
                                                                onValueChange={setSelectedCurrency}
                                                            >
                                                                <SelectTrigger className="w-24 h-11 shrink-0">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {SUPPORTED_CURRENCIES.map(curr => (
                                                                        <SelectItem key={curr} value={curr}>
                                                                            {CURRENCY_SYMBOLS[curr]} {curr}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-3 top-3 text-slate-500 font-medium">
                                                                    {CURRENCY_SYMBOLS[selectedCurrency || campaign.currency]}
                                                                </span>
                                                                <Input
                                                                    id="amount"
                                                                    type="number"
                                                                    min="1"
                                                                    step="0.01"
                                                                    placeholder="50.00"
                                                                    className="pl-8 h-11"
                                                                    value={amount}
                                                                    onChange={(e) => setAmount(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Conversion Breakdown - shown when different currency selected */}
                                                    {conversion && (
                                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 space-y-3">
                                                            <div className="flex items-center gap-2 text-blue-700">
                                                                <ArrowLeftRight className="w-4 h-4" />
                                                                <span className="text-sm font-semibold">Your Contribution Preview</span>
                                                            </div>
                                                            <div className="text-xs space-y-2 text-slate-600">
                                                                <div className="flex justify-between">
                                                                    <span>You send:</span>
                                                                    <span className="font-bold text-slate-900">{formatCurrency(conversion.sendingAmount, conversion.sendingCurrency)}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>FX Rate:</span>
                                                                    <span className="text-slate-700">1 {conversion.sendingCurrency} = {conversion.fxRate.toFixed(4)} {conversion.receivingCurrency}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Mito Fee ({(MITO_FEE_CONFIG.PERCENTAGE * 100).toFixed(1)} %):</span>
                                                                    <span className="text-amber-600">-{formatCurrency(conversion.mitoFee, conversion.receivingCurrency)}</span>
                                                                </div>
                                                                <div className="flex justify-between pt-2 border-t border-blue-200">
                                                                    <span className="font-semibold text-slate-800">Requester receives:</span>
                                                                    <span className="font-bold text-green-600">{formatCurrency(conversion.netAmount, conversion.receivingCurrency)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <Button type="submit" disabled={!amount || !email} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-lg gap-2">
                                                        Continue <ArrowRight className="w-5 h-5" />
                                                    </Button>
                                                </form>

                                                {/* Prototype affordance: which email logs in vs registers */}
                                                <div className="text-[11px] text-center text-slate-500 p-3 border border-dashed rounded-xl bg-slate-50/50" data-testid="demo-login-hint">
                                                    <p className="font-bold uppercase tracking-wider mb-1.5 text-slate-400 text-[10px]">Prototype tip</p>
                                                    Registered demo email —{" "}
                                                    <span className="font-mono text-blue-600">{DEMO_PAYER_CREDENTIALS.email}</span> (password{" "}
                                                    <span className="font-mono text-blue-600">{DEMO_PAYER_CREDENTIALS.password}</span>) logs straight in.
                                                    Any other email verifies a PIN and registers a new contributor.
                                                </div>
                                            </motion.div>
                                        )}

                                        {authStep === 'login' && !showForgotPassword && (
                                            <motion.div
                                                key="login"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-2xl font-bold text-slate-900">Welcome back!</h2>
                                                    <p className="text-slate-500">Please enter your password to continue.</p>
                                                </div>

                                                <div className="p-3.5 bg-blue-50 rounded-2xl flex items-center gap-3 border border-blue-100/50">
                                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-100 overflow-hidden shadow-sm">
                                                        {email.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="font-medium text-slate-900 truncate">{email}</p>
                                                        <p className="text-xs text-blue-600 cursor-pointer hover:underline font-semibold" onClick={() => setAuthStep('check_email')}>Not you? Change account</p>
                                                    </div>
                                                </div>

                                                <form onSubmit={handleLogin} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label htmlFor="password">Password</Label>
                                                            <button type="button" className="text-sm font-semibold text-blue-600 hover:underline" onClick={() => setShowForgotPassword(true)} data-testid="button-forgot-password">Forgot password?</button>
                                                        </div>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                            <PasswordInput id="password" placeholder="••••••••" className="pl-10 h-11" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus data-testid="input-payer-password" />
                                                        </div>
                                                    </div>
                                                    {authError && <p className="text-xs text-red-500 font-medium" data-testid="error-auth">{authError}</p>}
                                                    <Button type="submit" disabled={authBusy || !password} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-lg">
                                                        {authBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                        Log in and Continue
                                                    </Button>
                                                </form>
                                            </motion.div>
                                        )}

                                        {authStep === 'login' && showForgotPassword && (
                                            <motion.div
                                                key="forgot_password"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-4"
                                                data-testid="contributor-forgot-password"
                                            >
                                                <ForgotPassword
                                                    initialEmail={email}
                                                    onCancel={() => setShowForgotPassword(false)}
                                                    onResetComplete={() => {
                                                        setShowForgotPassword(false);
                                                        setAuthStep("payment");
                                                    }}
                                                    cancelLabel="Back to login"
                                                    successToast={{
                                                        title: "Password Successfully Reset",
                                                        description: "Please continue your payment journey.",
                                                    }}
                                                />
                                            </motion.div>
                                        )}

                                        {authStep === 'pin' && (
                                            <motion.div
                                                key="pin"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                                data-testid="payer-auth-pin"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-2xl font-bold text-slate-900">Verify your email</h2>
                                                    <p className="text-slate-500">We've sent a 6-digit PIN to <span className="font-semibold text-slate-900">{email}</span> <button type="button" className="text-blue-600 font-medium hover:underline text-sm ml-1" onClick={() => setAuthStep('check_email')}>Change email</button></p>
                                                </div>

                                                {devPin && (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2" data-testid="dev-pin-hint">
                                                        <p className="text-xs text-amber-700">
                                                            <span className="font-semibold">Prototype tip:</span> Use PIN{" "}
                                                            <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{devPin}</span>
                                                        </p>
                                                    </div>
                                                )}

                                                <form onSubmit={handlePinVerify} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="pin-code">6-digit PIN</Label>
                                                        <div className="relative">
                                                            <KeyRound className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                            <Input
                                                                id="pin-code"
                                                                type="text"
                                                                maxLength={6}
                                                                inputMode="numeric"
                                                                placeholder="000000"
                                                                className="pl-10 h-11 tracking-widest text-lg font-bold"
                                                                value={pinCode}
                                                                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                                                                required
                                                                autoFocus
                                                                data-testid="input-pin-code"
                                                            />
                                                        </div>
                                                    </div>
                                                    {authError && <p className="text-xs text-red-500 font-medium" data-testid="error-auth">{authError}</p>}
                                                    <Button type="submit" disabled={authBusy || pinCode.length !== 6} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-lg">
                                                        {authBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                        Verify & Continue
                                                    </Button>
                                                </form>
                                                <p className="text-sm text-center text-slate-500">
                                                    {pinCooldown > 0 ? (
                                                        <>Didn't receive the PIN? Resend available in <span className="font-mono font-medium">{pinCooldown}s</span></>
                                                    ) : (
                                                        <>Didn't receive the PIN? <button type="button" className="text-blue-600 font-bold hover:underline" onClick={() => requestPin(true)} disabled={authBusy} data-testid="button-resend-pin">{authBusy ? "Sending…" : "Resend"}</button></>
                                                    )}
                                                </p>
                                            </motion.div>
                                        )}

                                        {authStep === 'register' && (
                                            <motion.div
                                                key="register"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                                data-testid="payer-auth-register"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
                                                    <p className="text-slate-500">Your email is verified. Complete your details to continue with the contribution.</p>
                                                </div>

                                                <div className="p-3.5 bg-emerald-50 rounded-2xl flex items-center gap-3 border border-emerald-100/50">
                                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 font-bold border border-emerald-100 overflow-hidden shadow-sm">
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-900 truncate" data-testid="payer-email-chip">{email}</p>
                                                </div>

                                                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="firstName">First Name</Label>
                                                            <Input id="firstName" placeholder="Jane" className="h-11" required value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-reg-first-name" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="lastName">Last Name</Label>
                                                            <Input id="lastName" placeholder="Doe" className="h-11" required value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-reg-last-name" />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Country</Label>
                                                            <Select value={regCountry} onValueChange={(code) => {
                                                                setRegCountry(code);
                                                                const match = countries.find((c) => c.code === code);
                                                                if (match) setRegPhoneCode(match.dialCode);
                                                            }}>
                                                                <SelectTrigger data-testid="select-register-country" className="h-11 bg-white"><SelectValue placeholder="Select country" /></SelectTrigger>
                                                                <SelectContent className="max-h-64">
                                                                    {countries.map((c) => (
                                                                        <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2 flex flex-col">
                                                            <Label>Date of Birth</Label>
                                                            <PremiumDatePicker date={dob} setDate={setDob} />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Gender</Label>
                                                            <Select value={regGender} onValueChange={setRegGender}>
                                                                <SelectTrigger data-testid="select-register-gender" className="h-11 bg-white"><SelectValue placeholder="Select gender" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {genderOptions.map((g) => (
                                                                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Mobile Number</Label>
                                                            <PhoneInput
                                                                codeValue={regPhoneCode}
                                                                numberValue={regPhoneNumber}
                                                                onCodeChange={setRegPhoneCode}
                                                                onNumberChange={setRegPhoneNumber}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="new-password">Create Password</Label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                            <PasswordInput id="new-password" placeholder="Min. 8 characters" className="pl-10 h-11" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-reg-password" />
                                                        </div>
                                                        <p className="text-[11px] text-slate-400">At least 8 characters with 1 uppercase letter, 1 number and 1 special character.</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="confirm-password">Confirm Password</Label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                            <PasswordInput id="confirm-password" placeholder="Re-enter password" className="pl-10 h-11" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required data-testid="input-reg-confirm-password" />
                                                        </div>
                                                    </div>

                                                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex gap-3">
                                                        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                                                        <p className="text-xs text-blue-700 leading-relaxed font-medium">Your data is encrypted and used only for regulatory compliance. We never share your personal info.</p>
                                                    </div>

                                                    {authError && <p className="text-xs text-red-500 font-bold" data-testid="error-auth">{authError}</p>}
                                                    <Button type="submit" disabled={authBusy} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-lg" data-testid="button-register-pay">
                                                        {authBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                        Create Account & Continue
                                                    </Button>
                                                </form>
                                            </motion.div>
                                        )}

                                        {authStep === 'payment' && !isPaid && (
                                            <motion.div
                                                key="payment"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-2xl font-bold text-slate-900">
                                                        {paymentStep === "method" && "How would you like to pay?"}
                                                        {paymentStep === "card_details" && "Enter Card Details"}
                                                        {paymentStep === "processing_instant" && "Connecting to Bank"}
                                                        {paymentStep === "manual_transfer" && "Bank Transfer Details"}
                                                    </h2>
                                                    <p className="text-slate-500">
                                                        {paymentStep === "method" && "Choose a secure payment method for your contribution."}
                                                        {paymentStep === "card_details" && "We accept all major credit and debit cards."}
                                                        {paymentStep === "processing_instant" && "Please wait while we establish a secure connection."}
                                                        {paymentStep === "manual_transfer" && "Transfer directly from your banking app."}
                                                        {paymentStep === "manual_transfer_complete" && "Thank You"}
                                                    </p>
                                                </div>

                                                <div className="pt-2">
                                                    {paymentStep === "method" ? (
                                                        <div className="space-y-3">
                                                            <PaymentMethodRow
                                                                icon={Building2}
                                                                title="Instant Bank Transfer"
                                                                subtitle={`Pay ${formatCurrency(conversion?.sendingAmount || parseFloat(amount), conversion?.sendingCurrency || campaign.currency)} via Open Banking`}
                                                                onClick={handleInstantPay}
                                                            />
                                                            <PaymentMethodRow
                                                                icon={CreditCard}
                                                                title="Debit/Credit Card"
                                                                subtitle="Support for Visa, Mastercard, and Amex"
                                                                onClick={() => setPaymentStep("card_details")}
                                                            />
                                                            <PaymentMethodRow
                                                                icon={ArrowRight}
                                                                title="Manual Bank Transfer"
                                                                subtitle="Get our bank details to send offline"
                                                                onClick={() => setPaymentStep("manual_transfer")}
                                                            />
                                                        </div>
                                                    ) : paymentStep === "card_details" ? (
                                                        <div className="space-y-6">
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <Label>Card Number</Label>
                                                                    <Input placeholder="0000 0000 0000 0000" className="h-11 border-slate-200" />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label>Expiry Date</Label>
                                                                        <Input placeholder="MM / YY" className="h-11 border-slate-200" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label>CVV</Label>
                                                                        <Input placeholder="123" className="h-11 border-slate-200" />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-3">
                                                                <Button variant="outline" className="flex-1 h-11" onClick={() => setPaymentStep("method")}>Back</Button>
                                                                <Button className="flex-[2] h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handlePay("card")}>Contribute {formatCurrency(conversion?.sendingAmount || parseFloat(amount), conversion?.sendingCurrency || campaign.currency)}</Button>
                                                            </div>
                                                        </div>
                                                    ) : paymentStep === "processing_instant" ? (
                                                        <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                                                            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                                                            <p className="font-semibold text-slate-700">Connecting to your bank securely...</p>
                                                        </div>
                                                    ) : paymentStep === "manual_transfer" ? (
                                                        <div className="space-y-6">
                                                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                                                                <p className="text-sm text-blue-700 font-medium">
                                                                    An email has been sent to your email ID <span className="font-bold">{email}</span> containing the Beneficiary Bank Details.
                                                                </p>
                                                                <p className="text-sm text-blue-700 font-medium">Please transfer exactly <span className="font-bold">{formatCurrency(conversion?.sendingAmount || parseFloat(amount), conversion?.sendingCurrency || campaign.currency)}</span> to the details below:</p>

                                                                <div className="space-y-3 pt-2">
                                                                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                                                                        <span className="text-sm text-slate-500 font-medium">Bank Name</span>
                                                                        <span className="font-bold text-slate-900">Mito.Money Ltd</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                                                                        <span className="text-sm text-slate-500 font-medium">Sort Code</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-900">12-34-56</span>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                                                                        <span className="text-sm text-slate-500 font-medium">Account Number</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-900">12345678</span>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-sm text-slate-500 font-medium">Reference</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-900 bg-blue-100 px-2 py-0.5 rounded tracking-widest">{campaignId.substring(0, 8).toUpperCase()}</span>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-3">
                                                                <Button variant="outline" className="flex-1 h-11" onClick={() => setPaymentStep("method")}>Back</Button>
                                                                <Button className="flex-[2] h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl" onClick={handleManualTransferMade}>I Have Made the Transfer</Button>
                                                            </div>
                                                        </div>
                                                    ) : paymentStep === "manual_transfer_complete" ? (
                                                        <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                                                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                                                                <CheckCircle2 className="w-8 h-8 text-blue-600" />
                                                            </div>
                                                            <div className="space-y-2 px-6">
                                                                <h3 className="text-xl font-bold text-slate-900">Transfer Initiated</h3>
                                                                <p className="text-slate-500 text-sm">
                                                                    Thank you. We will verify your transfer shortly and notify you via email once completed.
                                                                </p>
                                                            </div>

                                                            <div className="space-y-2 pt-2">
                                                                <p className="text-xs font-medium text-blue-600 animate-pulse">
                                                                    Redirecting you to exclusive offers in {countdown}s...
                                                                </p>
                                                                <div className="h-1 w-24 bg-slate-100 rounded-full mx-auto overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                                                                        style={{ width: `${(countdown / 1) * 100}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full max-w-[200px]"
                                                                onClick={() => {
                                                                    setPaymentStep("method");
                                                                }}
                                                            >
                                                                Back to Methods
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        )}

                                        {authStep === 'marketing' && (
                                            <motion.div
                                                key="success"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="space-y-6"
                                            >
                                                {!wasManualTransfer && (
                                                    <div className="text-center space-y-4">
                                                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm border border-green-200/50">
                                                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h2 className="text-3xl font-bold text-slate-900">Payment Received</h2>
                                                            <p className="text-slate-500">Thanks for funding this collection</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {wasManualTransfer && (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                                            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-amber-900 font-bold text-sm">Transfer Pending Verification</p>
                                                            <p className="text-amber-700 text-xs">We'll notify you once your transfer is confirmed</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-4 text-center shadow-inner">
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Amount Contributed</p>
                                                    <p className="text-4xl font-bold text-blue-600 tracking-tight">{formatCurrency(conversion?.sendingAmount || parseFloat(amount), conversion?.sendingCurrency || campaign.currency)}</p>
                                                    <p className="text-sm font-medium text-slate-500 mt-2">
                                                        Requester receives: <span className="text-green-600 font-bold">{formatCurrency(conversion?.netAmount || (parseFloat(amount) - (parseFloat(amount) * MITO_FEE_CONFIG.PERCENTAGE)), conversion?.receivingCurrency || campaign.currency)}</span>
                                                    </p>
                                                </div>


                                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                                                        <Star className="w-3 h-3 fill-indigo-600" />
                                                        <span>Special Reward</span>
                                                    </div>
                                                    <div className="group relative bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-3xl text-white shadow-xl shadow-indigo-900/20">
                                                        <Gift className="w-8 h-8 opacity-20 absolute top-4 right-4" />
                                                        <h3 className="font-bold text-xl mb-2">Claim Your Bonus</h3>
                                                        <p className="text-indigo-100 text-sm mb-4">Open a Mito account today and get <span className="text-white font-bold">100% off fees</span> on your next transfer.</p>
                                                        <Button className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl h-10 w-full shadow-lg">Open Free Account</Button>
                                                    </div>
                                                </div>

                                                <p className="text-[10px] text-center text-slate-400">A confirmation receipt has been sent to {email}</p>
                                            </motion.div>
                                        )}
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div >
                </Card >
            </motion.div >

            {/* Footer */}
            < div className="mt-6 opacity-40" >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 text-center">Powered by Mito.Money</p>
            </div >
        </div >
    );
}
