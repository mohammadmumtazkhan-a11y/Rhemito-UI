import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Send, Phone, Receipt, ArrowRight } from "lucide-react";
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
        <motion.h1
          variants={itemVariants}
          className="text-xl md:text-2xl font-semibold font-display"
        >
          Welcome Olayinka
        </motion.h1>

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
            <Card className="h-full bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="text-sm md:text-base font-semibold text-indigo-700">Refer & Earn</CardTitle>
              </CardHeader>
              <CardContent className="px-4 md:px-6 space-y-3">
                <p className="text-xs text-muted-foreground">Share your code and earn £10 bonus credit for every friend who joins!</p>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg p-2">
                  <code className="flex-1 text-sm font-bold text-center text-indigo-800">OLAYINKA2025</code>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><ArrowRight className="w-3 h-3 text-indigo-400" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="text-sm md:text-base font-semibold text-purple">Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 px-4 md:px-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs md:text-sm text-muted-foreground">Account</span>
                  <span className="font-semibold text-sm md:text-base">235324</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-xs md:text-sm font-medium">Wallet Balance</span>
                  <div className="text-right">
                    <div className="font-bold text-primary">£300.20</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs md:text-sm font-medium text-purple-600">Bonus Credit</span>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200">£15.00</Badge>
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
