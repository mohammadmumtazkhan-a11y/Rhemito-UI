import { Link } from "wouter";
import { motion } from "framer-motion";
import { Send, Phone, Receipt, ArrowRight } from "lucide-react";
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
  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <motion.h1 
          variants={itemVariants}
          className="text-2xl font-semibold font-display"
        >
          Welcome Olayinka
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-teal">Quick Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-white h-12"
                  data-testid="button-send-money"
                >
                  <Send className="w-4 h-4" />
                  Send Money
                </Button>
                <Button 
                  className="w-full justify-start gap-3 bg-purple hover:bg-purple/90 text-white h-12"
                  data-testid="button-airtime-topup"
                >
                  <Phone className="w-4 h-4" />
                  Airtime Topup
                </Button>
                <Link href="/request-payment">
                  <Button 
                    className="w-full justify-start gap-3 bg-teal hover:bg-teal/90 text-white h-12"
                    data-testid="button-request-payment"
                  >
                    <Receipt className="w-4 h-4" />
                    Request Payment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Recent Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-6">
                  {recentRecipients.map((recipient) => (
                    <motion.div
                      key={recipient.id}
                      whileHover={{ scale: 1.05 }}
                      className="flex flex-col items-center gap-2 cursor-pointer"
                      data-testid={`recipient-${recipient.id}`}
                    >
                      <div className={`w-12 h-12 rounded-full ${recipient.color} flex items-center justify-center`}>
                        <span className="text-white font-semibold text-sm">{recipient.initials}</span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                        {recipient.name}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-purple">Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Account</span>
                  <span className="font-semibold">235324</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sent</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-teal">48744.64</span>
                    <Badge variant="outline" className="text-xs">GBP</Badge>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Wallet</span>
                  <span className="text-sm text-muted-foreground">Balance</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">300</span>
                  <Badge variant="outline" className="text-xs">GBP</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="recent" className="w-full">
                <div className="flex items-center justify-between px-6 pt-4">
                  <TabsList className="bg-transparent h-auto p-0 gap-6">
                    <TabsTrigger 
                      value="recent" 
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-medium"
                      data-testid="tab-recent-transactions"
                    >
                      Recent Transactions
                    </TabsTrigger>
                    <TabsTrigger 
                      value="scheduled" 
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-medium"
                      data-testid="tab-scheduled-transactions"
                    >
                      Recently Scheduled Transactions
                    </TabsTrigger>
                  </TabsList>
                  <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground">
                    View All
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <TabsContent value="recent" className="m-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[120px]">Ref No.</TableHead>
                        <TableHead>Recipient Name</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((tx) => (
                        <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                          <TableCell className="font-medium text-primary">{tx.id}</TableCell>
                          <TableCell>{tx.recipient}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.service}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                          <TableCell className="text-right font-medium">{tx.amount}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                              tx.status === "completed" ? "bg-teal" : "bg-destructive"
                            }`} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              size="sm" 
                              className="bg-primary hover:bg-primary/90 text-white h-8 px-4"
                              data-testid={`button-resend-${tx.id}`}
                            >
                              Resend
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="scheduled" className="m-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[120px]">Ref No.</TableHead>
                        <TableHead>Recipient Name</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledTransactions.map((tx) => (
                        <TableRow key={tx.id} data-testid={`row-scheduled-${tx.id}`}>
                          <TableCell className="font-medium text-primary">{tx.id}</TableCell>
                          <TableCell>{tx.recipient}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.service}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                          <TableCell className="text-right font-medium">{tx.amount}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-primary border-primary/20">
                              Scheduled
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 px-4"
                              data-testid={`button-cancel-${tx.id}`}
                            >
                              Cancel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
