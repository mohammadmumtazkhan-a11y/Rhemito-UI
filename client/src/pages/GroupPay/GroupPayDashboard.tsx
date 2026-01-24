import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, Calendar, PauseCircle, PlayCircle, Trash2, Search, Filter, X, RotateCcw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAllCampaigns, getCampaignSummary, deleteCampaign, toggleCampaignStatus } from "./mockData";
import { Campaign } from "./types";
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

export default function GroupPayDashboard() {
    const [campaigns, setCampaigns] = useState<Campaign[]>(getAllCampaigns());
    const [refresh, setRefresh] = useState(0);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [filters, setFilters] = useState({
        currency: "GBP", // Default to GBP or empty for all
        minTarget: "",
        maxTarget: "",
        startDate: "",
        endDate: ""
    });

    const handleRefresh = () => {
        setCampaigns(getAllCampaigns());
        setRefresh(prev => prev + 1);
    };

    const handleToggleStatus = (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // Prevent card click
        toggleCampaignStatus(id);
        handleRefresh();
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // Prevent card click
        deleteCampaign(id);
        handleRefresh();
    };

    // Filter Logic
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(campaign => {
            // Search
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = campaign.name.toLowerCase().includes(searchLower) ||
                campaign.description?.toLowerCase().includes(searchLower);

            // Currency
            const matchesCurrency = !filters.currency || campaign.currency === filters.currency;

            // Target Range
            const matchesMinTarget = !filters.minTarget || campaign.targetAmount >= Number(filters.minTarget);
            const matchesMaxTarget = !filters.maxTarget || campaign.targetAmount <= Number(filters.maxTarget);

            // Date Range
            const campaignDate = new Date(campaign.createdAt);
            // Set start date to beginning of day
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            if (startDate) startDate.setHours(0, 0, 0, 0);

            // Set end date to end of day
            const endDate = filters.endDate ? new Date(filters.endDate) : null;
            if (endDate) endDate.setHours(23, 59, 59, 999);

            const matchesStartDate = !startDate || campaignDate >= startDate;
            const matchesEndDate = !endDate || campaignDate <= endDate;

            return matchesSearch && matchesCurrency && matchesMinTarget && matchesMaxTarget && matchesStartDate && matchesEndDate;
        });
    }, [campaigns, searchQuery, filters]);

    const clearFilters = () => {
        setFilters({
            currency: "GBP",
            minTarget: "",
            maxTarget: "",
            startDate: "",
            endDate: ""
        });
        setSearchQuery("");
    };

    const hasActiveFilters = searchQuery || filters.minTarget || filters.maxTarget || filters.startDate || filters.endDate;

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(new Date(date));
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Home / Funding Campaigns</p>
                        <div className="flex items-center gap-2 mt-1">
                            <h1 className="text-2xl font-bold font-display">Funding Campaigns</h1>
                            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {filteredCampaigns.length}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1">Create and manage funding campaigns</p>
                    </div>
                    <Link href="/group-pay/create">
                        <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200/50">
                            <Plus className="w-4 h-4" />
                            Create Funding Campaign
                        </Button>
                    </Link>
                </div>

                {/* Search and Filter Section */}
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search campaigns..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            className={`gap-2 ${isFiltersOpen || hasActiveFilters ? 'text-blue-600 border-blue-200 bg-blue-50' : ''}`}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            )}
                        </Button>
                    </div>

                    <AnimatePresence>
                        {isFiltersOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <Card>
                                    <CardContent className="p-4 bg-gray-50/50">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Currency</Label>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={filters.currency}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
                                                >
                                                    <option value="">All Currencies</option>
                                                    <option value="GBP">GBP (£)</option>
                                                    <option value="USD">USD ($)</option>
                                                    <option value="EUR">EUR (€)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs">Target Amount Range</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        placeholder="Min"
                                                        value={filters.minTarget}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, minTarget: e.target.value }))}
                                                    />
                                                    <Input
                                                        type="number"
                                                        placeholder="Max"
                                                        value={filters.maxTarget}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, maxTarget: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs">Date Range</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="date"
                                                        className="text-xs"
                                                        value={filters.startDate}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                    />
                                                    <Input
                                                        type="date"
                                                        className="text-xs"
                                                        value={filters.endDate}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-end">
                                                <Button
                                                    variant="ghost"
                                                    onClick={clearFilters}
                                                    className="w-full text-muted-foreground hover:text-gray-900"
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-2" />
                                                    Clear Logic
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Campaigns Grid */}
                {filteredCampaigns.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                {hasActiveFilters ? (
                                    <Search className="w-8 h-8 text-gray-400" />
                                ) : (
                                    <Users className="w-8 h-8 text-blue-600" />
                                )}
                            </div>
                            <h3 className="text-lg font-semibold mb-2">
                                {hasActiveFilters ? "No matching campaigns" : "No campaigns yet"}
                            </h3>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                {hasActiveFilters
                                    ? "Try adjusting your search or filters to find what you're looking for."
                                    : "Create your first funding campaign to start collecting money from multiple contributors."
                                }
                            </p>
                            {hasActiveFilters ? (
                                <Button variant="outline" onClick={clearFilters}>
                                    Clear Filters
                                </Button>
                            ) : (
                                <Link href="/group-pay/create">
                                    <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600">
                                        <Plus className="w-4 h-4" />
                                        Create Your First Campaign
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCampaigns.map((campaign, index) => {
                            const summary = getCampaignSummary(campaign.id);
                            const progress = (summary.totalRaised / campaign.targetAmount) * 100;

                            return (
                                <motion.div
                                    key={campaign.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Link href={`/group-pay/${campaign.id}`}>
                                        <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 shadow-md overflow-hidden group">
                                            {/* Gradient Header */}
                                            <div className={`p-4 text-white transition-colors ${campaign.status === 'paused'
                                                ? 'bg-gradient-to-br from-slate-500 to-slate-600'
                                                : 'bg-gradient-to-br from-blue-600 to-indigo-700'
                                                }`}>
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold text-lg truncate">{campaign.name}</h3>
                                                        <p className="text-blue-100 text-sm truncate opacity-90">{campaign.description}</p>
                                                    </div>
                                                    {campaign.status === 'paused' && (
                                                        <PauseCircle className="w-5 h-5 text-white/80 shrink-0" />
                                                    )}
                                                </div>
                                            </div>

                                            <CardContent className="p-4 space-y-4">
                                                {/* Progress */}
                                                <div>
                                                    <div className="flex justify-between text-sm mb-2">
                                                        <span className="font-semibold text-lg">
                                                            {formatCurrency(summary.totalRaised, campaign.currency)}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            of {formatCurrency(campaign.targetAmount, campaign.currency)}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${campaign.status === 'paused' ? 'bg-slate-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                                                }`}
                                                            style={{ width: `${Math.min(progress, 100)}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {progress.toFixed(0)}% of target reached
                                                    </p>
                                                </div>

                                                {/* Stats */}
                                                <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="w-4 h-4" />
                                                        <span>{summary.contributorCount} contributors</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>{formatDate(campaign.createdAt)}</span>
                                                    </div>
                                                </div>

                                                {/* Status Badge & Actions */}
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${campaign.status === 'active'
                                                        ? 'bg-green-100 text-green-700'
                                                        : campaign.status === 'completed'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : campaign.status === 'paused'
                                                                ? 'bg-slate-100 text-slate-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                                                    </span>

                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        {summary.totalRaised > 0 ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs gap-1"
                                                                onClick={(e) => handleToggleStatus(e, campaign.id)}
                                                            >
                                                                {campaign.status === 'active' ? (
                                                                    <>
                                                                        <PauseCircle className="w-3 h-3" /> Pause
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <PlayCircle className="w-3 h-3" /> Resume
                                                                    </>
                                                                )}
                                                            </Button>
                                                        ) : (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 px-2 text-xs gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" /> Delete
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
                                                                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={(e) => handleDelete(e, campaign.id)}
                                                                            className="bg-red-600 hover:bg-red-700"
                                                                        >
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}

                                                        <Link href={`/group-pay/${campaign.id}`}>
                                                            <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 ml-1">
                                                                View
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
