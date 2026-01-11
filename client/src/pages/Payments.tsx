import { useState } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter,
  FileText,
  Link as LinkIcon,
  QrCode,
  UserPlus,
  X
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

interface Payment {
  id: string;
  senderName: string | null;
  senderEmail: string | null;
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  type: "invoice" | "payment_request" | "qr_code";
  date: string;
  reference: string;
}

const mockPayments: Payment[] = [
  {
    id: "1",
    senderName: "John Adeyemi",
    senderEmail: "john.adeyemi@email.com",
    amount: 500.00,
    currency: "GBP",
    status: "completed",
    type: "payment_request",
    date: "2026-01-11T14:30:00",
    reference: "REF-A1B2C3"
  },
  {
    id: "2",
    senderName: "Sarah Williams",
    senderEmail: "sarah.w@company.co.uk",
    amount: 1250.00,
    currency: "GBP",
    status: "completed",
    type: "invoice",
    date: "2026-01-10T09:15:00",
    reference: "INV-2026-001"
  },
  {
    id: "3",
    senderName: "Michael Chen",
    senderEmail: "m.chen@business.com",
    amount: 750.00,
    currency: "USD",
    status: "pending",
    type: "payment_request",
    date: "2026-01-09T16:45:00",
    reference: "REF-D4E5F6"
  },
  {
    id: "4",
    senderName: null,
    senderEmail: null,
    amount: 320.50,
    currency: "GBP",
    status: "completed",
    type: "qr_code",
    date: "2026-01-08T11:20:00",
    reference: "QR-G7H8I9"
  },
  {
    id: "5",
    senderName: null,
    senderEmail: null,
    amount: 890.00,
    currency: "EUR",
    status: "completed",
    type: "payment_request",
    date: "2026-01-07T08:00:00",
    reference: "REF-J0K1L2"
  },
  {
    id: "6",
    senderName: "Emma Thompson",
    senderEmail: "emma.t@mail.com",
    amount: 2100.00,
    currency: "GBP",
    status: "failed",
    type: "invoice",
    date: "2026-01-06T13:30:00",
    reference: "INV-2026-002"
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-teal" />;
    case "pending":
      return <Clock className="w-4 h-4 text-amber-500" />;
    case "failed":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-teal/10 text-teal hover:bg-teal/20">Completed</Badge>;
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">Pending</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Failed</Badge>;
    default:
      return null;
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "invoice":
      return <FileText className="w-4 h-4" />;
    case "payment_request":
      return <LinkIcon className="w-4 h-4" />;
    case "qr_code":
      return <QrCode className="w-4 h-4" />;
    default:
      return null;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "invoice":
      return "Invoice";
    case "payment_request":
      return "Payment Request";
    case "qr_code":
      return "QR Code";
    default:
      return type;
  }
};

