import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Trash2, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WaysToGetPaidModal } from "@/components/modals/WaysToGetPaidModal";
import { knownSenders } from "@/data/knownSenders";

export default function SenderDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ email: string }>();
  const [showWaysModal, setShowWaysModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const email = decodeURIComponent(params.email || "");
  const sender = knownSenders.find(s => s.email === email);

  if (!sender) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Sender not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/senders")}>
            Back to Senders
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const displayName = sender.senderType === "business" 
    ? sender.businessName.toUpperCase() 
    : `${sender.firstName} ${sender.middleName} ${sender.lastName}`.trim().toUpperCase();
  const initials = sender.senderType === "business" 
    ? sender.businessName.substring(0, 2).toUpperCase()
    : `${sender.firstName[0]}${sender.lastName[0]}`.toUpperCase();
  const refCode = sender.senderType === "business" 
    ? `REF/${sender.businessName.split(' ')[0].toUpperCase()}`
    : `REF/${sender.firstName.toUpperCase()}`;
  const formattedDate = new Date(sender.createdAt).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button
          onClick={() => setLocation("/senders")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Sender Detail</span>
        </button>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  {sender.senderType === "business" ? (
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <span className="text-xl font-semibold text-muted-foreground">{initials}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{displayName}</h2>
                    {sender.senderType === "business" && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Business</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{refCode}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-sm text-muted-foreground">{formattedDate}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => setShowWaysModal(true)}
                  className="gap-2"
                  data-testid="button-request"
                >
                  <Send className="w-4 h-4" />
                  Request
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">Personal Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Country</p>
                    <p className="font-medium">{sender.country}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Relationship</p>
                    <p className="font-medium">{sender.relationship}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mobile Number</p>
                    <p className="font-medium">{sender.countryCode}{sender.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{sender.email}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">Payment Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Currency</p>
                    <p className="font-medium">{sender.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sender Type</p>
                    <p className="font-medium">{sender.senderType === "business" ? "Business" : "Individual"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">Services</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Service Type</p>
                    <p className="font-medium">Collection</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WaysToGetPaidModal 
        isOpen={showWaysModal} 
        onClose={() => setShowWaysModal(false)}
        senderEmail={sender.email}
      />

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowDeleteConfirm(false)}
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
                    <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setLocation("/senders");
                      }}
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
