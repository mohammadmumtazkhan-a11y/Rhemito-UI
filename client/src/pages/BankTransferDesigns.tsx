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

  const [activeTab, setActiveTab] = useState<ConceptTab>("brief");
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

  /* Shared Top Shell inside each payment screen (Header + Back Link + Status + Unified Mint Banner) */
  const SharedTopShell = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="space-y-4">
      {/* Send Money Title & Step 4 of 4 */}
      <div className="flex items-center justify-between">
        <h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-slate-900 tracking-tight`}>
          Send Money
        </h2>
        <span className="text-xs sm:text-sm font-medium text-slate-500">Step 4 of 4</span>
      </div>

      {/* Back to Payment Methods */}
      <div>
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
            <span className="text-xs font-medium text-slate-700 leading-tight">
              Transaction
              <br />
              Created
            </span>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <Clock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-xs font-bold text-[#2563EB] leading-tight">
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

      {/* Unified Mint "Transaction created" + Timer Banner */}
      <div className="rounded-2xl bg-[#EAFBF3] border border-emerald-200/80 p-4 sm:p-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm sm:text-base font-bold text-emerald-900">
              Transaction created
            </span>
          </div>
          <span className="text-lg sm:text-2xl font-extrabold text-[#92400E] tabular-nums tracking-tight">
            {formatTimer(secondsLeft)} left
          </span>
        </div>
        <div className={`${isMobile ? "pl-0" : "pl-7"} space-y-1`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base font-extrabold text-emerald-950">
            <span>Ref: TXN-202610-00001</span>
            <span>Amount: {amountGBP}</span>
          </div>
          <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
            Pay within 30 minutes to complete your transfer. Unpaid transfers are automatically cancelled.
          </p>
        </div>
      </div>
    </div>
  );

  /* Shared Bottom Footer inside the Main White Payment Card */
  const SharedBottomFooter = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`${isMobile ? "px-5 pb-5" : "px-6 pb-6"} space-y-4 pt-2`}>
      {/* Completed your bank transfer? + Instant verification */}
      <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-center">
        <span className="text-sm sm:text-base font-bold text-slate-900">
          Completed your bank transfer?
        </span>
        <span className="px-2.5 py-0.5 rounded-md bg-[#EEF5FF] text-[#2563EB] text-xs font-semibold">
          Instant verification
        </span>
      </div>

      {/* Primary Royal Blue Button */}
      <button
        type="button"
        onClick={() => {
          toast({
            title: "Payment confirmation recorded",
            description:
              "Thank you! We are checking for your bank transfer and will notify you once received.",
          });
        }}
        className="w-full py-3.5 px-6 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-xs transition-all text-center cursor-pointer"
      >
        I have made the Payment
      </button>

      {/* Secondary Outlined Button */}
      <button
        type="button"
        onClick={() => setLocation("/")}
        className="w-full py-3.5 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm border border-slate-200 transition-colors cursor-pointer"
      >
        I&apos;ve noted the details — take me to Dashboard
      </button>

      <div className="text-center space-y-2.5 pt-1">
        <p className="text-xs text-slate-500">I&apos;ll complete the payment within 30 minutes</p>
        <div>
          <button
            type="button"
            className="text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 cursor-pointer"
          >
            Cancel Transaction
          </button>
        </div>
        <p className="text-xs text-slate-500 pt-1">
          (Payment account solution provided by Currency Cloud)
        </p>
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
      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
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
                    <p className="text-lg font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
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
                    <p className="text-lg font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                      {sortCode}
                    </p>
                  </div>
                  <CopyIconBtn value={sortCode} label="Sort code" id={`${prefixId}-sort`} />
                </div>
              </div>

              {/* Email Notification Banner */}
              <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-slate-900">Bank details sent to your email</p>
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
                      (Ensure you enter this name as is in your bank account — this is your dedicated Rhemito funding account, not your personal savings.)
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
                      <p className="text-lg font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
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
                      <p className="text-lg font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                        {sortCode}
                      </p>
                    </div>
                    <CopyIconBtn value={sortCode} label="Sort code" id={`${prefixId}-sort`} />
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
                  <div className="rounded-xl bg-[#EEF5FF] px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#2563EB]">Payment reference</span>
                        <span className="px-2 py-0.5 rounded-md bg-white text-[#2563EB] text-[11px] font-semibold shadow-2xs">
                          Required
                        </span>
                      </div>
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

              {/* Bottom Email Strip */}
              <div className={`${isMobile ? "p-5" : "p-6"}`}>
                <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-slate-900">Bank details sent to your email</p>
                    <p className="text-slate-600">
                      These details are also available in your registered email.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* CONCEPT 3 BODY: RHEMITO / PAYMENT BRIEF (05/06 Web & 06/06 Mob) */}
          {/* =============================================================== */}
          {concept === "brief" && (
            <div>
              {/* Split Grid on Web (05/06), Stacked on Mobile (06/06) */}
              <div className={isMobile ? "block border-b border-slate-100" : "grid grid-cols-12 border-b border-slate-100"}>
                {/* Left / Top Solid Royal Blue Payee Panel */}
                <div
                  className={`${
                    isMobile ? "p-5" : "col-span-6 p-6"
                  } bg-[#2563EB] text-white flex flex-col justify-between`}
                >
                  <div>
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-100">
                      USE THIS ACCOUNT / PAYEE NAME
                    </p>
                    <span className="inline-block mt-2.5 px-2.5 py-1 rounded-md bg-white/15 border border-white/25 text-xs font-semibold text-white">
                      Type exactly as shown
                    </span>
                    <p
                      className={`mt-3.5 ${
                        isMobile ? "text-2xl" : "text-[28px]"
                      } font-extrabold text-white tracking-tight leading-tight break-words`}
                    >
                      {payeeName}
                    </p>
                    <p className="mt-3 text-xs sm:text-sm text-blue-50 leading-relaxed">
                      Enter this exact name as the payee in your banking app.
                    </p>
                    <p className="mt-2.5 text-xs sm:text-sm text-blue-100/95 leading-relaxed">
                      (Ensure you enter this name as is in your bank account — this is your dedicated Rhemito funding account, not your personal savings.)
                    </p>
                  </div>

                  <div className="mt-5 pt-1">
                    <button
                      type="button"
                      onClick={() => copyValue(payeeName, "Payee Name", `${prefixId}-payee`)}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#2563EB] text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
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
                    isMobile ? "p-5" : "col-span-6 p-6"
                  } bg-white flex flex-col justify-between divide-y divide-slate-100`}
                >
                  <div className="pb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Account number</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums mt-0.5">
                        {accountNumber}
                      </p>
                    </div>
                    <CopyIconBtn
                      value={accountNumber}
                      label="Account number"
                      id={`${prefixId}-acc`}
                    />
                  </div>

                  <div className="py-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Sort code</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums mt-0.5">
                        {sortCode}
                      </p>
                    </div>
                    <CopyIconBtn value={sortCode} label="Sort code" id={`${prefixId}-sort`} />
                  </div>

                  <div className="pt-4">
                    <div className="rounded-2xl bg-[#EEF5FF] p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-[#2563EB]">
                            Payment reference
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white text-[#2563EB] text-[11px] font-semibold shadow-2xs">
                            Required
                          </span>
                        </div>
                        <p
                          className={`${
                            isMobile ? "text-xl" : "text-2xl"
                          } font-extrabold text-slate-950 font-mono tabular-nums mt-1`}
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

              {/* Email Notification Banner inside Main Card */}
              <div className={`${isMobile ? "px-5 pt-5 pb-2" : "px-6 pt-6 pb-2"}`}>
                <div className="rounded-2xl bg-[#F2F7FF] px-4 py-3.5 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm space-y-0.5">
                    <p className="font-bold text-slate-900">Bank details sent to your email</p>
                    <p className="text-xs text-slate-600">
                      These details are also available in your registered email.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shared Bottom Footer inside the Main White Payment Card */}
          <SharedBottomFooter isMobile={isMobile} />
        </div>

        {/* Simulate Expiry (Demo) below the Main Card */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setSecondsLeft(3)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            Simulate Expiry (Demo)
          </button>
        </div>
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