export default function Payments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [allocateSenderName, setAllocateSenderName] = useState("");
  const [allocateSenderEmail, setAllocateSenderEmail] = useState("");

  const untracedPayments = mockPayments.filter(p => !p.senderName && p.status === "completed");
  const tracedPayments = mockPayments.filter(p => p.senderName);

  const filteredPayments = mockPayments.filter(payment => {
    const matchesSearch = 
      payment.senderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || payment.status === filterStatus;
    const matchesType = filterType === "all" || payment.type === filterType;

    return (searchQuery === "" || matchesSearch) && matchesStatus && matchesType;
  });

  const totalReceived = mockPayments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = mockPayments
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const handleAllocateSender = () => {
    setAllocateDialogOpen(false);
    setAllocateSenderName("");
    setAllocateSenderEmail("");
    setSelectedPayment(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold font-display">Payments</h1>
          <p className="text-muted-foreground mt-1">Track and manage your received payments</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-teal/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-teal" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Received</p>
                  <p className="text-2xl font-bold">£{totalReceived.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">£{pendingAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-purple" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Untraced Payments</p>
                  <p className="text-2xl font-bold">{untracedPayments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-payments">All Payments</TabsTrigger>
            <TabsTrigger value="untraced" data-testid="tab-untraced-payments">
              Untraced ({untracedPayments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-display">Payment History</CardTitle>
                    <CardDescription>View all received payments and their details</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search payments..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64"
                        data-testid="input-search-payments"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32" data-testid="select-filter-status">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-40" data-testid="select-filter-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="payment_request">Payment Request</SelectItem>
                        <SelectItem value="qr_code">QR Code</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPayments.map((payment) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`payment-row-${payment.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border">
                          {getTypeIcon(payment.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {payment.senderName || <span className="text-muted-foreground italic">Unknown Sender</span>}
                            </p>
                            {!payment.senderName && (
                              <Badge variant="outline" className="text-xs">Untraced</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{getTypeLabel(payment.type)}</span>
                            <span>•</span>
                            <span>{payment.reference}</span>
                            <span>•</span>
                            <span>{new Date(payment.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {CURRENCY_SYMBOLS[payment.currency]}{payment.amount.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">{payment.currency}</p>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>
                    </motion.div>
                  ))}

                  {filteredPayments.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No payments found matching your criteria</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="untraced">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Untraced Payments</CardTitle>
                <CardDescription>
                  These payments were received but couldn't be matched to a known sender. 
                  Allocate them to track your payment sources.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {untracedPayments.map((payment) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg"
                      data-testid={`untraced-payment-${payment.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-amber-300">
                          {getTypeIcon(payment.type)}
                        </div>
                        <div>
                          <p className="font-medium text-amber-800">Unknown Sender</p>
                          <div className="flex items-center gap-2 text-sm text-amber-700">
                            <span>{getTypeLabel(payment.type)}</span>
                            <span>•</span>
                            <span>{payment.reference}</span>
                            <span>•</span>
                            <span>{new Date(payment.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {CURRENCY_SYMBOLS[payment.currency]}{payment.amount.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">{payment.currency}</p>
                        </div>
                        <Button
                          onClick={() => {
                            setSelectedPayment(payment);
                            setAllocateDialogOpen(true);
                          }}
                          size="sm"
                          className="bg-primary"
                          data-testid={`button-allocate-${payment.id}`}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Allocate
                        </Button>
                      </div>
                    </motion.div>
                  ))}

                  {untracedPayments.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-teal" />
                      <p className="font-medium">All payments are traced!</p>
                      <p className="text-sm">No untraced payments at this time.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Allocate Payment to Sender</DialogTitle>
              <DialogDescription>
                Enter the sender's details to link this payment to them.
              </DialogDescription>
            </DialogHeader>
            
            {selectedPayment && (
              <div className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Amount</p>
                      <p className="text-xl font-bold">
                        {CURRENCY_SYMBOLS[selectedPayment.currency]}{selectedPayment.amount.toFixed(2)} {selectedPayment.currency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Reference</p>
                      <p className="font-medium">{selectedPayment.reference}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="allocateName">Sender Name *</Label>
                    <Input
                      id="allocateName"
                      placeholder="Enter sender's full name"
                      value={allocateSenderName}
                      onChange={(e) => setAllocateSenderName(e.target.value)}
                      data-testid="input-allocate-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allocateEmail">Sender Email (Optional)</Label>
                    <Input
                      id="allocateEmail"
                      type="email"
                      placeholder="Enter sender's email"
                      value={allocateSenderEmail}
                      onChange={(e) => setAllocateSenderEmail(e.target.value)}
                      data-testid="input-allocate-email"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setAllocateDialogOpen(false)}
                    className="flex-1"
                    data-testid="button-cancel-allocate"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAllocateSender}
                    disabled={!allocateSenderName}
                    className="flex-1 bg-primary"
                    data-testid="button-confirm-allocate"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Allocate Sender
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
