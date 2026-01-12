import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PayoutAccount {
  id: string;
  refNo: string;
  name: string;
  currency: string;
  bank: string;
  accountNumber: string;
  routingNumber: string;
  payout: string;
  activated: boolean;
}

const CURRENCIES = ["GBP", "USD", "EUR", "NGN"];
const COUNTRIES = ["United Kingdom", "United States", "Nigeria", "Germany"];
const BANKS: Record<string, string[]> = {
  "United Kingdom": ["Barclays", "HSBC", "Lloyds Bank", "NatWest", "Santander UK"],
  "United States": ["Bank of America", "Chase", "Wells Fargo", "Citibank"],
  "Nigeria": ["Access Bank Nigeria Plc", "GTBank", "First Bank", "Zenith Bank", "UBA"],
  "Germany": ["Deutsche Bank", "Commerzbank", "DZ Bank"],
};

const initialAccounts: PayoutAccount[] = [
  { id: "1", refNo: "1105", name: "John Doe", currency: "NGN", bank: "Access Bank Nigeria Plc", accountNumber: "12312300011-Default a/c", routingNumber: "N/A", payout: "NGN 10000", activated: true },
  { id: "2", refNo: "1106", name: "John Doe", currency: "GBP", bank: "Barclays", accountNumber: "12312300011", routingNumber: "20-45-67", payout: "GBP 10000", activated: true },
  { id: "3", refNo: "1107", name: "John Doe", currency: "USD", bank: "Chase", accountNumber: "12312300011", routingNumber: "021000021", payout: "USD 2000", activated: true },
];

export default function PayoutAccounts() {
  const [accounts, setAccounts] = useState<PayoutAccount[]>(initialAccounts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successText, setSuccessText] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    country: "United Kingdom",
    currency: "GBP",
    bank: "",
    accountNumber: "",
    routingNumber: "",
  });

  const handleAddAccount = () => {
    const existingCurrency = accounts.find(a => a.currency === formData.currency);
    if (existingCurrency) {
      alert(`You already have a payout account for ${formData.currency}. Only one account per currency is allowed.`);
      return;
    }

    const newAccount: PayoutAccount = {
      id: Date.now().toString(),
      refNo: (1100 + accounts.length + 1).toString(),
      name: `${formData.firstName} ${formData.lastName}`,
      currency: formData.currency,
      bank: formData.bank,
      accountNumber: formData.accountNumber,
      routingNumber: formData.routingNumber || "N/A",
      payout: `${formData.currency} 0`,
      activated: true,
    };

    setAccounts(prev => [...prev, newAccount]);
    setFormData({
      firstName: "",
      lastName: "",
      country: "United Kingdom",
      currency: "GBP",
      bank: "",
      accountNumber: "",
      routingNumber: "",
    });
    setShowAddForm(false);
    setSuccessText("Payout account added successfully!");
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    setShowDeleteConfirm(null);
    setSuccessText("Payout account deleted successfully!");
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
  };

  const availableBanks = BANKS[formData.country] || [];
  const availableCurrencies = CURRENCIES.filter(c => !accounts.find(a => a.currency === c));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AnimatePresence>
          {showSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-green-800 font-medium">{successText}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Home / Manage Payout Accounts</p>
            <h1 className="text-2xl font-bold font-display mt-1">Payout</h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Add bank account</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>First name *</Label>
                <Input
                  placeholder="Enter First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  data-testid="input-payout-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Last name *</Label>
                <Input
                  placeholder="Enter Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  data-testid="input-payout-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Country *</Label>
                <Select 
                  value={formData.country} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, country: value, bank: "" }))}
                >
                  <SelectTrigger data-testid="select-payout-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency *</Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger data-testid="select-payout-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency} disabled={accounts.some(a => a.currency === currency)}>
                        {currency} {accounts.some(a => a.currency === currency) && "(Already added)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Bank *</Label>
                <Select 
                  value={formData.bank} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, bank: value }))}
                >
                  <SelectTrigger data-testid="select-payout-bank">
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBanks.map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  placeholder="Enter account number"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                  data-testid="input-payout-account-number"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Code / Routing Number</Label>
                <Input
                  placeholder="Enter sort code"
                  value={formData.routingNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, routingNumber: e.target.value }))}
                  data-testid="input-payout-routing"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleAddAccount}
                disabled={!formData.firstName || !formData.lastName || !formData.bank || !formData.accountNumber}
                className="gap-2"
                data-testid="button-add-account"
              >
                <Plus className="w-4 h-4" />
                Add account
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-4">Accounts</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium">Ref No</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Name</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Currency</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Bank</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Account Number</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Routing Number</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Payout</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Activated</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-border last:border-b-0">
                    <td className="py-4 px-4">{account.refNo}</td>
                    <td className="py-4 px-4">{account.name}</td>
                    <td className="py-4 px-4">{account.currency}</td>
                    <td className="py-4 px-4">{account.bank}</td>
                    <td className="py-4 px-4">{account.accountNumber}</td>
                    <td className="py-4 px-4">{account.routingNumber}</td>
                    <td className="py-4 px-4">{account.payout}</td>
                    <td className="py-4 px-4">
                      <span className={`w-3 h-3 rounded-full inline-block ${account.activated ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="w-7 h-7 rounded bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                              data-testid={`button-edit-${account.id}`}
                            >
                              <Edit2 className="w-3.5 h-3.5 text-primary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setShowDeleteConfirm(account.id)}
                              className="w-7 h-7 rounded bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                              data-testid={`button-delete-${account.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {accounts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-muted-foreground">No payout accounts added yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
            >
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Delete Account?</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Are you sure you want to delete this payout account? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(null)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => handleDeleteAccount(showDeleteConfirm)}
                      data-testid="button-confirm-delete-account"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
