import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Send, Phone, Receipt, ArrowRight, Gift, Copy, Sparkles } from "lucide-react";
import { RequestPaymentModal } from "@/components/RequestPaymentModal";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const recentRecipients = [
  { id: 1, name: "Oluwas...", initials: "OA", color: "bg-blue-500" },
  { id: 2, name: "Profilea", initials: "PL", color: "bg-purple-500" },
  { id: 3, name: "Testing...", initials: "T", color: "bg-gray-400" },
  { id: 4, name: "Steve", initials: "SS", color: "bg-teal" },
];

const recentTransactions = [
  {
    id: "22502784",
    recipient: "Bob Woolmer",
    service: "Bank Deposit",
    date: "29 Oct 2025",
    amount: "GBP 60.00",
    status: "pending",
  },
  {
    id: "22502785",
    recipient: "Sarah Chen",
    service: "Mobile Money",
    date: "28 Oct 2025",
    amount: "GBP 150.00",
    status: "completed",
  },
  {
    id: "22502786",
    recipient: "James Okonkwo",
    service: "Bank Deposit",
    date: "27 Oct 2025",
    amount: "GBP 200.00",
    status: "completed",
  },
];

const scheduledTransactions = [
  {
    id: "SCH001",
    recipient: "Monthly Rent",
    service: "Bank Transfer",
    date: "01 Nov 2025",
    amount: "GBP 800.00",
    status: "scheduled",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // Bonus State - Hardcoded for Prototype
  const [bonusBalance] = useState(5);

  const handlePaymentOptionSelect = (option: "request" | "invoice" | "qrcode") => {
    setShowPaymentModal(false);
    switch (option) {
      case "request":
        setLocation("/request-payment");
        break;
      case "invoice":
        setLocation("/send-invoice");
        break;
      case "qrcode":
        setLocation("/show-qr-code");
        break;
    }
  };

  return (
    <DashboardLayout>
      <RequestPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onSelect={handlePaymentOptionSelect}
      />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4 md:space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.h1
            variants={itemVariants}
            className="text-xl md:text-2xl font-semibold font-display"
          >
            Welcome Olayinka
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-50 to-purple-50 text-purple-700 px-4 py-2 rounded-full border border-purple-100 shadow-sm"
          >
            <div className="bg-white p-1 rounded-full shadow-sm">
              <Gift className="w-4 h-4 text-pink-500" />
            </div>
            <span className="text-xs md:text-sm font-medium">
              You have earned <span className="font-bold">£{bonusBalance.toFixed(2)} Referral Bonus Credit</span>. Create a Transaction to use it.
            </span>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          <motion.div variants={itemVariants}>
            <Card className="h-full bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 border border-white/40 shadow-2xl shadow-blue-100/50 overflow-hidden relative group hover:shadow-[0_20px_50px_rgba(59,130,246,0.15)] transition-all duration-500 backdrop-blur-sm">
              {/* Ambient glow effects */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-400/20 via-indigo-400/15 to-purple-400/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-emerald-400/15 to-teal-400/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />

              {/* Subtle animated border gradient */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <CardHeader className="pb-4 md:pb-5 px-5 md:px-7 pt-5 md:pt-6 relative z-10">
                <CardTitle className="text-base md:text-lg font-bold text-gray-800 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/50">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent">
                    Quick Services
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-5 md:px-7 pb-6 relative z-10">
                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="relative group/btn">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-40 group-hover/btn:opacity-60 transition-opacity duration-300" />
                  <Button
                    className="relative w-full justify-start gap-4 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700 text-white h-14 md:h-16 text-sm font-semibold rounded-2xl shadow-xl shadow-blue-300/40 transition-all duration-300 border border-white/20"
                    onClick={() => setLocation("/send-money")}
                    data-testid="button-send-money"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <Send className="w-5 h-5" />
                    </div>
                    <span className="flex-1 text-left text-[15px]">Send Money</span>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="relative group/btn">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl blur-lg opacity-40 group-hover/btn:opacity-60 transition-opacity duration-300" />
                  <Button
                    className="relative w-full justify-start gap-4 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-600 hover:from-violet-700 hover:via-purple-600 hover:to-fuchsia-700 text-white h-14 md:h-16 text-sm font-semibold rounded-2xl shadow-xl shadow-purple-300/40 transition-all duration-300 border border-white/20"
                    data-testid="button-airtime-topup"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <Phone className="w-5 h-5" />
                    </div>
                    <span className="flex-1 text-left text-[15px]">Airtime Topup</span>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="relative group/btn">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur-lg opacity-40 group-hover/btn:opacity-60 transition-opacity duration-300" />
                  <Button
                    className="relative w-full justify-start gap-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700 text-white h-14 md:h-16 text-sm font-semibold rounded-2xl shadow-xl shadow-emerald-300/40 transition-all duration-300 border border-white/20"
                    onClick={() => setShowPaymentModal(true)}
                    data-testid="button-request-payment"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <span className="flex-1 text-left text-[15px]">Request Payment</span>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 border-indigo-100/50 shadow-lg shadow-indigo-100/30 overflow-hidden relative">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-violet-200/30 to-pink-200/30 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

              <CardHeader className="pb-2 px-4 md:px-6 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-300/50">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm md:text-base font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">Refer & Earn</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6 space-y-4 relative z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-indigo-200/50 shadow-inner cursor-default hover:shadow-md hover:border-indigo-300/70 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md">
                          <Gift className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bonus Credit</span>
                          <p className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">£{bonusBalance.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Ready to use</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a Transaction to redeem your Bonus Credit</p>
                  </TooltipContent>
                </Tooltip>

                <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-indigo-700">Invite friends</span> with your link and get <span className="font-bold text-emerald-600">£10 bonus credit</span> when they join and make their first transfer.
                </p>

                <div className="flex items-center gap-2 bg-white border-2 border-dashed border-indigo-200 rounded-xl p-3 hover:border-indigo-400 transition-colors group">
                  <div className="flex-1 truncate text-sm font-mono font-medium text-indigo-600 select-all">
                    rhemito.com/ref/OLAYINKA2025
                  </div>
                  <Button size="sm" className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all">
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="text-sm md:text-base font-semibold text-blue-600">Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                {/* Account Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Account</span>
                    <span className="text-sm">210145</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sent</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-teal">750895.75</span>
                      <Select defaultValue="GBP">
                        <SelectTrigger className="h-7 w-[75px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Wallet Section */}
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Wallet</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-600">253007.92</span>
                      <Select defaultValue="GBP">
                        <SelectTrigger className="h-7 w-[75px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Collection Account Section */}
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Collection Account</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-600">4357384.08</span>
                      <Select defaultValue="GBP">
                        <SelectTrigger className="h-7 w-[75px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants}>
          <Card className="border-gray-100/80 shadow-xl shadow-gray-100/50 overflow-hidden">
            <CardContent className="p-0">
              <Tabs defaultValue="recent" className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-6 pt-4 md:pt-5 pb-3 gap-2 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
                  <TabsList className="bg-transparent h-auto p-0 gap-4 md:gap-8 w-full sm:w-auto">
                    <TabsTrigger
                      value="recent"
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 font-semibold text-sm data-[state=active]:text-blue-600 text-gray-500 hover:text-gray-700 transition-colors"
                      data-testid="tab-recent-transactions"
                    >
                      Recent Transactions
                    </TabsTrigger>
                    <TabsTrigger
                      value="scheduled"
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 font-semibold text-sm data-[state=active]:text-blue-600 text-gray-500 hover:text-gray-700 transition-colors"
                      data-testid="tab-scheduled-transactions"
                    >
                      Scheduled
                    </TabsTrigger>
                  </TabsList>
                  <Button variant="ghost" className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium hidden sm:flex gap-1.5 h-9 px-3 rounded-lg">
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                <TabsContent value="recent" className="m-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-gray-50/50 border-b border-gray-100">
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px] md:w-[130px] py-4">Ref No.</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Recipient</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell py-4">Service</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell py-4">Date</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right py-4">Amount</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center py-4">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell py-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentTransactions.map((tx, index) => (
                          <TableRow
                            key={tx.id}
                            data-testid={`row-transaction-${tx.id}`}
                            className="hover:bg-blue-50/50 transition-colors duration-200 group border-b border-gray-50 last:border-b-0"
                          >
                            <TableCell className="font-semibold text-blue-600 text-sm py-4">{tx.id}</TableCell>
                            <TableCell className="text-sm font-medium text-gray-900 py-4">{tx.recipient}</TableCell>
                            <TableCell className="text-gray-500 text-sm hidden md:table-cell py-4">{tx.service}</TableCell>
                            <TableCell className="text-gray-500 text-sm hidden sm:table-cell py-4">{tx.date}</TableCell>
                            <TableCell className="text-right font-bold text-gray-900 text-sm py-4">{tx.amount}</TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex items-center justify-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tx.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tx.status === "completed" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                  {tx.status === "completed" ? "Completed" : "Pending"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell py-4">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
                                data-testid={`button-resend-${tx.id}`}
                              >
                                Resend
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="scheduled" className="m-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-gray-50/50 border-b border-gray-100">
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px] md:w-[130px] py-4">Ref No.</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Recipient</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell py-4">Service</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell py-4">Date</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right py-4">Amount</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center py-4">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell py-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduledTransactions.map((tx) => (
                          <TableRow
                            key={tx.id}
                            data-testid={`row-scheduled-${tx.id}`}
                            className="hover:bg-blue-50/50 transition-colors duration-200 group border-b border-gray-50 last:border-b-0"
                          >
                            <TableCell className="font-semibold text-blue-600 text-sm py-4">{tx.id}</TableCell>
                            <TableCell className="text-sm font-medium text-gray-900 py-4">{tx.recipient}</TableCell>
                            <TableCell className="text-gray-500 text-sm hidden md:table-cell py-4">{tx.service}</TableCell>
                            <TableCell className="text-gray-500 text-sm hidden sm:table-cell py-4">{tx.date}</TableCell>
                            <TableCell className="text-right font-bold text-gray-900 text-sm py-4">{tx.amount}</TableCell>
                            <TableCell className="text-center py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Scheduled
                              </span>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell py-4">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-4 text-xs font-medium rounded-lg border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                                data-testid={`button-cancel-${tx.id}`}
                              >
                                Cancel
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
