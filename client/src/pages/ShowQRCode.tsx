import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Share2, Copy, Check, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

export default function ShowQRCode() {
  const [, setLocation] = useLocation();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [copied, setCopied] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);

  const paymentLink = `rhemito.com/pay/qr${Math.random().toString(36).substring(2, 8)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${paymentLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateQR = () => {
    setQrGenerated(true);
  };

  const handleReset = () => {
    setAmount("");
    setCurrency("GBP");
    setQrGenerated(false);
  };

  const QRCodePlaceholder = () => (
    <div className="relative">
      <svg
        viewBox="0 0 200 200"
        className="w-48 h-48 mx-auto"
      >
        <rect x="10" y="10" width="60" height="60" fill="currentColor" className="text-foreground" />
        <rect x="20" y="20" width="40" height="40" fill="white" />
        <rect x="30" y="30" width="20" height="20" fill="currentColor" className="text-foreground" />
        
        <rect x="130" y="10" width="60" height="60" fill="currentColor" className="text-foreground" />
        <rect x="140" y="20" width="40" height="40" fill="white" />
        <rect x="150" y="30" width="20" height="20" fill="currentColor" className="text-foreground" />
        
        <rect x="10" y="130" width="60" height="60" fill="currentColor" className="text-foreground" />
        <rect x="20" y="140" width="40" height="40" fill="white" />
        <rect x="30" y="150" width="20" height="20" fill="currentColor" className="text-foreground" />
        
        <rect x="80" y="10" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="100" y="10" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="80" y="30" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="90" y="40" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="100" y="50" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="110" y="30" width="10" height="10" fill="currentColor" className="text-foreground" />
        
        <rect x="10" y="80" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="30" y="90" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="50" y="80" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="40" y="100" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="60" y="110" width="10" height="10" fill="currentColor" className="text-foreground" />
        
        <rect x="80" y="80" width="40" height="40" fill="currentColor" className="text-foreground" />
        <rect x="90" y="90" width="20" height="20" fill="white" />
        
        <rect x="130" y="80" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="150" y="90" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="170" y="80" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="140" y="100" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="160" y="110" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="180" y="100" width="10" height="10" fill="currentColor" className="text-foreground" />
        
        <rect x="80" y="130" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="100" y="140" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="80" y="150" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="110" y="160" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="90" y="170" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="100" y="180" width="10" height="10" fill="currentColor" className="text-foreground" />
        
        <rect x="130" y="140" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="150" y="130" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="170" y="150" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="140" y="160" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="160" y="170" width="10" height="10" fill="currentColor" className="text-foreground" />
        <rect x="180" y="180" width="10" height="10" fill="currentColor" className="text-foreground" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border">
          <span className="text-primary font-bold text-lg font-display">R</span>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold font-display">Show QR Code</h1>
          <p className="text-muted-foreground mt-1">Let anyone scan to pay you instantly</p>
        </motion.div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {!qrGenerated ? (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount to Receive (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Leave empty for any amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="flex-1"
                        data-testid="input-qr-amount"
                      />
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="w-24" data-testid="select-qr-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="NGN">NGN</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set a specific amount or leave blank to let the sender choose
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateQR}
                  className="w-full h-12 bg-purple hover:bg-purple/90"
                  data-testid="button-generate-qr"
                >
                  Generate QR Code
                </Button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="text-center">
                  {amount && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">Amount to receive</p>
                      <p className="text-3xl font-bold text-purple">
                        {CURRENCY_SYMBOLS[currency]}{parseFloat(amount).toFixed(2)} {currency}
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-white p-6 rounded-2xl border shadow-sm inline-block">
                    <QRCodePlaceholder />
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-4">
                    Scan with any camera app to pay
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Or share this payment link:</p>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={`https://${paymentLink}`} 
                      readOnly 
                      className="text-sm bg-white"
                      data-testid="input-payment-link"
                    />
                    <Button 
                      onClick={handleCopyLink}
                      variant="outline"
                      className="shrink-0"
                      data-testid="button-copy-link"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline"
                    className="h-12"
                    data-testid="button-download-qr"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-12"
                    data-testid="button-share-qr"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>

                <Button 
                  variant="ghost"
                  onClick={handleReset}
                  className="w-full"
                  data-testid="button-new-qr"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New QR Code
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
