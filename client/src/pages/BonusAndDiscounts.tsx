import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Wallet,
    TrendingUp,
    Gift,
    ArrowUpRight,
    ArrowDownLeft,
    Tag,
    Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function BonusAndDiscounts() {
    const [, setLocation] = useLocation();
    // Mock Data for Prototype
    const BONUS_BALANCE = 5.00;
    const TOTAL_EARNED = 30.00; // Total lifetime earned
    const TOTAL_REDEEMED = 25.00; // Total bonus used + Discount promo value

    type Transaction = {
        id: string;
        date: string;
        type: 'earned' | 'redeemed' | 'promo_code';
        description: string;
        amount: number;
        status: 'completed' | 'pending';
    };

    const transactions: Transaction[] = [
        { id: "TX101", date: "2024-05-15", type: 'earned', description: "Referral Bonus - John Doe", amount: 5.00, status: 'completed' },
        { id: "TX102", date: "2024-05-18", type: 'redeemed', description: "Bonus Used on Transfer to Mom", amount: 5.00, status: 'completed' },
        { id: "TX103", date: "2024-06-01", type: 'promo_code', description: "Promo Code 'WELCOME' Applied", amount: 10.00, status: 'completed' },
        { id: "TX104", date: "2024-06-10", type: 'earned', description: "Referral Bonus - Sarah Smith", amount: 5.00, status: 'completed' },
        { id: "TX105", date: "2024-06-20", type: 'redeemed', description: "Bonus Used on Bill Payment", amount: 5.00, status: 'completed' },
        { id: "TX106", date: "2024-07-01", type: 'earned', description: "Referral Bonus - Mike Ross", amount: 5.00, status: 'completed' },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bonus & Discounts</h1>
                    <p className="text-muted-foreground mt-2">Track your earnings and savings from bonuses and promo codes.</p>
                </div>

                {/* Overview Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-green-700">Available Bonus Balance</CardTitle>
                            <Wallet className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">£{BONUS_BALANCE.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1 mb-4">Ready to use on next transfer</p>
                            <Button
                                size="sm"
                                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all duration-300 group"
                                onClick={() => setLocation("/send-money")}
                            >
                                <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                                Send Money
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Lifetime Earnings</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">£{TOTAL_EARNED.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">From all referrals</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
                            <Tag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">£{TOTAL_REDEEMED.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Via Bonuses & Promo Codes</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Transaction Ledger */}
                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gift className="w-5 h-5 text-blue-500" />
                            Transaction History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <div className="grid grid-cols-4 gap-4 p-4 font-medium text-sm bg-gray-50 border-b text-gray-500">
                                <div>Date</div>
                                <div>Description</div>
                                <div>Type</div>
                                <div className="text-right">Amount</div>
                            </div>
                            <div className="divide-y">
                                {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((tx) => (
                                    <div key={tx.id} className="grid grid-cols-4 gap-4 p-4 text-sm items-center hover:bg-gray-50/50 transition-colors">
                                        <div className="font-mono text-gray-600">{tx.date}</div>
                                        <div className="font-medium text-gray-900">{tx.description}</div>
                                        <div>
                                            <Badge
                                                variant="outline"
                                                className={`
                                                    ${tx.type === 'earned' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                    ${tx.type === 'redeemed' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                                                    ${tx.type === 'promo_code' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                `}
                                            >
                                                {tx.type === 'earned' && <ArrowUpRight className="w-3 h-3 mr-1" />}
                                                {tx.type === 'redeemed' && <ArrowDownLeft className="w-3 h-3 mr-1" />}
                                                {tx.type === 'promo_code' && <Tag className="w-3 h-3 mr-1" />}
                                                {tx.type.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className={`text-right font-bold ${tx.type === 'earned' ? 'text-green-600' : 'text-gray-900'}`}>
                                            {tx.type === 'earned' ? '+' : '-'}£{tx.amount.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
