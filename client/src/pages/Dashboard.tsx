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
            <Card className="h-full">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="text-sm md:text-base font-semibold text-teal">Quick Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 md:space-y-3 px-4 md:px-6">
                <Button
                  className="w-full justify-start gap-2 md:gap-3 bg-primary hover:bg-primary/90 text-white h-10 md:h-12 text-sm"
                  onClick={() => setLocation("/send-money")}
                  data-testid="button-send-money"
                >
                  <Send className="w-4 h-4" />
                  Send Money
                </Button>
                <Button
                  className="w-full justify-start gap-2 md:gap-3 bg-purple hover:bg-purple/90 text-white h-10 md:h-12 text-sm"
                  data-testid="button-airtime-topup"
                >
                  <Phone className="w-4 h-4" />
                  Airtime Topup
                </Button>
                <Button
                  className="w-full justify-start gap-2 md:gap-3 bg-teal hover:bg-teal/90 text-white h-10 md:h-12 text-sm"
                  onClick={() => setShowPaymentModal(true)}
                  data-testid="button-request-payment"
                >
                  <Receipt className="w-4 h-4" />
                  Request Payment
                </Button>
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
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="recent" className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 md:px-6 pt-3 md:pt-4 gap-2">
                  <TabsList className="bg-transparent h-auto p-0 gap-3 md:gap-6 w-full sm:w-auto">
                    <TabsTrigger
                      value="recent"
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 md:pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-medium text-xs md:text-sm"
                      data-testid="tab-recent-transactions"
                    >
                      Recent Transactions
                    </TabsTrigger>
                    <TabsTrigger
                      value="scheduled"
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 md:pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-medium text-xs md:text-sm"
                      data-testid="tab-scheduled-transactions"
                    >
                      Scheduled
                    </TabsTrigger>
                  </TabsList>
                  <Button variant="ghost" className="text-xs md:text-sm text-muted-foreground hover:text-foreground hidden sm:flex">
                    View All
                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-1" />
                  </Button>
                </div>

                <TabsContent value="recent" className="m-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs md:text-sm w-[100px] md:w-[120px]">Ref No.</TableHead>
                          <TableHead className="text-xs md:text-sm">Recipient</TableHead>
                          <TableHead className="text-xs md:text-sm hidden md:table-cell">Service</TableHead>
                          <TableHead className="text-xs md:text-sm hidden sm:table-cell">Date</TableHead>
                          <TableHead className="text-xs md:text-sm text-right">Amount</TableHead>
                          <TableHead className="text-xs md:text-sm text-center">Status</TableHead>
                          <TableHead className="text-xs md:text-sm text-center hidden sm:table-cell">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentTransactions.map((tx) => (
                          <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                            <TableCell className="font-medium text-primary text-xs md:text-sm">{tx.id}</TableCell>
                            <TableCell className="text-xs md:text-sm">{tx.recipient}</TableCell>
                            <TableCell className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">{tx.service}</TableCell>
                            <TableCell className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">{tx.date}</TableCell>
                            <TableCell className="text-right font-medium text-xs md:text-sm">{tx.amount}</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-block w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${tx.status === "completed" ? "bg-teal" : "bg-destructive"
                                }`} />
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <Button
                                size="sm"
                                className="bg-primary hover:bg-primary/90 text-white h-7 md:h-8 px-3 md:px-4 text-xs"
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
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs md:text-sm w-[100px] md:w-[120px]">Ref No.</TableHead>
                          <TableHead className="text-xs md:text-sm">Recipient</TableHead>
                          <TableHead className="text-xs md:text-sm hidden md:table-cell">Service</TableHead>
                          <TableHead className="text-xs md:text-sm hidden sm:table-cell">Date</TableHead>
                          <TableHead className="text-xs md:text-sm text-right">Amount</TableHead>
                          <TableHead className="text-xs md:text-sm text-center">Status</TableHead>
                          <TableHead className="text-xs md:text-sm text-center hidden sm:table-cell">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduledTransactions.map((tx) => (
                          <TableRow key={tx.id} data-testid={`row-scheduled-${tx.id}`}>
                            <TableCell className="font-medium text-primary text-xs md:text-sm">{tx.id}</TableCell>
                            <TableCell className="text-xs md:text-sm">{tx.recipient}</TableCell>
                            <TableCell className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">{tx.service}</TableCell>
                            <TableCell className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">{tx.date}</TableCell>
                            <TableCell className="text-right font-medium text-xs md:text-sm">{tx.amount}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[10px] md:text-xs bg-blue-50 text-primary border-primary/20">
                                Scheduled
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 md:h-8 px-3 md:px-4 text-xs"
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
