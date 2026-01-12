import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Send, Eye, Trash2, User, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WaysToGetPaidModal } from "@/components/modals/WaysToGetPaidModal";
import { knownSenders, type KnownSender } from "@/data/knownSenders";

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
];

const COUNTRIES = [
  "Nigeria", "United Kingdom", "United States", "Germany", "France", "Kenya", "Ghana"
];

export default function Senders() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [senders, setSenders] = useState<KnownSender[]>(knownSenders);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showWaysModal, setShowWaysModal] = useState(false);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<string>("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [newSender, setNewSender] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    countryCode: "+234",
    phone: "",
    dob: "",
    country: "Nigeria",
  });

  const filteredSenders = senders.filter(sender => {
    const fullName = `${sender.firstName} ${sender.middleName} ${sender.lastName}`.toLowerCase();
    const searchLower = searchQuery.toLowerCase();
    return fullName.includes(searchLower) || sender.country.toLowerCase().includes(searchLower);
  });

  const handleRequestPayment = (email: string) => {
    setSelectedSenderEmail(email);
    setShowWaysModal(true);
  };

  const handleViewSender = (email: string) => {
    setLocation(`/senders/${encodeURIComponent(email)}`);
  };

  const handleDeleteSender = (email: string) => {
    setSenders(prev => prev.filter(s => s.email !== email));
    setShowDeleteConfirm(null);
  };

  const handleAddSender = () => {
    const sender: KnownSender = {
      ...newSender,
      currency: newSender.country === "Nigeria" ? "NGN" : newSender.country === "United Kingdom" ? "GBP" : "USD",
      relationship: "Personal",
      entityType: "Individual",
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSenders(prev => [...prev, sender]);
    setShowAddModal(false);
    setNewSender({
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      countryCode: "+234",
      phone: "",
      dob: "",
      country: "Nigeria",
    });
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
  };

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
              <p className="text-green-800 font-medium">Sender added successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Senders</h1>
          <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="button-add-sender">
            <Plus className="w-4 h-4" />
            Add Sender
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or country"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-senders"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Full Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Country</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Service Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSenders.map((sender) => {
                    const initials = `${sender.firstName[0]}${sender.lastName[0]}`.toUpperCase();
                    const fullName = `${sender.firstName} ${sender.middleName} ${sender.lastName}`.trim();
                    
                    return (
                      <tr key={sender.email} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">{initials}</span>
                            </div>
                            <span className="font-medium">{fullName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground">{sender.country}</td>
                        <td className="py-4 px-4 text-muted-foreground">Collection</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleRequestPayment(sender.email)}
                                  className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                                  data-testid={`button-request-${sender.email.replace(/[@.]/g, '-')}`}
                                >
                                  <Send className="w-4 h-4 text-primary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Request Payment</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleViewSender(sender.email)}
                                  className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                  data-testid={`button-view-${sender.email.replace(/[@.]/g, '-')}`}
                                >
                                  <Eye className="w-4 h-4 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>View Sender</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setShowDeleteConfirm(sender.email)}
                                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                                  data-testid={`button-delete-${sender.email.replace(/[@.]/g, '-')}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Sender</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredSenders.length === 0 && (
                <div className="text-center py-12">
                  <User className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No senders found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <WaysToGetPaidModal 
        isOpen={showWaysModal} 
        onClose={() => setShowWaysModal(false)} 
        senderEmail={selectedSenderEmail}
      />

      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
            >
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold font-display mb-6">Add New Sender</h2>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>First Name *</Label>
                        <Input
                          value={newSender.firstName}
                          onChange={(e) => setNewSender(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="First name"
                          data-testid="input-new-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Middle Name</Label>
                        <Input
                          value={newSender.middleName}
                          onChange={(e) => setNewSender(prev => ({ ...prev, middleName: e.target.value }))}
                          placeholder="Middle name"
                          data-testid="input-new-middle-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name *</Label>
                        <Input
                          value={newSender.lastName}
                          onChange={(e) => setNewSender(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Last name"
                          data-testid="input-new-last-name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={newSender.email}
                        onChange={(e) => setNewSender(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@example.com"
                        data-testid="input-new-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <div className="flex gap-2">
                        <Select 
                          value={newSender.countryCode} 
                          onValueChange={(value) => setNewSender(prev => ({ ...prev, countryCode: value }))}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((cc) => (
                              <SelectItem key={cc.code} value={cc.code}>
                                {cc.flag} {cc.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={newSender.phone}
                          onChange={(e) => setNewSender(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Phone number"
                          className="flex-1"
                          data-testid="input-new-phone"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Country *</Label>
                      <Select 
                        value={newSender.country} 
                        onValueChange={(value) => setNewSender(prev => ({ ...prev, country: value }))}
                      >
                        <SelectTrigger data-testid="select-new-country">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country} value={country}>{country}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={newSender.dob}
                        onChange={(e) => setNewSender(prev => ({ ...prev, dob: e.target.value }))}
                        data-testid="input-new-dob"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1" 
                      onClick={handleAddSender}
                      disabled={!newSender.firstName || !newSender.lastName || !newSender.email}
                      data-testid="button-confirm-add-sender"
                    >
                      Add Sender
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  <h3 className="text-lg font-semibold mb-2">Delete Sender?</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Are you sure you want to delete this sender? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(null)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => handleDeleteSender(showDeleteConfirm)}
                      data-testid="button-confirm-delete"
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
