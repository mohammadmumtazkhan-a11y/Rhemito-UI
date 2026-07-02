import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
    ArrowLeft, Check, CreditCard, Building2, Wallet, Gift,
    ChevronRight, X, Smartphone, Battery, Wifi, Signal,
    Lock, ArrowRight, CheckCircle2, Copy, Search, Plus, Info, Edit2, Landmark,
    ArrowDown, ChevronDown, User, Briefcase, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock Data
const EXCHANGE_RATE = 2025.50;

const recentRecipients = [
    { 
        id: "1", 
        name: "Akshita Gupta", 
        bankName: "Barclays", 
        accountNumber: "12345678", 
        sortCode: "20-45-67", 
        initials: "AG", 
        color: "bg-blue-100 text-blue-600", 
        country: "UK", 
        currency: "GBP",
        recipientType: "individual" as "individual" | "business",
        deliveryMethodChoice: "direct_bank" as "direct_bank" | "swift",
        address: "42 London Road",
        city: "London",
        stateProvince: "Greater London",
        postcode: "SE1 6LN",
        relationship: "Family",
        nickname: "Akshita",
        reason: "Family Support",
        narration: "Rent assistance"
    },
    { 
        id: "2", 
        name: "Sarah Chen", 
        bankName: "Access Bank", 
        accountNumber: "87654321", 
        sortCode: "30-20-10", 
        initials: "SC", 
        color: "bg-purple-100 text-purple-600", 
        country: "Nigeria", 
        currency: "NGN",
        recipientType: "individual" as "individual" | "business",
        deliveryMethodChoice: "direct_bank" as "direct_bank" | "swift",
        address: "7b Admiralty Way",
        city: "Lagos",
        stateProvince: "Lagos State",
        postcode: "101233",
        relationship: "Friend",
        nickname: "Sarah",
        reason: "Family Support",
        narration: "Birthday present"
    },
    { 
        id: "3", 
        name: "David Okonkwo", 
        bankName: "GTBank", 
        accountNumber: "11223344", 
        sortCode: "10-10-10", 
        initials: "DO", 
        color: "bg-green-100 text-green-600", 
        country: "Nigeria", 
        currency: "NGN",
        recipientType: "business" as "individual" | "business",
        deliveryMethodChoice: "swift" as "direct_bank" | "swift",
        address: "15 Marina Street",
        city: "Lagos",
        stateProvince: "Lagos State",
        postcode: "100211",
        relationship: "Business Partner",
        nickname: "David Business",
        reason: "Services Paid",
        narration: "Invoice payment"
    },
    { 
        id: "4", 
        name: "Hans Müller", 
        bankName: "Deutsche Bank", 
        accountNumber: "99887766", 
        sortCode: "40-40-40", 
        initials: "HM", 
        color: "bg-orange-100 text-orange-600", 
        country: "Germany", 
        currency: "EUR",
        recipientType: "individual" as "individual" | "business",
        deliveryMethodChoice: "swift" as "direct_bank" | "swift",
        address: "Kaiserstraße 12",
        city: "Frankfurt",
        stateProvince: "Hessen",
        postcode: "60311",
        relationship: "Other",
        nickname: "Hans",
        reason: "Education",
        narration: "Semester fees"
    },
    { 
        id: "5", 
        name: "James Peterson", 
        bankName: "Chase Bank", 
        accountNumber: "55667788", 
        sortCode: "50-50-50", 
        initials: "JP", 
        color: "bg-teal-100 text-teal-600", 
        country: "United States", 
        currency: "USD",
        recipientType: "individual" as "individual" | "business",
        deliveryMethodChoice: "swift" as "direct_bank" | "swift",
        address: "500 Park Avenue",
        city: "New York",
        stateProvince: "New York",
        postcode: "10022",
        relationship: "Family",
        nickname: "Uncle James",
        reason: "Family Support",
        narration: "Support allowance"
    },
];

const PROMO_CODES: Record<string, number> = {
    "WELCOME": 5,
    "SAVE20": 20,
    "BOOSTRATE": 10,
};

