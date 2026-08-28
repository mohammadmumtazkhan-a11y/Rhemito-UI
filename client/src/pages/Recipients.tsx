import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Send,
  Eye,
  Trash2,
  User,
  Building2,
  Users,
  X,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { countries } from "@/data/countries";
import { knownRecipients, type KnownRecipient } from "@/data/recipients";
import {
  SERVICE_TYPES,
  bankFieldsFor,
  currencyForCountry,
  displayName,
  generateUniqueCode,
  initials,
  paginateRecipients,
  requiresNarration,
  searchRecipients,
  serviceTypeStyle,
  sortRecipients,
  type RecipientSortField,
  type SortDirection,
} from "@/lib/recipients";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface NewRecipientForm {
  recipientType: "individual" | "business";
  firstName: string;
  lastName: string;
  businessName: string;
  country: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  iban: string;
  swift: string;
  serviceType: string;
  narration: string;
}

const emptyNewRecipient: NewRecipientForm = {
  recipientType: "individual",
  firstName: "",
  lastName: "",
  businessName: "",
  country: "United Kingdom",
  bankName: "",
  accountNumber: "",
  sortCode: "",
  iban: "",
  swift: "",
  serviceType: "Bank Deposit",
  narration: "",
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Recipients() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [recipients, setRecipients] = useState<KnownRecipient[]>(knownRecipients);
  const [sortField, setSortField] = useState<RecipientSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingRecipient, setViewingRecipient] = useState<KnownRecipient | null>(null);
  const [deletingRecipient, setDeletingRecipient] = useState<KnownRecipient | null>(null);
  const [newRecipient, setNewRecipient] = useState<NewRecipientForm>(emptyNewRecipient);

  const filtered = useMemo(
    () => searchRecipients(recipients, searchQuery),
    [recipients, searchQuery]
  );
  const sorted = useMemo(
    () => sortRecipients(filtered, sortField, sortDirection),
    [filtered, sortField, sortDirection]
  );
  const pagination = useMemo(
    () => paginateRecipients(sorted, page, pageSize),
    [sorted, page, pageSize]
  );

  const toggleSort = (field: RecipientSortField) => {
    setPage(1);
    if (sortField === field) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortIcon = (field: RecipientSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
    );
  };

  const ariaSortValue = (field: RecipientSortField): "ascending" | "descending" | "none" => {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const newFormBankFields = bankFieldsFor(newRecipient.country);
  const narrationRequired = requiresNarration(newRecipient.country);

  const newRecipientIsValid =
    (newRecipient.recipientType === "individual"
      ? Boolean(newRecipient.firstName.trim() && newRecipient.lastName.trim())
      : Boolean(newRecipient.businessName.trim())) &&
    Boolean(newRecipient.bankName.trim() && newRecipient.accountNumber.trim()) &&
    (!narrationRequired || Boolean(newRecipient.narration.trim()));

  const handleAddRecipient = () => {
    const recipient: KnownRecipient = {
      id: `rec-${Date.now()}`,
      recipientType: newRecipient.recipientType,
      firstName: newRecipient.firstName.trim(),
      lastName: newRecipient.lastName.trim(),
      businessName: newRecipient.businessName.trim(),
      country: newRecipient.country,
      currency: currencyForCountry(newRecipient.country),
      bankName: newRecipient.bankName.trim(),
      accountNumber: newRecipient.accountNumber.trim(),
      sortCode: newFormBankFields.sortCode ? newRecipient.sortCode.trim() : "",
      iban: newFormBankFields.iban ? newRecipient.iban.trim() : "",
      swift: newFormBankFields.swift ? newRecipient.swift.trim() : "",
      serviceType: newRecipient.serviceType,
      uniqueCode: generateUniqueCode(recipients.map((r) => r.uniqueCode)),
      narration: newRecipient.narration.trim(),
      relationship: "Personal",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setRecipients((prev) => [recipient, ...prev]);
    setShowAddModal(false);
    setNewRecipient(emptyNewRecipient);
    setPage(1);
    toast({
      title: "Recipient added",
      description: `${displayName(recipient)} is ready to receive payouts.`,
    });
  };

  const handleDeleteRecipient = () => {
    if (!deletingRecipient) return;
    const removedName = displayName(deletingRecipient);
    setRecipients((prev) => prev.filter((r) => r.id !== deletingRecipient.id));
    setDeletingRecipient(null);
    toast({
      title: "Recipient deleted",
      description: `${removedName} was removed from your recipients.`,
    });
  };

  const handleCopyUniqueCode = async (recipient: KnownRecipient) => {
    try {
      await navigator.clipboard.writeText(recipient.uniqueCode);
    } catch {
      // Clipboard can be unavailable in insecure contexts — still confirm to the user.
    }
    toast({
      title: "Unique code copied",
      description: `${recipient.uniqueCode} copied to clipboard.`,
    });
  };

  const SortableHeader = ({
    field,
    label,
    className,
    testId,
  }: {
    field: RecipientSortField;
    label: string;
    className?: string;
    testId: string;
  }) => (
    <TableHead className={className} aria-sort={ariaSortValue(field)}>
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-foreground transition-colors"
        data-testid={testId}
      >
        {label}
        {sortIcon(field)}
      </button>
    </TableHead>
  );

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Recipients</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage the beneficiaries you send money to.
            </p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            data-testid="button-add-recipient"
          >
            <Plus className="w-4 h-4" />
            Add Recipient
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or country"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                  data-testid="input-search-recipients"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table data-testid="table-recipients">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHeader field="name" label="Full Name" testId="button-sort-name" />
                    <SortableHeader field="country" label="Country" testId="button-sort-country" />
                    <SortableHeader
                      field="serviceType"
                      label="Service Type"
                      className="hidden sm:table-cell"
                      testId="button-sort-service-type"
                    />
                    <TableHead className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                      Unique Code
                    </TableHead>
                    <TableHead className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      Account Number
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.rows.map((recipient) => {
                    const name = displayName(recipient);
                    const style = serviceTypeStyle(recipient.serviceType);
                    const countryMeta = countries.find((c) => c.name === recipient.country);

                    return (
                      <TableRow
                        key={recipient.id}
                        className="hover:bg-blue-50/50 transition-colors"
                        data-testid={`row-recipient-${recipient.id}`}
                      >
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              {recipient.recipientType === "business" ? (
                                <Building2 className="w-4 h-4 text-primary" aria-hidden="true" />
                              ) : (
                                <span className="text-xs font-medium text-primary">
                                  {initials(recipient)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{name}</span>
                              {recipient.recipientType === "business" && (
                                <span className="text-xs text-muted-foreground">Business</span>
                              )}
                              {recipient.bankName && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {recipient.bankName}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <span className="inline-flex items-center gap-2 text-muted-foreground whitespace-nowrap">
                            <span aria-hidden="true">{countryMeta?.flag ?? "🌍"}</span>
                            {recipient.country}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-4 hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${style.pillClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`}
                              aria-hidden="true"
                            />
                            {recipient.serviceType}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-4 hidden lg:table-cell">
                          <span className="font-mono text-sm text-muted-foreground">
                            {recipient.uniqueCode}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-4 hidden md:table-cell">
                          <span className="font-mono text-sm">{recipient.accountNumber}</span>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setLocation("/send-money")}
                                  className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                                  aria-label={`Send money to ${name}`}
                                  data-testid={`button-send-${recipient.id}`}
                                >
                                  <Send className="w-4 h-4 text-primary" aria-hidden="true" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Send Money</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setViewingRecipient(recipient)}
                                  className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                  aria-label={`View ${name}`}
                                  data-testid={`button-view-${recipient.id}`}
                                >
                                  <Eye className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>View Recipient</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeletingRecipient(recipient)}
                                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                                  aria-label={`Delete ${name}`}
                                  data-testid={`button-delete-${recipient.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" aria-hidden="true" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Recipient</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {pagination.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12" data-testid="empty-recipients">
                        <div className="text-center">
                          <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
                          <p className="text-muted-foreground">No recipients found</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Try a different name or country, or add a new recipient.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-border"
              data-testid="recipients-pagination"
            >
              <p className="text-sm text-muted-foreground">
                Showing {pagination.start}–{pagination.end} of {pagination.total} recipients
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.safePage <= 1}
                  aria-label="Previous page"
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Page {pagination.safePage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.safePage >= pagination.totalPages}
                  aria-label="Next page"
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={pagination.totalPages}
                  value={pagination.safePage}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      setPage(Math.min(Math.max(1, parsed), pagination.totalPages));
                    }
                  }}
                  className="w-14 h-8 text-center"
                  aria-label="Go to page"
                  data-testid="input-page-number"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      className="w-[70px] h-8"
                      aria-label="Rows per page"
                      data-testid="select-page-size"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Recipient Modal */}
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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg"
            >
              <Card>
                <CardContent className="p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold font-display">Add New Recipient</h2>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
                      aria-label="Close"
                      data-testid="button-close-add-recipient"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Recipient Type *</Label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setNewRecipient((prev) => ({ ...prev, recipientType: "individual" }))
                          }
                          className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                            newRecipient.recipientType === "individual"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                          data-testid="button-new-recipient-type-individual"
                        >
                          <User
                            className={`w-4 h-4 ${
                              newRecipient.recipientType === "individual"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-sm font-medium ${
                              newRecipient.recipientType === "individual" ? "text-primary" : ""
                            }`}
                          >
                            Individual
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewRecipient((prev) => ({ ...prev, recipientType: "business" }))
                          }
                          className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                            newRecipient.recipientType === "business"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                          data-testid="button-new-recipient-type-business"
                        >
                          <Building2
                            className={`w-4 h-4 ${
                              newRecipient.recipientType === "business"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-sm font-medium ${
                              newRecipient.recipientType === "business" ? "text-primary" : ""
                            }`}
                          >
                            Business
                          </span>
                        </button>
                      </div>
                    </div>

                    {newRecipient.recipientType === "individual" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>First Name *</Label>
                          <Input
                            value={newRecipient.firstName}
                            onChange={(e) =>
                              setNewRecipient((prev) => ({ ...prev, firstName: e.target.value }))
                            }
                            placeholder="First name"
                            data-testid="input-new-first-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name *</Label>
                          <Input
                            value={newRecipient.lastName}
                            onChange={(e) =>
                              setNewRecipient((prev) => ({ ...prev, lastName: e.target.value }))
                            }
                            placeholder="Last name"
                            data-testid="input-new-last-name"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Business Name *</Label>
                        <Input
                          value={newRecipient.businessName}
                          onChange={(e) =>
                            setNewRecipient((prev) => ({ ...prev, businessName: e.target.value }))
                          }
                          placeholder="Enter business name"
                          data-testid="input-new-business-name"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Country *</Label>
                      <Select
                        value={newRecipient.country}
                        onValueChange={(value) =>
                          setNewRecipient((prev) => ({ ...prev, country: value }))
                        }
                      >
                        <SelectTrigger data-testid="select-new-country">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country.code} value={country.name}>
                              {country.flag} {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Payout currency: {currencyForCountry(newRecipient.country)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Bank Name *</Label>
                      <Input
                        value={newRecipient.bankName}
                        onChange={(e) =>
                          setNewRecipient((prev) => ({ ...prev, bankName: e.target.value }))
                        }
                        placeholder="e.g. GTBank, Barclays, M-Pesa"
                        data-testid="input-new-bank-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Account Number *</Label>
                      <Input
                        value={newRecipient.accountNumber}
                        onChange={(e) =>
                          setNewRecipient((prev) => ({ ...prev, accountNumber: e.target.value }))
                        }
                        placeholder="Account / wallet number"
                        data-testid="input-new-account-number"
                      />
                    </div>

                    {newFormBankFields.sortCode && (
                      <div className="space-y-2">
                        <Label>Sort Code *</Label>
                        <Input
                          value={newRecipient.sortCode}
                          onChange={(e) =>
                            setNewRecipient((prev) => ({ ...prev, sortCode: e.target.value }))
                          }
                          placeholder="e.g. 20-45-67"
                          data-testid="input-new-sort-code"
                        />
                      </div>
                    )}

                    {newFormBankFields.iban && (
                      <div className="space-y-2">
                        <Label>IBAN *</Label>
                        <Input
                          value={newRecipient.iban}
                          onChange={(e) =>
                            setNewRecipient((prev) => ({ ...prev, iban: e.target.value }))
                          }
                          placeholder="e.g. DE89 3704 0044 0532 0130 00"
                          data-testid="input-new-iban"
                        />
                      </div>
                    )}

                    {newFormBankFields.swift && (
                      <div className="space-y-2">
                        <Label>SWIFT / BIC *</Label>
                        <Input
                          value={newRecipient.swift}
                          onChange={(e) =>
                            setNewRecipient((prev) => ({ ...prev, swift: e.target.value }))
                          }
                          placeholder="e.g. WFBIUS6S"
                          data-testid="input-new-swift"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Service Type *</Label>
                      <Select
                        value={newRecipient.serviceType}
                        onValueChange={(value) =>
                          setNewRecipient((prev) => ({ ...prev, serviceType: value }))
                        }
                      >
                        <SelectTrigger data-testid="select-new-service-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Narration (TXN remarks)
                        {narrationRequired ? " *" : ""}
                      </Label>
                      <Input
                        value={newRecipient.narration}
                        onChange={(e) =>
                          setNewRecipient((prev) => ({ ...prev, narration: e.target.value }))
                        }
                        placeholder="Purpose of transfer, e.g. School fees"
                        data-testid="input-new-narration"
                      />
                      {narrationRequired && (
                        <p className="text-xs text-amber-600">
                          Narration is mandatory for Nigerian beneficiaries.
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      A unique payout code will be generated automatically.
                    </p>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      onClick={handleAddRecipient}
                      disabled={!newRecipientIsValid}
                      data-testid="button-confirm-add-recipient"
                    >
                      Add Recipient
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* View Recipient Modal */}
      <AnimatePresence>
        {viewingRecipient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setViewingRecipient(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
              data-testid="modal-view-recipient"
            >
              <Card>
                <CardContent className="p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold font-display">Recipient Details</h2>
                    <button
                      type="button"
                      onClick={() => setViewingRecipient(null)}
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
                      aria-label="Close"
                      data-testid="button-close-view-recipient"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {viewingRecipient.recipientType === "business" ? (
                        <Building2 className="w-5 h-5 text-primary" aria-hidden="true" />
                      ) : (
                        <span className="text-sm font-medium text-primary">
                          {initials(viewingRecipient)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold truncate">
                        {displayName(viewingRecipient)}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {viewingRecipient.recipientType} · Added {formatDate(viewingRecipient.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Country
                        </p>
                        <p className="text-sm font-medium">
                          {countries.find((c) => c.name === viewingRecipient.country)?.flag ?? "🌍"}{" "}
                          {viewingRecipient.country}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Payout Currency
                        </p>
                        <p className="text-sm font-medium">{viewingRecipient.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Service Type
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${serviceTypeStyle(viewingRecipient.serviceType).pillClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${serviceTypeStyle(viewingRecipient.serviceType).dotClass}`}
                            aria-hidden="true"
                          />
                          {viewingRecipient.serviceType}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Relationship
                        </p>
                        <p className="text-sm font-medium">{viewingRecipient.relationship}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Unique Code
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{viewingRecipient.uniqueCode}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUniqueCode(viewingRecipient)}
                          className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-colors"
                          aria-label="Copy unique code"
                          data-testid={`button-copy-code-${viewingRecipient.id}`}
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Bank Details
                        </p>
                        <p className="text-sm font-medium">{viewingRecipient.bankName}</p>
                        <p className="text-sm font-mono text-muted-foreground">
                          {viewingRecipient.accountNumber}
                        </p>
                        {viewingRecipient.sortCode && (
                          <p className="text-sm font-mono text-muted-foreground">
                            Sort code: {viewingRecipient.sortCode}
                          </p>
                        )}
                        {viewingRecipient.iban && (
                          <p className="text-sm font-mono text-muted-foreground">
                            IBAN: {viewingRecipient.iban}
                          </p>
                        )}
                        {viewingRecipient.swift && (
                          <p className="text-sm font-mono text-muted-foreground">
                            SWIFT: {viewingRecipient.swift}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Narration
                        </p>
                        <p className="text-sm italic text-muted-foreground">
                          {viewingRecipient.narration
                            ? `"${viewingRecipient.narration}"`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setViewingRecipient(null)}
                    >
                      Close
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      onClick={() => setLocation("/send-money")}
                      data-testid="button-modal-send-money"
                    >
                      <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                      Send Money
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Recipient Confirmation Modal */}
      <AnimatePresence>
        {deletingRecipient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setDeletingRecipient(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
            >
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Delete Recipient?</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Are you sure you want to delete{" "}
                    <span className="font-medium text-foreground">
                      {displayName(deletingRecipient)}
                    </span>
                    ? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDeletingRecipient(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDeleteRecipient}
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
