import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Target, CheckCircle2, Mail, User, CreditCard, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCampaignById, getCampaignSummary, addContributor } from "./mockData";
import { Campaign } from "./types";
import logo from "@/assets/logo.png";

export default function ContributorView() {
    const [, params] = useRoute("/contribute/:campaignId");
    const campaignId = params?.campaignId || "";

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [summary, setSummary] = useState({ totalRaised: 0, contributorCount: 0 });
    const [step, setStep] = useState<'contribute' | 'processing' | 'success'>('contribute');

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        amount: "",
    });

    useEffect(() => {
        const camp = getCampaignById(campaignId);
        if (camp) {
            setCampaign(camp);
            setSummary(getCampaignSummary(campaignId));
        }
    }, [campaignId]);

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep('processing');

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        addContributor({
            campaignId,
            name: formData.name,
            email: formData.email,
            amount: parseFloat(formData.amount),
        });

        setStep('success');
    };

    const isFormValid = formData.name && formData.email && formData.amount && parseFloat(formData.amount) > 0;
    const progress = campaign ? (summary.totalRaised / campaign.targetAmount) * 100 : 0;

    if (!campaign) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground mb-4">Campaign not found or has ended</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex flex-col items-center justify-center p-4 md:p-8">
            {/* Logo Header */}
            <div className="w-full max-w-lg mb-6 flex items-center justify-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 flex items-center justify-center">
                        <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-lg font-bold text-slate-800 tracking-tight">Rhemito</span>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                <Card className="border-none shadow-2xl shadow-slate-200/60 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {step === 'contribute' && (
                            <motion.div
                                key="contribute"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                {/* Campaign Header */}
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold">{campaign.name}</h1>
                                            <p className="text-blue-100 text-sm">{campaign.description}</p>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-blue-100">{formatCurrency(summary.totalRaised, campaign.currency)} raised</span>
                                            <span className="font-semibold">of {formatCurrency(campaign.targetAmount, campaign.currency)}</span>
                                        </div>
                                        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-white transition-all duration-500"
                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-blue-100">
                                            <span>{summary.contributorCount} contributors</span>
                                            <span>{progress.toFixed(0)}% complete</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Contribution Form */}
                                <CardContent className="p-6">
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Your Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                <Input
                                                    id="name"
                                                    placeholder="John Doe"
                                                    className="pl-10 h-11"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email Address</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="john@example.com"
                                                    className="pl-10 h-11"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="amount">Contribution Amount ({campaign.currency})</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-slate-500 font-medium">
                                                    {campaign.currency === 'GBP' ? '£' : campaign.currency === 'USD' ? '$' : campaign.currency === 'EUR' ? '€' : '₦'}
                                                </span>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    min="1"
                                                    step="0.01"
                                                    placeholder="50.00"
                                                    className="pl-8 h-11"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 flex gap-3">
                                            <ShieldCheck className="w-5 h-5 shrink-0" />
                                            <p>Your payment is processed securely. We never store your card details.</p>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={!isFormValid}
                                            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg font-semibold gap-2"
                                        >
                                            Contribute {formData.amount && formatCurrency(parseFloat(formData.amount), campaign.currency)}
                                            <ArrowRight className="w-5 h-5" />
                                        </Button>
                                    </form>
                                </CardContent>
                            </motion.div>
                        )}

                        {step === 'processing' && (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-12 text-center"
                            >
                                <div className="relative w-16 h-16 mx-auto mb-6">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                                    <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                                </div>
                                <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
                                <p className="text-muted-foreground">Please wait while we process your contribution...</p>
                            </motion.div>
                        )}

                        {step === 'success' && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-white text-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", delay: 0.2 }}
                                        className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
                                    >
                                        <CheckCircle2 className="w-8 h-8" />
                                    </motion.div>
                                    <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
                                    <p className="text-green-100">Your contribution was successful</p>
                                </div>

                                <CardContent className="p-6 text-center space-y-4">
                                    <div className="bg-slate-50 rounded-xl p-4">
                                        <p className="text-sm text-muted-foreground mb-1">Amount Contributed</p>
                                        <p className="text-3xl font-bold text-green-600">
                                            {formatCurrency(parseFloat(formData.amount), campaign.currency)}
                                        </p>
                                    </div>

                                    <p className="text-sm text-muted-foreground">
                                        A confirmation email has been sent to <strong>{formData.email}</strong>
                                    </p>

                                    <div className="pt-4 border-t">
                                        <p className="text-xs text-muted-foreground">
                                            Thank you for contributing to "{campaign.name}"
                                        </p>
                                    </div>
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </motion.div>

            {/* Footer */}
            <div className="mt-6 text-center text-sm text-slate-500">
                <p>Powered by <span className="font-semibold text-slate-700">Rhemito</span></p>
            </div>
        </div>
    );
}
