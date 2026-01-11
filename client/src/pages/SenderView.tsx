import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CreditCard, Building2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SenderView() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const requestDetails = {
    requesterName: "Olayinka",
    amountGBP: 100,
    amountNGN: 200000,
    reason: "Consulting services - Invoice #1234",
  };

  const handlePay = () => {
    setShowPaymentModal(false);
    setIsPaid(true);
  };

  if (isPaid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal/10 to-primary/10 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="text-center">
            <CardContent className="pt-12 pb-8 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-teal rounded-full flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-display">Payment Successful!</h2>
                <p className="text-muted-foreground">
                  You've sent <span className="font-semibold text-teal">₦{requestDetails.amountNGN.toLocaleString()}</span> to {requestDetails.requesterName}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>A confirmation email has been sent to your email address.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-teal/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl font-display">R</span>
          </div>
          <h1 className="text-xl font-bold font-display text-primary">Rhemito</h1>
        </div>

        <Card>
          <CardContent className="pt-8 pb-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-teal rounded-full flex items-center justify-center mx-auto">
                <span className="text-white font-bold text-xl">
                  {requestDetails.requesterName.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <h2 className="text-lg font-semibold font-display">
                {requestDetails.requesterName} is requesting payment
              </h2>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Amount to pay</p>
                <p className="text-4xl font-bold text-teal">₦{requestDetails.amountNGN.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ≈ £{requestDetails.amountGBP.toFixed(2)} GBP
                </p>
              </div>

              {requestDetails.reason && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-sm text-muted-foreground">For</p>
                    <p className="font-medium">{requestDetails.reason}</p>
                  </div>
                </>
              )}
            </div>

            <Button 
              className="w-full h-12 bg-teal hover:bg-teal/90 text-white font-semibold"
              onClick={() => setShowPaymentModal(true)}
              data-testid="button-pay-now"
            >
              Pay Now
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secured by <span className="font-semibold text-primary">Rhemito</span>
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Complete Payment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-20 flex-col gap-2"
                data-testid="button-pay-card"
              >
                <CreditCard className="w-6 h-6 text-primary" />
                <span className="text-sm">Card</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-20 flex-col gap-2 border-primary bg-primary/5"
                data-testid="button-pay-bank"
              >
                <Building2 className="w-6 h-6 text-primary" />
                <span className="text-sm">Bank Transfer</span>
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input 
                  id="cardNumber" 
                  placeholder="4242 4242 4242 4242" 
                  data-testid="input-card-number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input 
                    id="expiry" 
                    placeholder="MM/YY" 
                    data-testid="input-card-expiry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input 
                    id="cvv" 
                    placeholder="123" 
                    data-testid="input-card-cvv"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Cardholder Name</Label>
                <Input 
                  id="name" 
                  placeholder="John Doe" 
                  data-testid="input-card-name"
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 bg-teal hover:bg-teal/90"
              onClick={handlePay}
              data-testid="button-confirm-payment"
            >
              Pay ₦{requestDetails.amountNGN.toLocaleString()}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
