import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronLeft, ChevronRight, Building, CreditCard, Wallet, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const steps = ["Amount", "Recipient", "Bank", "Summary", "Payment"];

export default function TestCheckout() {
    const [step, setStep] = useState(1);
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Transaction State
    const [transaction, setTransaction] = useState({
        amount: 100,
        sourceCurrency: "GBP",
        destCurrency: "NGN",
        fee: 15.00,
        recipientId: "",
        paymentMethod: "",
    });

    // Promo Code State
    const [promoCode, setPromoCode] = useState("");
    const [promoStatus, setPromoStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);

    // Derived Values
    const exchangeRate = 1450.50; // Mock rate
    const amountSent = transaction.amount;
    const totalToPay = (transaction.amount + transaction.fee - discountAmount).toFixed(2);
    const theyReceive = (transaction.amount * exchangeRate).toFixed(2);

    // Handlers
    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleNext = () => {
        if (step < 5) setStep(step + 1);
    };

    const checkPromo = async () => {
        if (!promoCode) return;
        setLoading(true);
        try {
            const res = await fetch("/api/promocodes/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: promoCode })
            });
            const data = await res.json();

            if (data.valid) {
                setPromoStatus({ valid: true, msg: "Promo Applied!" });
                if (data.promo.type === 'fixed') {
                    setDiscountAmount(parseFloat(data.promo.value));
                }
                toast({ title: "Success", description: "Promo code applied successfully!", variant: "default" });
            } else {
                setPromoStatus({ valid: false, msg: data.message });
                setDiscountAmount(0);
                toast({ title: "Invalid Code", description: data.message, variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Error", description: "Failed to validate code", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const submitTransfer = async () => {
        setLoading(true);
        // Simulate API call
        setTimeout(async () => {
            if (promoStatus?.valid) {
                await fetch("/api/promocodes/apply", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: promoCode })
                });
            }
            setLoading(false);
            toast({ title: "Transfer Successful", description: "Your money is on the way!" });
            setStep(1); // Reset
            setPromoCode("");
            setDiscountAmount(0);
        }, 1500);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-4rem)] p-4">
            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 mb-6 text-sm">
                    {steps.map((s, i) => (
                        <div key={s} className={`flex items-center ${step === i + 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 border ${step === i + 1 ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
                                {i + 1}
                            </span>
                            <span className="hidden md:inline">{s}</span>
                            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />}
                        </div>
                    ))}
                </div>

                <Card className="flex-1 border-none shadow-none md:border md:shadow-sm overflow-auto">
                    <CardHeader>
                        <CardTitle className="text-xl text-primary font-bold">
                            {step === 1 && "Start your transfer"}
                            {step === 2 && "Select Recipient"}
                            {step === 3 && "Banking Details"}
                            {step === 4 && "Review Transaction"}
                            {step === 5 && "Payment Method"}
                        </CardTitle>
                        <CardDescription>Step {step} of 5</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* STEP 1: AMOUNT */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>You Send</Label>
                                    <div className="flex gap-2">
                                        <Input type="number" value={transaction.amount} onChange={e => setTransaction({ ...transaction, amount: parseFloat(e.target.value) })} />
                                        <Select defaultValue="GBP"><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GBP">GBP</SelectItem></SelectContent></Select>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>They Receive</Label>
                                    <div className="flex gap-2">
                                        <Input disabled value={theyReceive} />
                                        <Select defaultValue="NGN"><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NGN">NGN</SelectItem></SelectContent></Select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: RECIPIENT */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="p-4 border rounded-lg cursor-pointer hover:border-primary bg-blue-50/50" onClick={() => setTransaction({ ...transaction, recipientId: "u1" })}>
                                    <div className="font-bold">Akshita Gupta</div>
                                    <div className="text-sm text-muted-foreground">Access Bank - 123*****89</div>
                                </div>
                                <Button variant="outline" className="w-full">+ Add New Recipient</Button>
                            </div>
                        )}

                        {/* STEP 3: BANK */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Account Number</Label>
                                    <Input defaultValue="1234567890" disabled />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Bank Name</Label>
                                    <Input defaultValue="Access Bank PLC" disabled />
                                </div>
                            </div>
                        )}

                        {/* STEP 4: SUMMARY */}
                        {step === 4 && (
                            <div className="space-y-4">
                                <div className="rounded-lg bg-gray-50 p-4 space-y-2">
                                    <div className="flex justify-between"><span>Sending</span><span className="font-bold">{transaction.amount} GBP</span></div>
                                    <div className="flex justify-between"><span>To</span><span className="font-bold">Akshita Gupta</span></div>
                                    <div className="flex justify-between"><span>Total to Pay</span><span className="font-bold text-lg text-primary">{totalToPay} GBP</span></div>
                                </div>
                            </div>
                        )}

                        {/* STEP 5: PROMO + PAYMENT */}
                        {step === 5 && (
                            <div className="space-y-6">
                                {/* PROMO CODE at TOP */}
                                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-3">
                                    <h4 className="flex items-center gap-2 text-blue-700 font-semibold"><AlertCircle size={18} /> Have a Promo Code?</h4>
                                    <div className="flex gap-2">
                                        <Input
                                            className="bg-white"
                                            placeholder="Enter Code (e.g. SAVE20)"
                                            value={promoCode}
                                            onChange={e => {
                                                setPromoCode(e.target.value.toUpperCase());
                                                setPromoStatus(null);
                                            }}
                                        />
                                        <Button onClick={checkPromo} disabled={!promoCode || loading}>Apply</Button>
                                    </div>
                                    {promoStatus && (
                                        <div className={`text-sm font-medium flex items-center gap-2 ${promoStatus.valid ? 'text-green-600' : 'text-red-500'}`}>
                                            {promoStatus.valid ? <Check size={16} /> : <AlertCircle size={16} />}
                                            {promoStatus.msg}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-base">Payment Method</Label>
                                    <div onClick={() => setTransaction({ ...transaction, paymentMethod: 'instant' })} className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer ${transaction.paymentMethod === 'instant' ? 'border-primary ring-1 ring-primary' : 'hover:border-gray-400'}`}>
                                        <div className="p-2 bg-blue-100 rounded-lg text-primary"><Building size={20} /></div>
                                        <div>
                                            <div className="font-semibold">Instant Pay By Bank</div>
                                            <div className="text-sm text-muted-foreground">Pay via your online banking app</div>
                                        </div>
                                    </div>
                                    <div onClick={() => setTransaction({ ...transaction, paymentMethod: 'card' })} className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer ${transaction.paymentMethod === 'card' ? 'border-primary ring-1 ring-primary' : 'hover:border-gray-400'}`}>
                                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CreditCard size={20} /></div>
                                        <div>
                                            <div className="font-semibold">Debit / Credit Card</div>
                                            <div className="text-sm text-muted-foreground">0% fees for debit cards</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </CardContent>

                    {/* FOOTER ACTIONS */}
                    <div className="p-6 pt-0 flex gap-4">
                        {step > 1 && <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>}
                        {step < 5 ? (
                            <Button className="flex-1" onClick={handleNext}>Continue</Button>
                        ) : (
                            <Button className="flex-1" onClick={submitTransfer} disabled={loading}>{loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null} Confirm & Pay</Button>
                        )}
                    </div>

                </Card>
            </div>

            {/* Right Sidebar Summary */}
            <div className="hidden lg:block w-80">
                <Card className="sticky top-4 bg-gray-50/80 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="text-lg">Transaction Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between"><span>You Send</span><span>{transaction.amount.toFixed(2)} GBP</span></div>
                        <div className="flex justify-between"><span>Fees</span><span>{transaction.fee.toFixed(2)} GBP</span></div>
                        {discountAmount > 0 && (
                            <div className="flex justify-between text-green-600 font-bold"><span>Promo Discount</span><span>-{discountAmount.toFixed(2)} GBP</span></div>
                        )}
                        <div className="border-t my-2 pt-2 flex justify-between font-bold text-base"><span>Total to Pay</span><span>{totalToPay} GBP</span></div>
                        <div className="bg-blue-100 p-2 rounded text-blue-800 text-xs mt-2">
                            Exchange Rate: 1 GBP = {exchangeRate} NGN
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
