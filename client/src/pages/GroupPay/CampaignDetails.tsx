import { useState, useEffect, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, CheckCircle2, Users, Target, TrendingUp, Share2, PauseCircle, PlayCircle, Trash2, Edit2, Save, AlertCircle, Lock, Info, Calculator, Settings } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getCampaignById, getContributorsByCampaignId, getCampaignSummary, deleteCampaign, toggleCampaignStatus, updateCampaign, FEE_CONFIG } from "./mockData";
import { Campaign, Contributor } from "./types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function CampaignDetails() {
    const [, params] = useRoute("/group-pay/:id");
    const campaignId = params?.id || "";
    const [, setLocation] = useLocation();

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [summary, setSummary] = useState({ totalRaised: 0, contributorCount: 0 });
    const [copied, setCopied] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        description: "",
        netTargetAmount: "", // Net amount user wants to receive
        useFixedAmount: false,
        netFixedContributionAmount: "",
    });

    useEffect(() => {
        const camp = getCampaignById(campaignId);
        if (camp) {
            setCampaign({ ...camp });
            setContributors(getContributorsByCampaignId(campaignId));
            const sum = getCampaignSummary(campaignId);
            setSummary(sum);
        }
    }, [campaignId, refreshTrigger]);

    // Initialize edit form when opening modal
    useEffect(() => {
        if (isEditModalOpen && campaign) {
            // Net = Gross * (1 - %) - Fixed ==> THIS IS WRONG.
            // Correct Reverse Logic from Gross:
            // Gross = (Net + Fixed) / (1 - %)
            // Net + Fixed = Gross * (1 - %)
            // Net = Gross * (1 - %) - Fixed

            const netTarget = (campaign.targetAmount * (1 - FEE_CONFIG.PERCENTAGE)) - FEE_CONFIG.FIXED_FEE;

            let netFixed = 0;
            if (campaign.fixedContributionAmount) {
                netFixed = (campaign.fixedContributionAmount * (1 - FEE_CONFIG.PERCENTAGE)) - FEE_CONFIG.FIXED_FEE;
            }

            setEditForm({
                name: campaign.name,
                description: campaign.description,
                netTargetAmount: Math.max(0, netTarget).toFixed(2),
                useFixedAmount: !!campaign.fixedContributionAmount,
                netFixedContributionAmount: netFixed > 0 ? netFixed.toFixed(2) : "",
            });
        }
    }, [isEditModalOpen, campaign]);

    const handleCopyLink = () => {
        if (campaign) {
            navigator.clipboard.writeText(campaign.uniqueLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleToggleStatus = () => {
        toggleCampaignStatus(campaignId);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleDelete = () => {
        deleteCampaign(campaignId);
        setLocation('/group-pay');
    };

    // Calculate new target fee breakdown
    const newTargetFeeBreakdown = useMemo(() => {
        const netAmount = parseFloat(editForm.netTargetAmount) || 0;
        if (netAmount <= 0) return { netAmount: 0, grossAmount: 0, mitoFee: 0 };

        // Formula: Gross = (Net + Fixed) / (1 - %)
        const grossAmount = (netAmount + FEE_CONFIG.FIXED_FEE) / (1 - FEE_CONFIG.PERCENTAGE);
        const mitoFee = grossAmount - netAmount;

        return {
            netAmount,
            grossAmount,
            mitoFee,
        };
    }, [editForm.netTargetAmount]);

    // Calculate new fixed contribution fee breakdown
    const newFixedFeeBreakdown = useMemo(() => {
        const netAmount = parseFloat(editForm.netFixedContributionAmount) || 0;
        if (netAmount <= 0) return { netAmount: 0, grossAmount: 0, mitoFee: 0 };

        // Formula: Gross = (Net + Fixed) / (1 - %)
        const grossAmount = (netAmount + FEE_CONFIG.FIXED_FEE) / (1 - FEE_CONFIG.PERCENTAGE);
        const mitoFee = grossAmount - netAmount;

        return {
            netAmount,
            grossAmount,
            mitoFee,
        };
    }, [editForm.netFixedContributionAmount]);

    // Validation: New gross target cannot be less than what has already been raised
    const targetError = useMemo(() => {
        if (newTargetFeeBreakdown.grossAmount < summary.totalRaised) {
            return `Target cannot be lower than collected amount (${formatCurrency(summary.totalRaised, campaign?.currency || 'GBP')})`;
        }
        return null;
    }, [newTargetFeeBreakdown.grossAmount, summary.totalRaised, campaign?.currency]);

    // Validation: Fixed contribution cannot exceed target amount (net amounts)
    const fixedAmountError = useMemo(() => {
        if (!editForm.useFixedAmount || !editForm.netFixedContributionAmount || !editForm.netTargetAmount) {
            return null;
        }
        const fixedNet = parseFloat(editForm.netFixedContributionAmount);
        const targetNet = parseFloat(editForm.netTargetAmount);
        if (fixedNet > targetNet) {
            return "Fixed contribution cannot exceed the target amount";
        }
        return null;
    }, [editForm.useFixedAmount, editForm.netFixedContributionAmount, editForm.netTargetAmount]);

    const handleSaveEdit = () => {
        if (targetError || fixedAmountError) return;

        updateCampaign(campaignId, {
            name: editForm.name,
            description: editForm.description,
            targetAmount: newTargetFeeBreakdown.grossAmount,
            fixedContributionAmount: editForm.useFixedAmount && editForm.netFixedContributionAmount
                ? newFixedFeeBreakdown.grossAmount
                : undefined
        });
        setIsEditModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
    };

    function formatCurrency(amount: number, currency: string) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    }

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    };

    if (!campaign) {
        return (
            <DashboardLayout>
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Campaign not found</p>
                    <Link href="/group-pay">
                        <Button variant="outline" className="mt-4">Back to Dashboard</Button>
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    const remainingAmount = campaign.targetAmount - summary.totalRaised;
    const progress = (summary.totalRaised / campaign.targetAmount) * 100;
    const feeAmount = campaign.targetAmount - ((campaign.targetAmount * (1 - FEE_CONFIG.PERCENTAGE)) - FEE_CONFIG.FIXED_FEE);

    // Calculate total fees on raised amount for display
    const totalFees = (summary.totalRaised * FEE_CONFIG.PERCENTAGE) + (summary.contributorCount * FEE_CONFIG.FIXED_FEE);
    const netRaised = Math.max(0, summary.totalRaised - totalFees);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex items-start gap-4 flex-1">
                        <Link href="/group-pay">
                            <Button variant="ghost" size="icon" className="rounded-full mt-1">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold font-display">{campaign.name}</h1>
                            </div>
                            <p className="text-muted-foreground">{campaign.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pl-14 md:pl-0">
                        {/* Edit / Settings Button */}
                        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 border-gray-300 text-gray-700 hover:text-gray-900 shadow-sm font-medium">
                                    <Edit2 className="w-4 h-4" />
                                    Edit & Settings
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Edit Campaign</DialogTitle>
                                    <DialogDescription>
                                        Update your campaign details and settings.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Campaign Name</Label>
                                        <Input
                                            value={editForm.name}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                            rows={3}
                                        />
                                    </div>

                                    {/* Target Amount Edit */}
                                    <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <Label>Update Net Target Amount (What you receive)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                value={editForm.netTargetAmount}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, netTargetAmount: e.target.value }))}
                                                className={targetError ? "border-red-300 focus-visible:ring-red-200" : ""}
                                            />
                                            <div className="w-16 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium">
                                                {campaign.currency}
                                            </div>
                                        </div>

                                        {targetError ? (
                                            <div className="flex items-center gap-2 text-sm text-red-600 font-medium animate-in fade-in slide-in-from-top-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {targetError}
                                            </div>
                                        ) : (
                                            <div className="space-y-1 pt-1">
                                                <div className="flex justify-between items-center text-sm text-gray-600">
                                                    <span>Net Amount:</span>
                                                    <span>{formatCurrency(newTargetFeeBreakdown.netAmount, campaign.currency)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm text-orange-600">
                                                    <span>Mito Fee ({FEE_CONFIG.PERCENTAGE * 100}% + {campaign.currency}{FEE_CONFIG.FIXED_FEE.toFixed(2)}):</span>
                                                    <span>{formatCurrency(newTargetFeeBreakdown.mitoFee, campaign.currency)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm font-semibold text-gray-900 border-t pt-1">
                                                    <span>Campaign Target (Gross):</span>
                                                    <span>{formatCurrency(newTargetFeeBreakdown.grossAmount, campaign.currency)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Fixed Contribution Edit */}
                                    <div className="space-y-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Lock className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <Label htmlFor="edit-fixed-toggle" className="text-sm font-semibold cursor-pointer">
                                                        Fixed Contribution Amount
                                                    </Label>
                                                </div>
                                            </div>
                                            <Switch
                                                id="edit-fixed-toggle"
                                                checked={editForm.useFixedAmount}
                                                onCheckedChange={(checked) => setEditForm(prev => ({
                                                    ...prev,
                                                    useFixedAmount: checked,
                                                    netFixedContributionAmount: checked ? prev.netFixedContributionAmount : ""
                                                }))}
                                            />
                                        </div>

                                        {editForm.useFixedAmount && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="space-y-3 pt-2"
                                            >
                                                <div className="space-y-2">
                                                    <Label>Net Amount per Contributor</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="number"
                                                            value={editForm.netFixedContributionAmount}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, netFixedContributionAmount: e.target.value }))}
                                                            className={fixedAmountError ? "border-red-300 focus-visible:ring-red-200" : ""}
                                                            placeholder="25.00"
                                                        />
                                                        <div className="w-16 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium">
                                                            {campaign.currency}
                                                        </div>
                                                    </div>
                                                </div>

                                                {fixedAmountError ? (
                                                    <div className="flex items-center gap-2 text-sm text-red-600 font-medium animate-in fade-in slide-in-from-top-1">
                                                        <AlertCircle className="w-4 h-4" />
                                                        {fixedAmountError}
                                                    </div>
                                                ) : (
                                                    editForm.netFixedContributionAmount && (
                                                        <div className="bg-white rounded-lg p-3 border border-blue-100 text-sm space-y-1">
                                                            <div className="flex justify-between text-gray-600">
                                                                <span>You receive:</span>
                                                                <span>{formatCurrency(newFixedFeeBreakdown.netAmount, campaign.currency)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-orange-600">
                                                                <span>Mito Fee:</span>
                                                                <span>{formatCurrency(newFixedFeeBreakdown.mitoFee, campaign.currency)}</span>
                                                            </div>
                                                            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                                                                <span className="text-gray-900">Contributor pays:</span>
                                                                <span className="text-blue-600">{formatCurrency(newFixedFeeBreakdown.grossAmount, campaign.currency)}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSaveEdit} disabled={!!targetError || !!fixedAmountError} className="bg-blue-600 hover:bg-blue-700">
                                        <Save className="w-4 h-4 mr-2" /> Save Changes
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${campaign.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : campaign.status === 'paused'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </span>

                        {summary.totalRaised > 0 ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={handleToggleStatus}
                            >
                                {campaign.status === 'active' ? (
                                    <>
                                        <PauseCircle className="w-4 h-4" /> Pause
                                    </>
                                ) : (
                                    <>
                                        <PlayCircle className="w-4 h-4" /> Resume
                                    </>
                                )}
                            </Button>
                        ) : (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete "{campaign.name}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>

                {/* Summary Section */}
                <div className="space-y-4">
                    {/* Hero Funds Overview Card */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white overflow-hidden relative">
                            {/* Background Pattern */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />

                            <CardContent className="p-6 md:p-8">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                    <div className="space-y-2 text-center md:text-left">
                                        <div className="flex items-center justify-center md:justify-start gap-2 text-blue-100 mb-1">
                                            <TrendingUp className="w-5 h-5" />
                                            <span className="font-medium">Funds Overview</span>
                                        </div>
                                        <div>
                                            <p className="text-sm text-blue-100 mb-1">You Get (Net)</p>
                                            <p className="text-5xl md:text-6xl font-bold tracking-tight">{formatCurrency(netRaised, campaign.currency)}</p>
                                        </div>
                                    </div>

                                    {/* Breakdown Container */}
                                    <div className="flex-1 w-full md:max-w-md bg-black/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-blue-200">Total Raised</p>
                                                <p className="text-xl font-semibold">{formatCurrency(summary.totalRaised, campaign.currency)}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-xs text-blue-200">Fees charged</p>
                                                <p className="text-xl font-semibold text-blue-100">{formatCurrency(totalFees, campaign.currency)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Secondary Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="h-full border-0 shadow-md relative overflow-hidden">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <Target className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <span className="text-muted-foreground text-sm font-medium">Target</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(campaign.targetAmount, campaign.currency)}</p>
                                    <div className="text-xs text-orange-600 mt-1 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded-full border border-orange-100">
                                        Includes fee
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <Card className="h-full border-0 shadow-md">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                            <Target className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <span className="text-muted-foreground text-sm font-medium">Remaining</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(Math.max(0, remainingAmount), campaign.currency)}</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <Card className="h-full border-0 shadow-md">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                                            <Users className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <span className="text-muted-foreground text-sm font-medium">Contributors</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{summary.contributorCount}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>

                {/* Progress Bar */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">Campaign Progress</span>
                            <span className="text-muted-foreground">{progress.toFixed(1)}% complete</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${campaign.status === 'paused' ? 'bg-slate-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                    }`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Share Link */}
                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                                <Share2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Share Campaign</h3>
                                <p className="text-sm text-muted-foreground">Share this link to collect contributions</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={campaign.uniqueLink}
                                readOnly
                                className="bg-gray-50 font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                onClick={handleCopyLink}
                                className={`gap-2 ${copied ? "bg-green-50 text-green-600 border-green-200" : ""}`}
                            >
                                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Contributors Table */}
                <Card>
                    <CardContent className="p-5">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-muted-foreground" />
                            Contributors ({contributors.length})
                        </h3>

                        {contributors.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>No contributions yet</p>
                                <p className="text-sm">Share your campaign link to start receiving contributions</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Contributor</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contributors.map((contributor, index) => (
                                            <motion.tr
                                                key={contributor.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="border-b last:border-0 hover:bg-gray-50"
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                                            {contributor.name.charAt(0)}
                                                        </div>
                                                        <span className="font-medium">{contributor.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-muted-foreground text-sm">{contributor.email}</td>
                                                <td className="py-3 px-4 text-muted-foreground text-sm">{formatDate(contributor.paymentDate)}</td>
                                                <td className="py-3 px-4 text-right font-semibold text-green-600">
                                                    {formatCurrency(contributor.amount, campaign.currency)}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout >
    );
}
