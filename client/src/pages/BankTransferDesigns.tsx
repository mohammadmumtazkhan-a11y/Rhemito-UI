import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Check,
  Copy,
  Clock,
  Mail,
  Banknote,
  ArrowRightLeft,
  CheckCircle2,
  Lock,
  AlertTriangle,
  X,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConceptTab = "all" | "spotlight" | "guided" | "brief";
type DeviceFilter = "all" | "web" | "mobile";

export default function BankTransferDesigns() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ConceptTab>("all");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [usePrefix, setUsePrefix] = useState<boolean>(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(29 * 60 + 9);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const rawCustomerName = "Firopo Akin-Agunbiade";
  const payeeName = usePrefix ? `Rhemito – ${rawCustomerName}` : rawCustomerName;
  const amountGBP = "GBP 5.00";
  const receiveNGN = "NGN 9,055.05";
  const txnRef = "24590955";
  const paymentRef = "20092400804";
  const accountNumber = "20739483";
  const sortCode = "04-14-04";

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const copyValue = (value: string, label: string, id: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
    setCopiedId(id);
    toast({
      title: `Copied ${label}`,
      description: value,
    });
    setTimeout(() => setCopiedId(null), 1600);
  };

  const copyAll = (id: string) => {
    const text = [
      `Amount to Pay: ${amountGBP}`,
      `Payee / Account Name: ${payeeName}`,
      `Account Number: ${accountNumber}`,
      `Sort Code: ${sortCode}`,
      `Payment Reference: ${paymentRef}`,
      `Transaction Reference: #${txnRef}`,
    ].join("\n");
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    toast({
      title: "Copied all payment details",
      description: "Ready to paste in your banking app.",
    });
    setTimeout(() => setCopiedId(null), 1600);
  };

  /* Shared Top Shell inside each payment screen (Header + Back Link + Status + Banners) */
  const SharedTopShell = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="space-y-4">
      {/* Send Money Title & Back Link */}
      <div className="flex items-center justify-between">
        <h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-slate-900 tracking-tight`}>
          Send Money
        </h2>
        <button
          type="button"
          onClick={() => setLocation("/send-money")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Payment Methods</span>
        </button>
      </div>

      {/* 4-Stage Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-emerald-800 leading-tight">
              Transaction
              <br />
              Created
            </span>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <Clock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-xs font-semibold text-[#2563EB] leading-tight">
              Awaiting
              <br />
              Payment
            </span>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-500 leading-tight">
              Payment
              <br />
              Received
            </span>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-500 leading-tight">
              Processing
              <br />
              Transfer
            </span>
          </div>
        </div>
      </div>

      {/* Soft Mint Created Banner */}
      <div className="rounded-2xl bg-[#EAFBF3] border border-emerald-200/70 px-4 py-3.5 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-sm">
          <p className="font-bold text-emerald-950">Your transaction has been created!</p>
          <p className="text-xs text-emerald-800/90">
            Reference: #{txnRef} · Recipient gets: {receiveNGN}
          </p>
          <p className="text-xs text-emerald-800/80">
            Complete your payment below to finalise your transfer.
          </p>
        </div>
      </div>

      {/* Soft Amber 30-Minute Countdown Strip */}
      <div className="rounded-2xl bg-[#FFF8EB] border border-amber-200/70 px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="text-xs sm:text-sm text-amber-950 space-y-0.5">
          <p className="font-semibold">Complete your payment within 30 minutes.</p>
          <p className="text-xs text-amber-800/90">
            Unpaid transactions are automatically cancelled.
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm sm:text-base font-extrabold text-amber-950 tabular-nums">
          {formatTimer(secondsLeft)} left
        </span>
      </div>
    </div>
  );

  /* Shared Bottom Footer inside each payment screen */
  const SharedBottomFooter = () => (
    <div className="space-y-3.5 pt-2">
      {/* Prominent Primary Action Block */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-4 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.15)] space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-emerald-700">
            Completed your bank transfer?
          </span>
          <span className="text-slate-500 font-medium">Instant verification</span>
        </div>
        <button
          type="button"
          onClick={() => {
            toast({
              title: "Payment confirmation recorded",
              description:
                "Thank you! We are checking for your bank transfer and will notify you once received.",
            });
          }}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-extrabold text-base sm:text-lg tracking-tight shadow-[0_8px_20px_-4px_rgba(5,150,105,0.45)] ring-4 ring-emerald-500/15 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          <span>I have made the Payment</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setLocation("/")}
        className="w-full py-3.5 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors cursor-pointer"
      >
        I&apos;ve noted the details — take me to Dashboard
      </button>

      <div className="text-center space-y-2.5 pt-1">
        <p className="text-xs text-slate-500">I&apos;ll complete the payment within 30 minutes</p>
        <div>
          <button
            type="button"
            className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
          >
            Cancel Transaction
          </button>
        </div>
        <div className="pt-1 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>(Payment account solution provided by Currency Cloud)</span>
        </div>
      </div>
    </div>
  );

  /* Reusable Copy Icon Button */
  const CopyIconBtn = ({
    value,
    label,
    id,
    lightBg = false,
  }: {
    value: string;
    label: string;
    id: string;
    lightBg?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => copyValue(value, label, id)}
      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
        lightBg
          ? "bg-white border-blue-200/80 hover:border-blue-400 text-slate-700"
          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
      }`}
      title={`Copy ${label}`}
    >
      {copiedId === id ? (
        <Check className="w-4 h-4 text-emerald-600" />
      ) : (
        <Copy className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );

  /* Screen Renderer for Each of the 3 Concepts */
  const renderConceptCard = (concept: "spotlight" | "guided" | "brief", isMobile: boolean) => {
    const prefixId = `${concept}-${isMobile ? "mob" : "web"}`;

    return (
      <div
        className={`mx-auto bg-[#F8FAFC] rounded-[28px] border border-slate-200/90 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] ${
          isMobile ? "max-w-[430px] p-5" : "max-w-[760px] p-7 sm:p-9"
        } space-y-5`}
      >
        <SharedTopShell isMobile={isMobile} />

        {/* MAIN WHITE PAYMENT CARD */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden">
          {/* Card Header: PAY BY BANK TRANSFER + BIG AMOUNT + Copy All */}
          <div
            className={`${
              isMobile ? "p-5" : "px-6 py-5"
            } border-b border-slate-100 flex items-start justify-between gap-4`}
          >
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                PAY BY BANK TRANSFER
              </p>
              <p
                className={`${
                  isMobile ? "text-3xl" : "text-[34px]"
                } font-extrabold text-slate-950 tracking-tight leading-none tabular-nums pt-0.5`}
              >
                {amountGBP}
              </p>
              <p className="text-xs text-slate-500 pt-1">
                Send the exact amount to this account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyAll(`${prefixId}-all`)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              {copiedId === `${prefixId}-all` ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied All</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Copy All</span>
                </>
              )}
            </button>
          </div>

          {/* =============================================================== */}
          {/* CONCEPT 1 BODY: PAYEE SPOTLIGHT                                 */}
          {/* =============================================================== */}
          {concept === "spotlight" && (
            <div className={`${isMobile ? "p-5" : "p-6"} space-y-5`}>
              {/* Soft Blue Payee Spotlight Box */}
              <div className="rounded-2xl bg-[#EEF4FF] border border-blue-200/80 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
                    USE THIS ACCOUNT / PAYEE NAME
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600/10 text-[#2563EB] text-xs font-bold">
                    Type exactly as shown
                  </span>
                </div>

                <p
                  className={`${
                    isMobile ? "text-2xl" : "text-[28px]"
                  } font-extrabold text-slate-950 tracking-tight leading-snug break-words`}
                >
                  {payeeName}
                </p>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Enter this exact name as the payee in your banking app.{" "}
                  <span className="font-semibold text-slate-800">
                    (Ensure you enter this name as is in your bank account — this is your dedicated
                    Rhemito funding account, not your personal savings.)
                  </span>
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => copyValue(payeeName, "Payee Name", `${prefixId}-payee`)}
                    className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedId === `${prefixId}-payee` ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied payee name</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy payee name</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Highlighted Payment Reference Box */}
              <div className="rounded-2xl bg-[#F0F6FF] border border-blue-100 px-5 py-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2563EB]">Payment reference</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold">
                      Required
                    </span>
                  </div>
                  <p
                    className={`${
                      isMobile ? "text-xl" : "text-2xl"
                    } font-extrabold text-slate-950 tracking-tight font-mono tabular-nums`}
                  >
                    {paymentRef}
                  </p>
                </div>
                <CopyIconBtn
                  value={paymentRef}
                  label="Payment reference"
                  id={`${prefixId}-ref`}
                  lightBg
                />
              </div>

              {/* Clean Full-Width Rows for Account Number & Sort Code (No Bank Name Row) */}
              <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                <div className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Account number</p>
                    <p className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                      {accountNumber}
                    </p>
                  </div>
                  <CopyIconBtn
                    value={accountNumber}
                    label="Account number"
                    id={`${prefixId}-acc`}
                  />
                </div>

                <div className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Sort code</p>
                    <p className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                      {sortCode}
                    </p>
                  </div>
                  <CopyIconBtn value="041404" label="Sort code" id={`${prefixId}-sort`} />
                </div>
              </div>

              {/* Email Notification Banner */}
              <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-[#1E40AF]">Bank details sent to your email</p>
                  <p className="text-slate-600">
                    These details are also available in your registered email.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* CONCEPT 2 BODY: GUIDED 1-2-3 TRANSFER                           */}
          {/* =============================================================== */}
          {concept === "guided" && (
            <div className="divide-y divide-slate-100">
              {/* Step 1: Set up payee */}
              <div className={`${isMobile ? "p-5" : "p-6"} space-y-3.5`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-[#2563EB] text-xs font-extrabold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Set up this payee in your banking app
                    </h3>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                    <Building2 className="w-3.5 h-3.5" />
                    Your bank app › New payee
                  </span>
                </div>

                <div className="pl-8 space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
                    USE THIS ACCOUNT / PAYEE NAME
                  </p>
                  <p
                    className={`${
                      isMobile ? "text-2xl" : "text-[28px]"
                    } font-extrabold text-slate-950 tracking-tight leading-snug break-words`}
                  >
                    {payeeName}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Enter this exact name as the payee in your banking app.{" "}
                    <span className="font-medium text-slate-700">
                      (Ensure you enter this name as is in your bank account)
                    </span>
                  </p>

                  {/* Warm Amber Personal Account Clarification from PDF 3 */}
                  <div className="rounded-xl bg-[#FFFBEB] border border-amber-200/80 p-3 flex items-start gap-2.5 text-xs text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      This is <strong>not your own personal or savings account</strong>, even if the
                      name looks familiar. It was opened specifically to fund your Rhemito transfer.
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => copyValue(payeeName, "Payee Name", `${prefixId}-payee`)}
                      className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      {copiedId === `${prefixId}-payee` ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied payee name</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy payee name</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Enter account details */}
              <div className={`${isMobile ? "p-5" : "p-6"} space-y-3`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-[#2563EB] text-xs font-extrabold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Enter the account details</h3>
                </div>

                <div className="pl-8 divide-y divide-slate-100">
                  <div className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Account number</p>
                      <p className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                        {accountNumber}
                      </p>
                    </div>
                    <CopyIconBtn
                      value={accountNumber}
                      label="Account number"
                      id={`${prefixId}-acc`}
                    />
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Sort code</p>
                      <p className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                        {sortCode}
                      </p>
                    </div>
                    <CopyIconBtn value="041404" label="Sort code" id={`${prefixId}-sort`} />
                  </div>
                </div>
              </div>

              {/* Step 3: Include your payment reference */}
              <div className={`${isMobile ? "p-5" : "p-6"} space-y-3`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-[#2563EB] text-xs font-extrabold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Include your payment reference
                  </h3>
                </div>

                <div className="pl-8 space-y-2">
                  <div className="rounded-xl bg-[#F0F6FF] border-l-4 border-[#2563EB] px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#2563EB]">Payment reference</span>
                      <p
                        className={`${
                          isMobile ? "text-xl" : "text-2xl"
                        } font-extrabold text-slate-950 font-mono tabular-nums`}
                      >
                        {paymentRef}
                      </p>
                    </div>
                    <CopyIconBtn
                      value={paymentRef}
                      label="Payment reference"
                      id={`${prefixId}-ref`}
                      lightBg
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Use this payment reference to help us match your payment immediately.
                  </p>
                </div>
              </div>

              {/* Bottom Email Strip */}
              <div className={`${isMobile ? "p-5" : "p-6"}`}>
                <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-[#1E40AF]">Bank details sent to your email</p>
                    <p className="text-slate-600">
                      These details are also available in your registered email.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* CONCEPT 3 BODY: ROYAL BLUE PAYMENT BRIEF + RIGHT/WRONG CHECK    */}
          {/* =============================================================== */}
          {concept === "brief" && (
            <div>
              {/* Split Grid on Web, Stacked on Mobile */}
              <div className={isMobile ? "block" : "grid grid-cols-12 border-b border-slate-100"}>
                {/* Left / Top Solid Royal Blue Payee Panel */}
                <div
                  className={`${
                    isMobile ? "p-5" : "col-span-5 p-6"
                  } bg-[#2563EB] text-white flex flex-col justify-between space-y-4`}
                >
                  <div className="space-y-3">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-blue-100">
                      USE THIS ACCOUNT / PAYEE NAME
                    </p>
                    <p
                      className={`${
                        isMobile ? "text-2xl" : "text-[26px]"
                      } font-extrabold text-white tracking-tight leading-snug break-words`}
                    >
                      {payeeName}
                    </p>
                    <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                      Enter this exact name as the payee in your banking app.{" "}
                      <span className="text-white font-medium">
                        (Ensure you enter this name as is in your bank account)
                      </span>
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => copyValue(payeeName, "Payee Name", `${prefixId}-payee`)}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#2563EB] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      {copiedId === `${prefixId}-payee` ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">Copied payee name</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy payee name</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right / Bottom Account Details Panel */}
                <div
                  className={`${
                    isMobile ? "p-5" : "col-span-7 p-6"
                  } bg-white divide-y divide-slate-100`}
                >
                  <div className="pb-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Account number</p>
                      <p className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                        {accountNumber}
                      </p>
                    </div>
                    <CopyIconBtn
                      value={accountNumber}
                      label="Account number"
                      id={`${prefixId}-acc`}
                    />
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Sort code</p>
                      <p className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                        {sortCode}
                      </p>
                    </div>
                    <CopyIconBtn value="041404" label="Sort code" id={`${prefixId}-sort`} />
                  </div>

                  <div className="pt-3.5">
                    <div className="rounded-2xl bg-[#F0F6FF] border border-blue-100 px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-[#2563EB]">Payment reference</span>
                        <p
                          className={`${
                            isMobile ? "text-xl" : "text-2xl"
                          } font-extrabold text-slate-950 font-mono tabular-nums`}
                        >
                          {paymentRef}
                        </p>
                      </div>
                      <CopyIconBtn
                        value={paymentRef}
                        label="Payment reference"
                        id={`${prefixId}-ref`}
                        lightBg
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* "Check before you pay" Right vs. Wrong Visual Comparison (from PDF 3 Page 3) */}
              <div className={`${isMobile ? "p-5" : "p-6"} space-y-4`}>
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Check before you pay in your banking app
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-emerald-200/80 flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-900">{payeeName}</p>
                        <p className="text-emerald-700 font-medium mt-0.5">
                          Right: your Rhemito funding account
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-red-200/70 flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-slate-400 line-through">{rawCustomerName}</p>
                        <p className="text-red-600 font-medium mt-0.5">
                          Wrong: your own personal or savings account
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Notification Banner */}
                <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-[#1E40AF]">Bank details sent to your email</p>
                    <p className="text-slate-600">
                      These details are also available in your registered email.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <SharedBottomFooter />
      </div>
    );
  };

  const boards: Array<{
    num: string;
    tag: string;
    title: string;
    concept: "spotlight" | "guided" | "brief";
    isMobile: boolean;
  }> = [
    {
      num: "01 / 06",
      tag: "RHEMITO / PAYEE SPOTLIGHT",
      title: "Web payment screen",
      concept: "spotlight",
      isMobile: false,
    },
    {
      num: "02 / 06",
      tag: "RHEMITO / PAYEE SPOTLIGHT",
      title: "Mobile payment screen",
      concept: "spotlight",
      isMobile: true,
    },
    {
      num: "03 / 06",
      tag: "RHEMITO / GUIDED TRANSFER",
      title: "Web payment screen",
      concept: "guided",
      isMobile: false,
    },
    {
      num: "04 / 06",
      tag: "RHEMITO / GUIDED TRANSFER",
      title: "Mobile payment screen",
      concept: "guided",
      isMobile: true,
    },
    {
      num: "05 / 06",
      tag: "RHEMITO / PAYMENT BRIEF",
      title: "Web payment screen",
      concept: "brief",
      isMobile: false,
    },
    {
      num: "06 / 06",
      tag: "RHEMITO / PAYMENT BRIEF",
      title: "Mobile payment screen",
      concept: "brief",
      isMobile: true,
    },
  ];

  const visibleBoards = boards.filter((b) => {
    if (activeTab !== "all" && b.concept !== activeTab) return false;
    if (deviceFilter === "web" && b.isMobile) return false;
    if (deviceFilter === "mobile" && !b.isMobile) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-24 antialiased">
      {/* Subtle Sticky Filter Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center">
              R
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">
                Rhemito — Bank Transfer Design Proposals
              </h1>
              <p className="text-xs text-slate-500">
                3 Concepts × Web &amp; Mobile (01/06 – 06/06)
              </p>
            </div>
          </div>

          {/* Concept Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: "all" as const, label: "All 3 Concepts (01–06)" },
              { id: "spotlight" as const, label: "1. Payee Spotlight" },
              { id: "guided" as const, label: "2. Guided Transfer" },
              { id: "brief" as const, label: "3. Payment Brief" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === t.id
                    ? "bg-[#2563EB] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Prefix & Device Filter */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUsePrefix((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                usePrefix
                  ? "bg-blue-50 text-[#2563EB] border-blue-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {usePrefix ? 'Prefix: "Rhemito –" ON' : 'Prefix: "Rhemito –" OFF'}
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[
                { id: "all" as const, label: "Web + Mobile" },
                { id: "web" as const, label: "Web" },
                { id: "mobile" as const, label: "Mobile" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDeviceFilter(d.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    deviceFilter === d.id
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Editorial Presentation Boards (01/06 to 06/06) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 space-y-20">
        {visibleBoards.map((board) => (
          <section key={board.num} className="space-y-6">
            {/* Editorial Board Header */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#2563EB]">
                  {board.tag}
                </span>
                <span className="text-xs font-medium text-slate-400 tabular-nums">
                  {board.num}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                {board.title}
              </h2>
            </div>

            {/* Screen Canvas */}
            <div className="py-2">{renderConceptCard(board.concept, board.isMobile)}</div>

            {/* Editorial Board Footer */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs text-slate-400">
              <span>Design proposal – illustrative payment details</span>
              <span>16 October 2026</span>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