export default function MobilePaymentSimulator() {
    const [, setLocation] = useLocation();
    const [currentStep, setCurrentStep] = useState(1);
    const [direction, setDirection] = useState(1); // 1 for next, -1 for back

    // Scroll detection states & refs
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);

    // Account verification popup states
    const [isNewRecipientCreated, setIsNewRecipientCreated] = useState(false);
    const [showVerificationPopup, setShowVerificationPopup] = useState(false);

    // Recipients State
    const [recipients, setRecipients] = useState(recentRecipients);
    const [selectedRecipient, setSelectedRecipient] = useState(recentRecipients[0]);

    // Create Recipient States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRecipientType, setNewRecipientType] = useState<"individual" | "business">("individual");
    const [newDeliveryMethod, setNewDeliveryMethod] = useState<"direct_bank" | "swift">("direct_bank");
    const [newName, setNewName] = useState(""); // First Name
    const [newLastName, setNewLastName] = useState("");
    const [newCompanyName, setNewCompanyName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [newCity, setNewCity] = useState("");
    const [newStateProvince, setNewStateProvince] = useState("Select-");
    const [newPostcode, setNewPostcode] = useState("");
    const [newRelationship, setNewRelationship] = useState("Select-");
    const [newNickname, setNewNickname] = useState("");
    const [newReason, setNewReason] = useState("Select-");
    const [newNarration, setNewNarration] = useState("");
    const [newBank, setNewBank] = useState("");
    const [newAcc, setNewAcc] = useState("");
    const [newSort, setNewSort] = useState("");

    // Manual Bank Transfer States
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showBankTransferScreen, setShowBankTransferScreen] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(1800);

    // Edit Recipient States
    const [showEditModal, setShowEditModal] = useState(false);
    const [editRecipientType, setEditRecipientType] = useState<"individual" | "business">("individual");
    const [editDeliveryMethod, setEditDeliveryMethod] = useState<"direct_bank" | "swift">("direct_bank");
    const [editName, setEditName] = useState(""); // First Name
    const [editLastName, setEditLastName] = useState("");
    const [editCompanyName, setEditCompanyName] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [editCity, setEditCity] = useState("");
    const [editStateProvince, setEditStateProvince] = useState("Select-");
    const [editPostcode, setEditPostcode] = useState("");
    const [editRelationship, setEditRelationship] = useState("Select-");
    const [editNickname, setEditNickname] = useState("");
    const [editReason, setEditReason] = useState("Select-");
    const [editNarration, setEditNarration] = useState("");
    const [editBank, setEditBank] = useState("");
    const [editAcc, setEditAcc] = useState("");
    const [editSort, setEditSort] = useState("");

    // Form States - Step 1
    const [sendAmount, setSendAmount] = useState("500.00");
    const [receiveAmount, setReceiveAmount] = useState("1,012,750.00");
    const [deliveryMethod, setDeliveryMethod] = useState("bank_deposit");
    const [searchQuery, setSearchQuery] = useState("");

    // Form States - Step 2 (Prefilled from selected recipient)
    const [recipientType, setRecipientType] = useState<"individual" | "business">("individual");
    const [deliveryMethodChoice, setDeliveryMethodChoice] = useState<"direct_bank" | "swift">("direct_bank");
    const [firstName, setFirstName] = useState("Akshita");
    const [lastName, setLastName] = useState("Gupta");
    const [companyName, setCompanyName] = useState("");
    const [address, setAddress] = useState("42 London Road");
    const [city, setCity] = useState("London");
    const [stateProvince, setStateProvince] = useState("Greater London");
    const [postcode, setPostcode] = useState("SE1 6LN");
    const [relationship, setRelationship] = useState("Family");
    const [nickname, setNickname] = useState("Akshita");
    const [reason, setReason] = useState("Family Support");
    const [narration, setNarration] = useState("Rent assistance");
    const [bankName, setBankName] = useState("Barclays");
    const [accountNumber, setAccountNumber] = useState("12345678");
    const [sortCode, setSortCode] = useState("20-45-67");

    // Form States - Step 3
    const [useBonus, setUseBonus] = useState(false);
    const [bonusType, setBonusType] = useState<"pay_less" | "send_more">("pay_less");
    const [promoCode, setPromoCode] = useState("");
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState("manual_transfer");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync form values when selected recipient changes
    useEffect(() => {
        if (selectedRecipient) {
            const isBiz = selectedRecipient.recipientType === "business";
            setRecipientType(isBiz ? "business" : "individual");
            setDeliveryMethodChoice(selectedRecipient.deliveryMethodChoice || "direct_bank");
            
            if (isBiz) {
                setFirstName("");
                setLastName("");
                setCompanyName(selectedRecipient.name || "");
            } else {
                const names = selectedRecipient.name.split(" ");
                setFirstName(names[0] || "");
                setLastName(names[1] || "");
                setCompanyName("");
            }
            
            setAddress(selectedRecipient.address || "");
            setCity(selectedRecipient.city || "");
            setStateProvince(selectedRecipient.stateProvince || "Select-");
            setPostcode(selectedRecipient.postcode || "");
            setRelationship(selectedRecipient.relationship || "Select-");
            setNickname(selectedRecipient.nickname || "");
            setReason(selectedRecipient.reason || "Select-");
            setNarration(selectedRecipient.narration || "");
            setBankName(selectedRecipient.bankName);
            setAccountNumber(selectedRecipient.accountNumber);
            setSortCode(selectedRecipient.sortCode);
        }
    }, [selectedRecipient]);

    const handleCreateRecipient = () => {
        const isBiz = newRecipientType === "business";
        const displayName = isBiz ? newCompanyName.trim() : `${newName.trim()} ${newLastName.trim()}`.trim();
        
        if (!displayName || !newBank.trim() || !newAcc.trim() || !newSort.trim()) return;
        
        const initials = isBiz 
            ? displayName.slice(0, 2).toUpperCase()
            : newName.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
            
        const colors = [
            "bg-blue-100 text-blue-600",
            "bg-purple-100 text-purple-600",
            "bg-green-100 text-green-600",
            "bg-orange-100 text-orange-600",
            "bg-teal-100 text-teal-600",
            "bg-pink-100 text-pink-600",
            "bg-indigo-100 text-indigo-600"
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const newRec = {
            id: (recipients.length + 1).toString(),
            name: displayName,
            bankName: newBank.trim(),
            accountNumber: newAcc.trim(),
            sortCode: newSort.trim(),
            initials,
            color: randomColor,
            country: "UK",
            currency: "GBP",
            recipientType: newRecipientType,
            deliveryMethodChoice: newDeliveryMethod,
            address: newAddress.trim(),
            city: newCity.trim(),
            stateProvince: newStateProvince,
            postcode: newPostcode.trim(),
            relationship: newRelationship,
            nickname: newNickname.trim(),
            reason: newReason,
            narration: newNarration.trim()
        };
        
        setRecipients([newRec, ...recipients]);
        setSelectedRecipient(newRec);
        setIsNewRecipientCreated(true);
        setShowCreateModal(false);
        
        // Clear form
        setNewName("");
        setNewLastName("");
        setNewCompanyName("");
        setNewAddress("");
        setNewCity("");
        setNewStateProvince("Select-");
        setNewPostcode("");
        setNewRelationship("Select-");
        setNewNickname("");
        setNewReason("Select-");
        setNewNarration("");
        setNewBank("");
        setNewAcc("");
        setNewSort("");
    };

    const handleOpenEditModal = () => {
        if (!selectedRecipient) return;
        const isBiz = selectedRecipient.recipientType === "business";
        setEditRecipientType(isBiz ? "business" : "individual");
        setEditDeliveryMethod(selectedRecipient.deliveryMethodChoice || "direct_bank");
        if (isBiz) {
            setEditName("");
            setEditLastName("");
            setEditCompanyName(selectedRecipient.name);
        } else {
            const names = selectedRecipient.name.split(" ");
            setEditName(names[0] || "");
            setEditLastName(names[1] || "");
            setEditCompanyName("");
        }
        setEditAddress(selectedRecipient.address || "");
        setEditCity(selectedRecipient.city || "");
        setEditStateProvince(selectedRecipient.stateProvince || "Select-");
        setEditPostcode(selectedRecipient.postcode || "");
        setEditRelationship(selectedRecipient.relationship || "Select-");
        setEditNickname(selectedRecipient.nickname || "");
        setEditReason(selectedRecipient.reason || "Select-");
        setEditNarration(selectedRecipient.narration || "");
        setEditBank(selectedRecipient.bankName);
        setEditAcc(selectedRecipient.accountNumber);
        setEditSort(selectedRecipient.sortCode);
        setShowEditModal(true);
    };

    const handleSaveRecipient = () => {
        if (!selectedRecipient) return;
        const isBiz = editRecipientType === "business";
        const displayName = isBiz ? editCompanyName.trim() : `${editName.trim()} ${editLastName.trim()}`.trim();
        
        if (!displayName || !editBank.trim() || !editAcc.trim() || !editSort.trim()) return;
        
        const updatedRecipients = recipients.map(r => {
            if (r.id === selectedRecipient.id) {
                const initials = isBiz 
                    ? displayName.slice(0, 2).toUpperCase()
                    : editName.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                return {
                    ...r,
                    name: displayName,
                    bankName: editBank.trim(),
                    accountNumber: editAcc.trim(),
                    sortCode: editSort.trim(),
                    initials,
                    recipientType: editRecipientType,
                    deliveryMethodChoice: editDeliveryMethod,
                    address: editAddress.trim(),
                    city: editCity.trim(),
                    stateProvince: editStateProvince,
                    postcode: editPostcode.trim(),
                    relationship: editRelationship,
                    nickname: editNickname.trim(),
                    reason: editReason,
                    narration: editNarration.trim()
                };
            }
            return r;
        });
        
        setRecipients(updatedRecipients);
        
        const updatedSel = updatedRecipients.find(r => r.id === selectedRecipient.id);
        if (updatedSel) {
            setSelectedRecipient(updatedSel);
        }
        
        setShowEditModal(false);
    };

    // Timer countdown for bank transfer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showBankTransferScreen && timerSeconds > 0) {
            interval = setInterval(() => {
                setTimerSeconds((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showBankTransferScreen, timerSeconds]);

    const formatTimer = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const checkScrollable = () => {
        const el = scrollContainerRef.current;
        if (el) {
            const isScrollable = el.scrollHeight > el.clientHeight;
            const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 15;
            setShowScrollIndicator(isScrollable && !isAtBottom);
        }
    };

    const handleScrollToBottom = () => {
        const el = scrollContainerRef.current;
        if (el) {
            el.scrollTo({
                top: el.scrollHeight,
                behavior: "smooth"
            });
        }
    };

    useEffect(() => {
        const timer = setTimeout(checkScrollable, 100);
        const observer = new MutationObserver(checkScrollable);
        const el = scrollContainerRef.current;
        if (el) {
            observer.observe(el, { childList: true, subtree: true, characterData: true });
        }
        window.addEventListener("resize", checkScrollable);
        return () => {
            clearTimeout(timer);
            observer.disconnect();
            window.removeEventListener("resize", checkScrollable);
        };
    }, [currentStep, showBankTransferScreen, recipients, selectedRecipient]);

    // Trigger verification popup when new recipient reaches Step 3
    useEffect(() => {
        if (currentStep === 3 && isNewRecipientCreated) {
            setShowVerificationPopup(true);
            setIsNewRecipientCreated(false); // Reset so it only fires once per creation

            // Auto dismiss after 6 seconds (comfortable for slow reading)
            const timer = setTimeout(() => {
                setShowVerificationPopup(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [currentStep, isNewRecipientCreated]);

    // Handle Amount Conversion
    const handleSendChange = (val: string) => {
        setSendAmount(val);
        const numeric = parseFloat(val);
        if (!isNaN(numeric)) {
            setReceiveAmount((numeric * EXCHANGE_RATE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } else {
            setReceiveAmount("0.00");
        }
    };

    const handleReceiveChange = (val: string) => {
        const cleanVal = val.replace(/,/g, "");
        setReceiveAmount(val);
        const numeric = parseFloat(cleanVal);
        if (!isNaN(numeric)) {
            setSendAmount((numeric / EXCHANGE_RATE).toFixed(2));
        } else {
            setSendAmount("0.00");
        }
    };

    // Calculate details
    const sendVal = parseFloat(sendAmount) || 0;
    const fee = 5.00;
    const exchangeRate = EXCHANGE_RATE;

    const discount = promoApplied ? promoDiscount : 0;
    const bonusOffset = useBonus && bonusType === "pay_less" ? 5.00 : 0;
    const totalToPay = Math.max(0, sendVal + fee - discount - bonusOffset);

    const bonusSendMoreAmount = useBonus && bonusType === "send_more" ? 5.00 : 0;
    const finalReceiveNGN = ((sendVal + bonusSendMoreAmount) * exchangeRate).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const handleNext = () => {
        setDirection(1);
        setCurrentStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setDirection(-1);
        setCurrentStep((prev) => prev - 1);
    };

    const handleApplyPromo = () => {
        const code = promoCode.trim().toUpperCase();
        if (PROMO_CODES[code] !== undefined) {
            setPromoDiscount(PROMO_CODES[code]);
            setPromoApplied(true);
            setPromoMessage({ type: "success", text: `Promo code applied! Saved £${PROMO_CODES[code]}.` });
        } else {
            setPromoApplied(false);
            setPromoDiscount(0);
            setPromoMessage({ type: "error", text: "Invalid promo code" });
        }
    };

    const handleSubmitPayment = async () => {
        setIsSubmitting(true);
        // Realistic simulated API delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setIsSubmitting(false);
        setDirection(1);
        setCurrentStep(4); // Success screen
    };

    // Filter recipients based on search
    const filteredRecipients = recipients.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.bankName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Slide transition variants
    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 300 : -300,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (dir: number) => ({
            x: dir < 0 ? 300 : -300,
            opacity: 0
        })
    };

    return (
        <div className="min-h-screen bg-slate-50 md:bg-slate-900 flex flex-col items-center justify-center p-0 md:p-4 font-sans overflow-hidden">
            
            {/* Header info */}
            <div className="hidden md:block text-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Mobile Send Money Prototype</h1>
                <p className="text-sm text-slate-500 mt-1">Realistic smartphone simulator demonstrating the 3-step payment flow</p>
            </div>

            {/* Smartphone Container */}
            <div className="relative w-full h-screen md:h-auto md:max-w-[390px] md:aspect-[9/19.5] bg-slate-50 md:bg-slate-950 md:rounded-[55px] p-0 md:p-3.5 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] md:border-4 md:border-slate-800 md:ring-1 md:ring-slate-700/50 flex flex-col overflow-hidden">
                
                {/* Dynamic Island / Camera Notch */}
                <div className="hidden md:flex absolute top-6 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-50 items-center justify-between px-2.5">
                    <div className="w-3.5 h-3.5 bg-slate-900 rounded-full border border-slate-800" />
                    <div className="w-1.5 h-1.5 bg-blue-900/30 rounded-full" />
                </div>

                {/* Speaker Grill */}
                <div className="hidden md:block absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-800 rounded-full z-50" />

                {/* Smartphone Screen Content */}
                <div className="bg-slate-50 rounded-none md:rounded-[42px] flex-1 overflow-hidden flex flex-col relative select-none">
                    
                    {/* Status Bar */}
                    <div className="hidden md:flex h-11 pt-3 items-center justify-between px-7 text-slate-900 text-xs font-semibold z-40 select-none">
                        <span>12:30</span>
                        <div className="flex items-center gap-1.5">
                            <Signal className="w-3.5 h-3.5" />
                            <Wifi className="w-3.5 h-3.5" />
                            <div className="flex items-center gap-0.5">
                                <Battery className="w-4 h-3.5" />
                            </div>
                        </div>
                    </div>

                    {/* App Header (Dynamic) */}
                    <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-30">
                        <div className="flex items-center gap-2">
                            {currentStep > 1 && currentStep < 4 ? (
                                <button
                                    onClick={() => {
                                        if (showBankTransferScreen) {
                                            setShowBankTransferScreen(false);
                                        } else {
                                            handleBack();
                                        }
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            ) : (
                                <span className="font-extrabold text-blue-600 text-lg tracking-tight">R</span>
                            )}
                            <span className="font-bold text-slate-800 text-base">Send Money</span>
                        </div>
                        {currentStep < 4 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                                    Step {currentStep} of 3
                                </span>
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                    OM
                                </div>
                            </div>
                        )}
                    </div>

                    {/* App Stepper (Dynamic) */}
                    {currentStep < 4 && (
                        <div className="bg-white px-4 py-2 border-b border-slate-100 flex justify-between items-center z-30 shadow-sm">
                            {[
                                { id: 1, label: "Amount" },
                                { id: 2, label: "Recipient" },
                                { id: 3, label: "Review & Pay" }
                            ].map((step, idx) => {
                                const isActive = currentStep === step.id;
                                const isCompleted = currentStep > step.id;
                                return (
                                    <div key={step.id} className="flex items-center gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                                isCompleted ? "bg-emerald-500 text-white" : isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                                            }`}>
                                                {isCompleted ? <Check className="w-3 h-3" /> : step.id}
                                            </div>
                                            <span className={`text-[11px] font-semibold transition-all ${
                                                isActive ? "text-blue-600" : isCompleted ? "text-emerald-500" : "text-slate-400"
                                            }`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < 2 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Screen View Area */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={checkScrollable}
                        className="flex-1 overflow-y-auto relative flex flex-col"
                    >
                        <AnimatePresence initial={false} custom={direction} mode="wait">
                            {showBankTransferScreen ? (
                                <motion.div
                                    key="bank_transfer"
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="p-4 space-y-4 flex flex-col flex-1"
                                >
                                    {/* Back to Payment Methods */}
                                    <button
                                        onClick={() => setShowBankTransferScreen(false)}
                                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 w-fit"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Payment Methods
                                    </button>

                                    {/* Stepper Tracker */}
                                    <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-xs flex justify-between items-center text-[9px] font-bold text-slate-400">
                                        <div className="flex items-center gap-1 text-emerald-500">
                                            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]"><Check className="w-2.5 h-2.5" /></div>
                                            <span>Created</span>
                                        </div>
                                        <div className="h-0.5 w-4 bg-emerald-200 flex-1 mx-1" />
                                        <div className="flex items-center gap-1 text-blue-600">
                                            <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px]">⏰</div>
                                            <span>Awaiting Pay</span>
                                        </div>
                                        <div className="h-0.5 w-4 bg-slate-100 flex-1 mx-1" />
                                        <div className="flex items-center gap-1">
                                            <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[8px]">3</div>
                                            <span>Received</span>
                                        </div>
                                        <div className="h-0.5 w-4 bg-slate-100 flex-1 mx-1" />
                                        <div className="flex items-center gap-1">
                                            <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[8px]">4</div>
                                            <span>Processing</span>
                                        </div>
                                    </div>

                                    {/* Success banner */}
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 space-y-1 text-[11px] text-emerald-800">
                                        <div className="flex items-center gap-1.5 font-extrabold text-emerald-700">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Your transaction has been created!</span>
                                        </div>
                                        <p className="text-slate-600 text-[10px] leading-relaxed">
                                            Reference: <span className="font-extrabold text-slate-800">#24426299</span> Amount: <span className="font-extrabold text-slate-800">₦{finalReceiveNGN}</span>. Please complete your payment below to finalise your transfer.
                                        </p>
                                    </div>

                                    {/* Warning countdown banner */}
                                    {timerSeconds > 0 ? (
                                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex gap-2.5 text-[10px] leading-normal text-amber-800">
                                            <div className="w-10 h-10 rounded-full border-2 border-amber-500 flex items-center justify-center font-extrabold text-xs text-amber-600 shrink-0 bg-white shadow-sm">
                                                {formatTimer(timerSeconds)}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-amber-900">Complete your payment</p>
                                                <p className="text-slate-600 text-[9px] leading-snug">Please transfer the funds within 30 minutes. Your transaction will be automatically cancelled if payment is not received in time.</p>
                                                <button onClick={() => setTimerSeconds(0)} className="text-[8px] font-bold text-blue-600 hover:underline block pt-0.5">Simulate Expiry (Demo)</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 flex gap-2.5 text-[10px] leading-normal text-rose-800">
                                            <div className="w-10 h-10 rounded-full border-2 border-rose-500 flex items-center justify-center font-extrabold text-xs text-rose-600 shrink-0 bg-white shadow-sm">
                                                Expired
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-rose-900">Transaction Expired</p>
                                                <p className="text-slate-600 text-[9px] leading-snug">This transaction was automatically cancelled because we did not receive payment within 30 minutes.</p>
                                                <button onClick={() => setTimerSeconds(1800)} className="text-[8px] font-bold text-blue-600 hover:underline block pt-0.5">Restart Timer (Demo)</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bank details card */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-sm text-xs">
                                        <div className="flex justify-between items-center border-b pb-2 border-slate-100">
                                            <span className="font-bold text-slate-800">Pay with Bank Transfer</span>
                                            <button className="text-[9px] font-bold text-blue-600 hover:underline">Copy All</button>
                                        </div>
                                        
                                        <div className="space-y-2.5 text-[10px]">
                                            {[
                                                { label: "Transaction Reference No.", val: "24426299" },
                                                { label: "Account Name", val: "Funtech Global Communications Ltd." },
                                                { label: "Bank Name", val: "The Currency Cloud Limited" },
                                                { label: "Bank Account Number", val: "1018984719" },
                                                { label: "Sort Code", val: "20-45-45" }
                                            ].map(item => (
                                                <div key={item.label} className="flex justify-between items-start">
                                                    <span className="text-slate-400 font-medium max-w-[120px]">{item.label}</span>
                                                    <div className="flex items-center gap-1 font-bold text-slate-800 font-mono text-right">
                                                        <span className="truncate max-w-[120px]">{item.val}</span>
                                                        <button className="p-0.5 hover:bg-slate-100 rounded text-slate-400">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bottom notification message */}
                                    <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-3 flex gap-2 text-[10px] text-blue-800">
                                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-blue-900">Bank details sent to your email</p>
                                            <p className="text-slate-600 text-[9px] leading-relaxed">We've sent the bank account details to your registered email address for your reference. You can also make the payment using those details.</p>
                                        </div>
                                    </div>

                                    {/* Spacer to prevent scroll clipping under sticky footer */}
                                    <div className="h-24" />
                                </motion.div>
                            ) : !showBankTransferScreen && currentStep === 1 && (
                                <motion.div
                                    key="step1"
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="p-4 space-y-4 flex flex-col flex-1"
                                >
                                    {/* Card Instruction */}
                                    <div className="space-y-1">
                                        <h2 className="text-base font-bold text-slate-900">Enter amount, choose delivery & recipient</h2>
                                        <p className="text-xs text-slate-500">See how much your recipient will get.</p>
                                    </div>

                                    {/* You Send Input */}
                                    <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm relative focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">You Send</label>
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 cursor-pointer hover:bg-slate-100 transition-all select-none">
                                                <span className="text-lg">🇬🇧</span>
                                                <span className="font-bold text-sm text-slate-800">GBP</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={sendAmount}
                                                onChange={(e) => handleSendChange(e.target.value)}
                                                className="flex-1 w-0 text-right font-extrabold text-2xl outline-none text-slate-800 bg-transparent"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Fee, Rate, Lock bar */}
                                    <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">Fee: £{fee.toFixed(2)}</span>
                                            <span className="font-medium text-slate-400">1 GBP = {EXCHANGE_RATE} NGN</span>
                                        </div>
                                        <div className="flex items-center justify-center text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                            <Lock className="w-3.5 h-3.5" />
                                        </div>
                                    </div>

                                    {/* They Receive Input */}
                                    <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm relative focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">They Receive</label>
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 cursor-pointer hover:bg-slate-100 transition-all select-none">
                                                <span className="text-lg">🇳🇬</span>
                                                <span className="font-bold text-sm text-slate-800">NGN</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={receiveAmount}
                                                onChange={(e) => handleReceiveChange(e.target.value)}
                                                className="flex-1 w-0 text-right font-extrabold text-2xl outline-none text-slate-800 bg-transparent"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Delivery Options */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">How will they receive the money?</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: "bank_deposit", title: "Bank Deposit", desc: "Direct to bank", icon: Building2 },
                                                { id: "mobile_money", title: "Mobile Money", desc: "To mobile wallet", icon: Smartphone },
                                                { id: "cash_pickup", title: "Cash Pickup", desc: "Pick up in cash", icon: Wallet }
                                            ].map((method) => {
                                                const isSel = deliveryMethod === method.id;
                                                return (
                                                    <button
                                                        key={method.id}
                                                        onClick={() => setDeliveryMethod(method.id)}
                                                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                                                            isSel ? "border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/30" : "border-slate-200 bg-white hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSel ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                                                            <method.icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <p className={`text-[10px] font-bold ${isSel ? "text-blue-700" : "text-slate-800"}`}>{method.title}</p>
                                                            <p className="text-[8px] text-slate-400 font-medium leading-none">{method.desc}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Select Recipient search */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-500">Select recipient</label>
                                            <button
                                                onClick={() => setShowCreateModal(true)}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> Create recipient
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
                                            <Search className="w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full text-xs outline-none bg-transparent text-slate-700"
                                                placeholder="Search name, bank or account"
                                            />
                                        </div>
                                    </div>

                                    {/* Recent Recipients */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-500">Recent recipients</label>
                                            <span className="text-[10px] font-semibold text-slate-400 cursor-pointer hover:text-slate-600">View all</span>
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
                                            {filteredRecipients.map((rec) => {
                                                const isSel = selectedRecipient?.id === rec.id;
                                                return (
                                                    <div
                                                        key={rec.id}
                                                        onClick={() => setSelectedRecipient(rec)}
                                                        className="flex flex-col items-center gap-1 shrink-0"
                                                    >
                                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs ring-2 transition-all relative ${
                                                            isSel ? "ring-blue-600 ring-offset-2" : "ring-transparent hover:ring-slate-300"
                                                        } ${rec.color}`}>
                                                            {rec.initials}
                                                            {isSel && (
                                                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center border border-white">
                                                                    <Check className="w-2.5 h-2.5" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-700 truncate max-w-[50px] text-center">{rec.name.split(" ")[0]}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Selected Recipient Card */}
                                    {selectedRecipient && (
                                        <div className="bg-white rounded-2xl p-3 border-2 border-blue-600 bg-blue-50/10 shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${selectedRecipient.color}`}>
                                                    {selectedRecipient.initials}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-bold text-slate-800">{selectedRecipient.name}</h4>
                                                    <p className="text-[9px] text-slate-400 font-semibold">{selectedRecipient.bankName} • {selectedRecipient.currency === "NGN" ? "Mobile Wallet" : "Bank Deposit"}</p>
                                                    <p className="text-[9px] text-slate-500 font-mono">Acc: ****{selectedRecipient.accountNumber.slice(-4)}  Sort: {selectedRecipient.sortCode}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleOpenEditModal}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-700 transition-colors"
                                            >
                                                <Edit2 className="w-3 h-3" /> Edit
                                            </button>
                                        </div>
                                    )}

                                    {/* Spacer to prevent scroll clipping under sticky footer */}
                                    <div className="h-16" />
                                </motion.div>
                            )}

                            {!showBankTransferScreen && currentStep === 2 && (
                                <motion.div
                                    key="step2"
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="p-4 space-y-4 flex flex-col flex-1"
                                >
                                    {/* Mini summary at the top */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm grid grid-cols-3 gap-2 text-center text-xs divide-x divide-slate-100">
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">You Send</span>
                                            <span className="font-extrabold text-slate-800">£{parseFloat(sendAmount).toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">They Receive</span>
                                            <span className="font-extrabold text-emerald-600">₦{receiveAmount}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Method</span>
                                            <span className="font-extrabold text-slate-800 flex items-center justify-center gap-1">
                                                <Building2 className="w-3 h-3 text-slate-500" /> Deposit
                                            </span>
                                        </div>
                                    </div>

                                    {/* Who are you sending to Search Bar */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs font-bold text-slate-500">Who are you sending to?</h3>
                                            <button
                                                onClick={() => setShowCreateModal(true)}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> Create recipient
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                                            <Search className="w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full text-xs outline-none bg-transparent text-slate-700"
                                                placeholder="Search name, bank or account"
                                            />
                                        </div>
                                    </div>

                                    {/* Recent Recipients (Step 2 Carousel) */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-500">Recent recipients</label>
                                            <span className="text-[10px] font-semibold text-slate-400 cursor-pointer hover:text-slate-600">View all</span>
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
                                            {filteredRecipients.map((rec) => {
                                                const isSel = selectedRecipient?.id === rec.id;
                                                return (
                                                    <div
                                                        key={rec.id}
                                                        onClick={() => setSelectedRecipient(rec)}
                                                        className="flex flex-col items-center gap-1 shrink-0"
                                                    >
                                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs ring-2 transition-all relative ${
                                                            isSel ? "ring-blue-600 ring-offset-2" : "ring-transparent hover:ring-slate-300"
                                                        } ${rec.color}`}>
                                                            {rec.initials}
                                                            {isSel && (
                                                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center border border-white">
                                                                    <Check className="w-2.5 h-2.5" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-700 truncate max-w-[50px] text-center">{rec.name.split(" ")[0]}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Selected Recipient Card (Step 2) */}
                                    {selectedRecipient && (
                                        <div className="bg-white rounded-2xl p-3 border-2 border-blue-600 bg-blue-50/10 shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${selectedRecipient.color}`}>
                                                    {selectedRecipient.initials}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-bold text-slate-800">{selectedRecipient.name}</h4>
                                                    <p className="text-[9px] text-slate-400 font-semibold">{selectedRecipient.bankName} • {selectedRecipient.currency === "NGN" ? "Mobile Wallet" : "Bank Deposit"}</p>
                                                    <p className="text-[9px] text-slate-500 font-mono">Acc: ****{selectedRecipient.accountNumber.slice(-4)}  Sort: {selectedRecipient.sortCode}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleOpenEditModal}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-700 transition-colors"
                                            >
                                                <Edit2 className="w-3 h-3" /> Edit
                                            </button>
                                        </div>
                                    )}

                                    {/* Recipient Details Form */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-sm">
                                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b pb-1.5 border-slate-100 flex items-center gap-1.5">
                                            <span className="w-1.5 h-3 bg-blue-600 rounded-full" />
                                            Recipient Details
                                        </h3>

                                        {/* Individual vs Business Toggle */}
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            <button
                                                onClick={() => setRecipientType("individual")}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                    recipientType === "individual"
                                                        ? "bg-white text-blue-600 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700"
                                                }`}
                                            >
                                                <User className="w-3.5 h-3.5" />
                                                Individual
                                            </button>
                                            <button
                                                onClick={() => setRecipientType("business")}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                    recipientType === "business"
                                                        ? "bg-white text-blue-600 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700"
                                                }`}
                                            >
                                                <Briefcase className="w-3.5 h-3.5" />
                                                Business
                                            </button>
                                        </div>

                                        {/* Delivery Method Selection */}
                                        <div className="space-y-1.5 text-xs">
                                            <Label className="text-[10px] font-bold text-slate-500">Delivery Method</Label>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div
                                                    onClick={() => setDeliveryMethodChoice("direct_bank")}
                                                    className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                                                        deliveryMethodChoice === "direct_bank"
                                                            ? "border-blue-500 bg-blue-50/20 shadow-sm"
                                                            : "border-slate-200 bg-white hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        deliveryMethodChoice === "direct_bank" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div className="text-left leading-tight">
                                                        <h4 className="text-[10px] font-bold text-slate-800">Direct To Bank</h4>
                                                        <span className="text-[8px] text-slate-400 font-semibold block">Local transfers - 30mins</span>
                                                    </div>
                                                </div>

                                                <div
                                                    onClick={() => setDeliveryMethodChoice("swift")}
                                                    className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                                                        deliveryMethodChoice === "swift"
                                                            ? "border-blue-500 bg-blue-50/20 shadow-sm"
                                                            : "border-slate-200 bg-white hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        deliveryMethodChoice === "swift" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        <Globe className="w-4 h-4" />
                                                    </div>
                                                    <div className="text-left leading-tight">
                                                        <h4 className="text-[10px] font-bold text-slate-800">Swift</h4>
                                                        <span className="text-[8px] text-slate-400 font-semibold block">International transfers-24hrs</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Name Fields - Conditional on recipient type */}
                                        {recipientType === "individual" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500">First Name*</Label>
                                                    <Input
                                                        value={firstName}
                                                        onChange={e => setFirstName(e.target.value)}
                                                        className="h-9 text-xs rounded-lg"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500">Last Name*</Label>
                                                    <Input
                                                        value={lastName}
                                                        onChange={e => setLastName(e.target.value)}
                                                        className="h-9 text-xs rounded-lg"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Company Name*</Label>
                                                <Input
                                                    value={companyName}
                                                    onChange={e => setCompanyName(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        )}

                                        {/* Address & City */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Address*</Label>
                                                <Input
                                                    value={address}
                                                    onChange={e => setAddress(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">City*</Label>
                                                <Input
                                                    value={city}
                                                    onChange={e => setCity(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        {/* State/Province & Postcode */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">State/Province</Label>
                                                <Select value={stateProvince} onValueChange={setStateProvince}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Greater London">Greater London</SelectItem>
                                                        <SelectItem value="Hessen">Hessen</SelectItem>
                                                        <SelectItem value="New York">New York</SelectItem>
                                                        <SelectItem value="Lagos State">Lagos State</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Postcode*</Label>
                                                <Input
                                                    value={postcode}
                                                    onChange={e => setPostcode(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        {/* Relationship & Nickname */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Relationship*</Label>
                                                <Select value={relationship} onValueChange={setRelationship}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Family">Family</SelectItem>
                                                        <SelectItem value="Friend">Friend</SelectItem>
                                                        <SelectItem value="Business Partner">Business Partner</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Unique Nick Name (Min 5 chars)*</Label>
                                                <Input
                                                    value={nickname}
                                                    onChange={e => setNickname(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        {/* Reason & Narration */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Reason*</Label>
                                                <Select value={reason} onValueChange={setReason}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Family Support">Family Support</SelectItem>
                                                        <SelectItem value="Education">Education</SelectItem>
                                                        <SelectItem value="Medical Bills">Medical Bills</SelectItem>
                                                        <SelectItem value="Services Paid">Services Paid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Narration</Label>
                                                <Input
                                                    value={narration}
                                                    onChange={e => setNarration(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Banking Details Card */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
                                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b pb-1.5 border-slate-100 flex items-center gap-1.5">
                                            <span className="w-1.5 h-3 bg-blue-600 rounded-full" />
                                            Banking Details
                                        </h3>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-500">Bank name</Label>
                                            <Input
                                                value={bankName}
                                                onChange={e => setBankName(e.target.value)}
                                                className="h-9 text-xs rounded-lg"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Account number</Label>
                                                <Input
                                                    value={accountNumber}
                                                    onChange={e => setAccountNumber(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Sort code</Label>
                                                <Input
                                                    value={sortCode}
                                                    onChange={e => setSortCode(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Spacer to prevent scroll clipping under sticky footer */}
                                    <div className="h-16" />
                                </motion.div>
                            )}

                            {!showBankTransferScreen && currentStep === 3 && (
                                <motion.div
                                    key="step3"
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="p-4 space-y-4 flex flex-col flex-1 relative"
                                >
                                    {/* Account Verification Popup */}
                                    <AnimatePresence>
                                        {showVerificationPopup && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -15 }}
                                                className="absolute top-2 left-4 right-4 bg-emerald-600/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-lg border border-emerald-500/25 z-50 flex items-start gap-2.5"
                                            >
                                                <div className="w-6.5 h-6.5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <div className="flex-1 space-y-0.5">
                                                    <h4 className="text-[10px] font-bold font-display leading-tight">Recipient Verified</h4>
                                                    <p className="text-[8px] text-emerald-100 font-semibold leading-relaxed">
                                                        We've successfully verified the bank account details for <strong>{selectedRecipient?.name}</strong>. It is safe to proceed.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setShowVerificationPopup(false)}
                                                    className="p-0.5 text-white/60 hover:text-white transition-colors hover:bg-white/10 rounded shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {/* Mini summary card */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-lg">🇬🇧</span>
                                            <span className="font-extrabold text-slate-800">£{parseFloat(sendAmount).toFixed(2)}</span>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-lg">🇳🇬</span>
                                            <span className="font-extrabold text-emerald-600">₦{finalReceiveNGN}</span>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        <div className="bg-blue-50 px-2 py-0.5 rounded-full text-blue-600 font-bold text-[9px]">
                                            Deposit
                                        </div>
                                    </div>

                                    {/* Referral bonus available card */}
                                    <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-3.5 space-y-2">
                                        <div className="flex items-start gap-2.5">
                                            <Checkbox
                                                id="redeemBonus"
                                                checked={useBonus}
                                                onCheckedChange={(checked) => setUseBonus(checked as boolean)}
                                                className="mt-0.5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded"
                                            />
                                            <div className="space-y-0.5">
                                                <Label htmlFor="redeemBonus" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1">
                                                    Redeem your <span className="text-blue-600 font-bold">£5.00 bonus</span>
                                                </Label>
                                                <p className="text-[10px] text-slate-400 font-medium">You can send this from referring friends!</p>
                                            </div>
                                        </div>

                                        {useBonus && (
                                            <div className="grid grid-cols-2 gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <button
                                                    onClick={() => setBonusType("pay_less")}
                                                    className={`p-2 rounded-xl border text-left transition-all ${
                                                        bonusType === "pay_less" ? "border-blue-600 bg-white" : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${bonusType === "pay_less" ? "border-blue-600" : "border-slate-300"}`}>
                                                            {bonusType === "pay_less" && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-800">Pay Less</span>
                                                    </div>
                                                    <p className="text-[8px] text-slate-400 font-medium ml-5">Save £5.00 now</p>
                                                </button>
                                                <button
                                                    onClick={() => setBonusType("send_more")}
                                                    className={`p-2 rounded-xl border text-left transition-all ${
                                                        bonusType === "send_more" ? "border-blue-600 bg-white" : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${bonusType === "send_more" ? "border-blue-600" : "border-slate-300"}`}>
                                                            {bonusType === "send_more" && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-800">Send More</span>
                                                    </div>
                                                    <p className="text-[8px] text-slate-400 font-medium ml-5">Recipient gets +5.00 GBP</p>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Promo Code Card */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Have a promo code?</label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Enter code (e.g. WELCOME, SAVE20)"
                                                value={promoCode}
                                                onChange={(e) => {
                                                    setPromoCode(e.target.value);
                                                    setPromoApplied(false);
                                                    setPromoMessage(null);
                                                }}
                                                className="h-9 text-xs rounded-lg font-mono uppercase"
                                                disabled={promoApplied}
                                            />
                                            <Button
                                                onClick={handleApplyPromo}
                                                disabled={promoApplied || !promoCode}
                                                className="h-9 text-xs px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                            >
                                                {promoApplied ? <Check className="w-4 h-4" /> : "Apply"}
                                            </Button>
                                        </div>
                                        {promoMessage && (
                                            <p className={`text-[10px] font-semibold mt-1 ${promoMessage.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                                                {promoMessage.text}
                                            </p>
                                        )}
                                    </div>

                                    {/* Payment Methods */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">How would you like to pay?</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: "instant_bank", title: "Instant Pay by Bank", desc: `You pay £${totalToPay.toFixed(2)}`, tag: "Recommended", icon: Landmark },
                                                { id: "card", title: "Credit / Debit Card", desc: `You pay £${(totalToPay + 5.00).toFixed(2)}`, icon: CreditCard },
                                                { id: "manual_transfer", title: "Manual Bank Transfer", desc: "Pay within 30 minutes", icon: Building2 },
                                                { id: "wallet", title: "Wallet Balance", desc: "Available: £300.20", icon: Wallet }
                                            ].map((method) => {
                                                const isSel = paymentMethod === method.id;
                                                return (
                                                    <div
                                                        key={method.id}
                                                        onClick={() => setPaymentMethod(method.id)}
                                                        className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all relative ${
                                                            isSel ? "border-blue-600 bg-blue-50/15 shadow-sm ring-1 ring-blue-500/20" : "border-slate-200 bg-white hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${isSel ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-50 border-slate-100 text-slate-600"}`}>
                                                            <method.icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className={`text-xs font-bold ${isSel ? "text-blue-700" : "text-slate-800"}`}>{method.title}</p>
                                                                {method.tag && (
                                                                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                                                                        {method.tag}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 font-semibold">{method.desc}</p>
                                                        </div>
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSel ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                                                            {isSel && <Check className="w-3 h-3" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Sending To summary card at the bottom */}
                                    <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 flex justify-between items-center text-xs">
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Sending to</span>
                                            <span className="font-bold text-slate-800">{firstName} {lastName}</span>
                                        </div>
                                        <div className="text-right space-y-0.5">
                                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">{bankName}</span>
                                            <span className="font-mono text-slate-600">Acc: ****{accountNumber.slice(-4)}</span>
                                        </div>
                                    </div>

                                    {/* Security lock message */}
                                    <div className="flex items-center justify-center gap-1.5 text-[9px] text-emerald-600 font-bold">
                                        <Lock className="w-3 h-3 text-emerald-600" />
                                        <span>Secure & Encrypted (256-bit encryption)</span>
                                    </div>

                                    {/* Disclaimer */}
                                    <p className="text-[9px] text-slate-400 font-medium text-center leading-normal">
                                        By proceeding, you agree to our Terms of Use and Privacy Policy. Funds are usually delivered within minutes.
                                    </p>

                                    {/* Spacer to prevent scroll clipping under sticky footer */}
                                    <div className="h-16" />
                                </motion.div>
                            )}

                            {currentStep === 4 && (
                                <motion.div
                                    key="step4"
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="p-5 flex flex-col flex-1 items-center justify-center text-center space-y-6"
                                >
                                    {/* Checkmark icon with animation */}
                                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border-4 border-emerald-50">
                                        <CheckCircle2 className="w-12 h-12 animate-pulse" />
                                    </div>

                                    {/* Title / Description */}
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-slate-800">Transfer Successful!</h3>
                                        <p className="text-xs text-slate-500 max-w-[250px] mx-auto leading-relaxed">
                                            Your transaction has been submitted and funds are on their way to your recipient.
                                        </p>
                                    </div>

                                    {/* Receipt Card */}
                                    <div className="w-full bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3.5 text-left">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b pb-1.5 border-slate-100">
                                            Receipt Details
                                        </h4>
                                        
                                        <div className="space-y-2.5 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-semibold">Recipient</span>
                                                <span className="font-bold text-slate-800">{firstName} {lastName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-semibold">Destination Bank</span>
                                                <span className="font-bold text-slate-800">{bankName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-semibold">Delivery Method</span>
                                                <span className="font-bold text-slate-800 capitalize">{deliveryMethod.replace("_", " ")}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-semibold">Amount Sent</span>
                                                <span className="font-bold text-slate-800">£{parseFloat(sendAmount).toFixed(2)} GBP</span>
                                            </div>
                                            <div className="flex justify-between border-t border-dashed pt-2.5 border-slate-200">
                                                <span className="text-slate-500 font-bold">Total Paid</span>
                                                <span className="font-extrabold text-blue-600 text-sm">£{totalToPay.toFixed(2)} GBP</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-bold">Recipient Gets</span>
                                                <span className="font-extrabold text-emerald-600 text-sm">₦{finalReceiveNGN} NGN</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Spacer to prevent scroll clipping under sticky footer */}
                                    <div className="h-24" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Sticky bottom CTA and scroll indicator */}
                    <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-2.5 z-40 flex flex-col gap-2 relative shadow-[0_-8px_24px_rgba(0,0,0,0.02)]">
                        {/* Blinking scroll indicator arrow */}
                        {showScrollIndicator && (
                            <button
                                onClick={handleScrollToBottom}
                                className="absolute -top-12 right-4 bg-blue-600/35 border border-white/20 backdrop-blur-xs text-white rounded-full p-2.5 shadow-sm flex items-center justify-center animate-bounce-blink-right z-50 cursor-pointer hover:bg-blue-600/50 transition-colors"
                            >
                                <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {showBankTransferScreen ? (
                            <div className="space-y-2 w-full">
                                <Button
                                    onClick={() => {
                                        setShowBankTransferScreen(false);
                                        setCurrentStep(1);
                                    }}
                                    className="w-full h-11 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex flex-col items-center justify-center"
                                >
                                    <span className="font-extrabold">I've noted the details — take me to Dashboard</span>
                                    <span className="text-[8px] font-medium text-blue-100">I'll complete the payment within 30 minutes</span>
                                </Button>
                                <button
                                    onClick={() => {
                                        setShowBankTransferScreen(false);
                                        setTimerSeconds(1800);
                                    }}
                                    className="w-full text-center text-xs font-bold text-rose-600 hover:text-rose-700 block py-1"
                                >
                                    Cancel Transaction
                                </button>
                            </div>
                        ) : currentStep === 1 ? (
                            <Button
                                onClick={handleNext}
                                className="w-full h-11 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm text-white"
                            >
                                Continue
                            </Button>
                        ) : currentStep === 2 ? (
                            <Button
                                onClick={handleNext}
                                className="w-full h-11 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm text-white"
                            >
                                Continue
                            </Button>
                        ) : currentStep === 3 ? (
                            <Button
                                onClick={() => {
                                    if (paymentMethod === "manual_transfer") {
                                        setShowConfirmModal(true);
                                    } else {
                                        handleSubmitPayment();
                                    }
                                }}
                                disabled={isSubmitting}
                                className="w-full h-11 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Pay £{totalToPay.toFixed(2)}</span>
                                    </>
                                )}
                            </Button>
                        ) : currentStep === 4 ? (
                            <div className="space-y-2 w-full">
                                <Button
                                    onClick={() => {
                                        setCurrentStep(1);
                                        setSendAmount("500.00");
                                        setReceiveAmount("1,012,750.00");
                                        setPromoApplied(false);
                                        setPromoCode("");
                                        setUseBonus(false);
                                    }}
                                    className="w-full h-11 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                >
                                    Send More Money
                                </Button>
                                <button
                                    onClick={() => setLocation("/")}
                                    className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 block py-1"
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Add New Recipient Bottom Sheet */}
                    <AnimatePresence>
                        {showCreateModal && (
                            <>
                                {/* Backdrop */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowCreateModal(false)}
                                    className="absolute inset-0 bg-black/60 z-50 rounded-[42px]"
                                />
                                {/* Bottom Sheet */}
                                <motion.div
                                    initial={{ y: "100%" }}
                                    animate={{ y: 0 }}
                                    exit={{ y: "100%" }}
                                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                                    className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-5 space-y-4 z-50 shadow-2xl border-t border-slate-100 max-h-[85vh] overflow-y-auto select-none scrollbar-none"
                                >
                                    <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                                        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                                            <span className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                                            Add New Recipient
                                        </h3>
                                        <button
                                            onClick={() => setShowCreateModal(false)}
                                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Individual vs Business Toggle */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setNewRecipientType("individual")}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                newRecipientType === "individual"
                                                    ? "bg-white text-blue-600 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            }`}
                                        >
                                            <User className="w-3.5 h-3.5" />
                                            Individual
                                        </button>
                                        <button
                                            onClick={() => setNewRecipientType("business")}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                newRecipientType === "business"
                                                    ? "bg-white text-blue-600 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            }`}
                                        >
                                            <Briefcase className="w-3.5 h-3.5" />
                                            Business
                                        </button>
                                    </div>

                                    {/* Delivery Method Selection */}
                                    <div className="space-y-1.5 text-xs">
                                        <Label className="text-[10px] font-bold text-slate-500">Delivery Method</Label>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div
                                                onClick={() => setNewDeliveryMethod("direct_bank")}
                                                className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                                                    newDeliveryMethod === "direct_bank"
                                                        ? "border-blue-500 bg-blue-50/20 shadow-sm"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    newDeliveryMethod === "direct_bank" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                                }`}>
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <h4 className="text-[10px] font-bold text-slate-800">Direct To Bank</h4>
                                                    <span className="text-[8px] text-slate-400 font-semibold block">Local transfers - 30mins</span>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setNewDeliveryMethod("swift")}
                                                className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                                                    newDeliveryMethod === "swift"
                                                        ? "border-blue-500 bg-blue-50/20 shadow-sm"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    newDeliveryMethod === "swift" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                                }`}>
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <h4 className="text-[10px] font-bold text-slate-800">Swift</h4>
                                                    <span className="text-[8px] text-slate-400 font-semibold block">International transfers-24hrs</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recipient Details */}
                                    <div className="space-y-3.5 text-xs">
                                        <div className="border-t pt-3 border-slate-100">
                                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                Recipient Details
                                            </h4>
                                        </div>

                                        {newRecipientType === "individual" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500">First Name*</Label>
                                                    <Input
                                                        placeholder="e.g. Akshita"
                                                        value={newName}
                                                        onChange={(e) => setNewName(e.target.value)}
                                                        className="h-9 text-xs rounded-lg animate-fade-in"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500">Last Name*</Label>
                                                    <Input
                                                        placeholder="e.g. Gupta"
                                                        value={newLastName}
                                                        onChange={(e) => setNewLastName(e.target.value)}
                                                        className="h-9 text-xs rounded-lg animate-fade-in"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Company Name*</Label>
                                                <Input
                                                    placeholder="e.g. Acme Corporation"
                                                    value={newCompanyName}
                                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                                    className="h-9 text-xs rounded-lg animate-fade-in"
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Address*</Label>
                                                <Input
                                                    placeholder="e.g. 42 London Road"
                                                    value={newAddress}
                                                    onChange={(e) => setNewAddress(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">City*</Label>
                                                <Input
                                                    placeholder="e.g. London"
                                                    value={newCity}
                                                    onChange={(e) => setNewCity(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">State/Province</Label>
                                                <Select value={newStateProvince} onValueChange={setNewStateProvince}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Greater London">Greater London</SelectItem>
                                                        <SelectItem value="Hessen">Hessen</SelectItem>
                                                        <SelectItem value="New York">New York</SelectItem>
                                                        <SelectItem value="Lagos State">Lagos State</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Postcode*</Label>
                                                <Input
                                                    placeholder="e.g. SE1 6LN"
                                                    value={newPostcode}
                                                    onChange={(e) => setNewPostcode(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Relationship*</Label>
                                                <Select value={newRelationship} onValueChange={setNewRelationship}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Family">Family</SelectItem>
                                                        <SelectItem value="Friend">Friend</SelectItem>
                                                        <SelectItem value="Business Partner">Business Partner</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Unique Nick Name (Min 5 chars)*</Label>
                                                <Input
                                                    placeholder="e.g. Akshita Gupta"
                                                    value={newNickname}
                                                    onChange={(e) => setNewNickname(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Reason*</Label>
                                                <Select value={newReason} onValueChange={setNewReason}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Family Support">Family Support</SelectItem>
                                                        <SelectItem value="Education">Education</SelectItem>
                                                        <SelectItem value="Medical Bills">Medical Bills</SelectItem>
                                                        <SelectItem value="Services Paid">Services Paid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Narration</Label>
                                                <Input
                                                    placeholder="e.g. Rent allowance"
                                                    value={newNarration}
                                                    onChange={(e) => setNewNarration(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Banking Details */}
                                    <div className="border-t pt-3 border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Banking Details
                                        </h4>
                                        <div className="space-y-1 text-xs">
                                            <Label className="text-[10px] font-bold text-slate-500">Bank Name*</Label>
                                            <Input
                                                placeholder="e.g. Barclays Bank"
                                                value={newBank}
                                                onChange={(e) => setNewBank(e.target.value)}
                                                className="h-9 text-xs rounded-lg"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Account Number*</Label>
                                                <Input
                                                    placeholder="8-10 digit number"
                                                    value={newAcc}
                                                    onChange={(e) => setNewAcc(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                    maxLength={10}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Sort Code*</Label>
                                                <Input
                                                    placeholder="xx-xx-xx"
                                                    value={newSort}
                                                    onChange={(e) => setNewSort(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const isIndiv = newRecipientType === "individual";
                                        const isNameValid = isIndiv 
                                            ? (newName.trim() !== "" && newLastName.trim() !== "")
                                            : newCompanyName.trim() !== "";
                                        const isDetailsValid = newAddress.trim() !== "" && 
                                            newCity.trim() !== "" && 
                                            newPostcode.trim() !== "" && 
                                            newRelationship !== "Select-" && 
                                            newReason !== "Select-" && 
                                            newNickname.trim().length >= 5;
                                        const isBankValid = newBank.trim() !== "" && 
                                            newAcc.trim() !== "" && 
                                            newSort.trim() !== "";
                                        const isFormValid = isNameValid && isDetailsValid && isBankValid;

                                        return (
                                            <Button
                                                onClick={handleCreateRecipient}
                                                disabled={!isFormValid}
                                                className="w-full h-11 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white mt-2 shadow-md disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                Add Recipient & Select
                                            </Button>
                                        );
                                    })()}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Confirm Manual Transfer Modal */}
                    <AnimatePresence>
                        {showConfirmModal && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowConfirmModal(false)}
                                    className="absolute inset-0 bg-black/60 z-50 rounded-[42px] backdrop-blur-xs"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md rounded-[28px] p-6 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-[320px] max-w-[88%] border border-slate-100/80 z-50"
                                >
                                    <div className="w-14 h-14 bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100/50 rounded-2xl flex items-center justify-center mx-auto shadow-xs text-blue-600">
                                        <Building2 className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Confirm Payment Method</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Manual Bank Transfer</p>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed px-1">
                                        You have selected the <span className="font-bold text-slate-800">Send to our local account (Pay within 30 minutes)</span> option. Do you want to proceed?
                                    </p>
                                    <div className="flex gap-3 pt-1.5 w-full">
                                        <button
                                            disabled={isSubmitting}
                                            onClick={() => setShowConfirmModal(false)}
                                            className="flex-1 h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all bg-white disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={isSubmitting}
                                            onClick={async () => {
                                                setIsSubmitting(true);
                                                await new Promise(r => setTimeout(r, 2000));
                                                setIsSubmitting(false);
                                                setShowConfirmModal(false);
                                                setShowBankTransferScreen(true);
                                                setTimerSeconds(1800);
                                            }}
                                            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-bold text-white shadow-md hover:shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span className="truncate">Submitting Transaction...</span>
                                                </>
                                            ) : (
                                                <span>Proceed</span>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Edit Recipient Bottom Sheet */}
                    <AnimatePresence>
                        {showEditModal && (
                            <>
                                {/* Backdrop */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowEditModal(false)}
                                    className="absolute inset-0 bg-black/60 z-50 rounded-[42px]"
                                />
                                {/* Bottom Sheet */}
                                <motion.div
                                    initial={{ y: "100%" }}
                                    animate={{ y: 0 }}
                                    exit={{ y: "100%" }}
                                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                                    className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-5 space-y-4 z-50 shadow-2xl border-t border-slate-100 max-h-[85vh] overflow-y-auto select-none scrollbar-none"
                                >
                                    <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                                        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                                            <span className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                                            Edit Recipient Details
                                        </h3>
                                        <button
                                            onClick={() => setShowEditModal(false)}
                                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Individual vs Business Toggle */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setEditRecipientType("individual")}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                editRecipientType === "individual"
                                                    ? "bg-white text-blue-600 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            }`}
                                        >
                                            <User className="w-3.5 h-3.5" />
                                            Individual
                                        </button>
                                        <button
                                            onClick={() => setEditRecipientType("business")}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                editRecipientType === "business"
                                                    ? "bg-white text-blue-600 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            }`}
                                        >
                                            <Briefcase className="w-3.5 h-3.5" />
                                            Business
                                        </button>
                                    </div>

                                    {/* Delivery Method Selection */}
                                    <div className="space-y-1.5 text-xs">
                                        <Label className="text-[10px] font-bold text-slate-500">Delivery Method</Label>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div
                                                onClick={() => setEditDeliveryMethod("direct_bank")}
                                                className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                                                    editDeliveryMethod === "direct_bank"
                                                        ? "border-blue-500 bg-blue-50/20 shadow-sm"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    editDeliveryMethod === "direct_bank" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                                }`}>
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <h4 className="text-[10px] font-bold text-slate-800">Direct To Bank</h4>
                                                    <span className="text-[8px] text-slate-400 font-semibold block">Local transfers - 30mins</span>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setEditDeliveryMethod("swift")}
                                                className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                                                    editDeliveryMethod === "swift"
                                                        ? "border-blue-500 bg-blue-50/20 shadow-sm"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    editDeliveryMethod === "swift" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                                }`}>
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <h4 className="text-[10px] font-bold text-slate-800">Swift</h4>
                                                    <span className="text-[8px] text-slate-400 font-semibold block">International transfers-24hrs</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recipient Details */}
                                    <div className="space-y-3.5 text-xs">
                                        <div className="border-t pt-3 border-slate-100">
                                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                Recipient Details
                                            </h4>
                                        </div>

                                        {editRecipientType === "individual" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500">First Name*</Label>
                                                    <Input
                                                        placeholder="e.g. Akshita"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-9 text-xs rounded-lg animate-fade-in"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500">Last Name*</Label>
                                                    <Input
                                                        placeholder="e.g. Gupta"
                                                        value={editLastName}
                                                        onChange={(e) => setEditLastName(e.target.value)}
                                                        className="h-9 text-xs rounded-lg animate-fade-in"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Company Name*</Label>
                                                <Input
                                                    placeholder="e.g. Acme Corporation"
                                                    value={editCompanyName}
                                                    onChange={(e) => setEditCompanyName(e.target.value)}
                                                    className="h-9 text-xs rounded-lg animate-fade-in"
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Address*</Label>
                                                <Input
                                                    placeholder="e.g. 42 London Road"
                                                    value={editAddress}
                                                    onChange={(e) => setEditAddress(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">City*</Label>
                                                <Input
                                                    placeholder="e.g. London"
                                                    value={editCity}
                                                    onChange={(e) => setEditCity(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">State/Province</Label>
                                                <Select value={editStateProvince} onValueChange={setEditStateProvince}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Greater London">Greater London</SelectItem>
                                                        <SelectItem value="Hessen">Hessen</SelectItem>
                                                        <SelectItem value="New York">New York</SelectItem>
                                                        <SelectItem value="Lagos State">Lagos State</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Postcode*</Label>
                                                <Input
                                                    placeholder="e.g. SE1 6LN"
                                                    value={editPostcode}
                                                    onChange={(e) => setEditPostcode(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Relationship*</Label>
                                                <Select value={editRelationship} onValueChange={setEditRelationship}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Family">Family</SelectItem>
                                                        <SelectItem value="Friend">Friend</SelectItem>
                                                        <SelectItem value="Business Partner">Business Partner</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Unique Nick Name (Min 5 chars)*</Label>
                                                <Input
                                                    placeholder="e.g. Akshita Gupta"
                                                    value={editNickname}
                                                    onChange={(e) => setEditNickname(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Reason*</Label>
                                                <Select value={editReason} onValueChange={setEditReason}>
                                                    <SelectTrigger className="h-9 text-xs rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Select-">Select-</SelectItem>
                                                        <SelectItem value="Family Support">Family Support</SelectItem>
                                                        <SelectItem value="Education">Education</SelectItem>
                                                        <SelectItem value="Medical Bills">Medical Bills</SelectItem>
                                                        <SelectItem value="Services Paid">Services Paid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Narration</Label>
                                                <Input
                                                    placeholder="e.g. Rent allowance"
                                                    value={editNarration}
                                                    onChange={(e) => setEditNarration(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Banking Details */}
                                    <div className="border-t pt-3 border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Banking Details
                                        </h4>
                                        <div className="space-y-1 text-xs">
                                            <Label className="text-[10px] font-bold text-slate-500">Bank Name*</Label>
                                            <Input
                                                placeholder="e.g. Barclays Bank"
                                                value={editBank}
                                                onChange={(e) => setEditBank(e.target.value)}
                                                className="h-9 text-xs rounded-lg"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Account Number*</Label>
                                                <Input
                                                    placeholder="8-10 digit number"
                                                    value={editAcc}
                                                    onChange={(e) => setEditAcc(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                    maxLength={10}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500">Sort Code*</Label>
                                                <Input
                                                    placeholder="xx-xx-xx"
                                                    value={editSort}
                                                    onChange={(e) => setEditSort(e.target.value)}
                                                    className="h-9 text-xs rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const isIndiv = editRecipientType === "individual";
                                        const isNameValid = isIndiv 
                                            ? (editName.trim() !== "" && editLastName.trim() !== "")
                                            : editCompanyName.trim() !== "";
                                        const isDetailsValid = editAddress.trim() !== "" && 
                                            editCity.trim() !== "" && 
                                            editPostcode.trim() !== "" && 
                                            editRelationship !== "Select-" && 
                                            editReason !== "Select-" && 
                                            editNickname.trim().length >= 5;
                                        const isBankValid = editBank.trim() !== "" && 
                                            editAcc.trim() !== "" && 
                                            editSort.trim() !== "";
                                        const isFormValid = isNameValid && isDetailsValid && isBankValid;

                                        return (
                                            <Button
                                                onClick={handleSaveRecipient}
                                                disabled={!isFormValid}
                                                className="w-full h-11 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white mt-2 shadow-md disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                Save Changes
                                            </Button>
                                        );
                                    })()}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Smartphone Navigation Bar / Home Indicator */}
                    <div className="hidden md:flex h-6 items-center justify-center pb-2 z-40 bg-white border-t border-slate-50">
                        <div className="w-32 h-1 bg-slate-300 rounded-full" />
                    </div>

                </div>
            </div>

            {/* Simulated Phone side buttons */}
            <div className="hidden md:flex text-xs text-slate-400 mt-6 gap-6 bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-sm">
                <span>⚡ Rate: GBP 1 = NGN {EXCHANGE_RATE}</span>
                <span>🎁 Try promo codes: <strong>SAVE20</strong>, <strong>WELCOME</strong></span>
            </div>

        </div>
    );
}
