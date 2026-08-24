import React, { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { requestPasswordResetPin, resetPasswordWithPin } from "@/lib/requests";
import { PasswordInput } from "@/components/ui/password-input";

interface ForgotPasswordProps {
  /** Email prefilled from the host flow (editable on the request screen). */
  initialEmail: string;
  /** Called after the password was reset and the user automatically signed in. */
  onResetComplete: (email: string) => void;
  /** Return to the host's previous screen. */
  onCancel: () => void;
  cancelLabel?: string;
  /** Contextual confirmation toast fired on success (e.g. "Please continue your payment journey"). */
  successToast?: { title: string; description: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const PRIMARY_BUTTON =
  "w-full text-white font-medium py-2.5 px-4 rounded disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm flex items-center justify-center";
const TEXT_INPUT =
  "block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700";

export default function ForgotPassword({
  initialEmail,
  onResetComplete,
  onCancel,
  cancelLabel = "Back",
  successToast,
}: ForgotPasswordProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState(initialEmail);
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devPin, setDevPin] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendPin = async (isResend: boolean) => {
    const target = email.trim();
    if (!EMAIL_RE.test(target)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const result = await requestPasswordResetPin(target);
      setDevPin(result.devPin);
      setCooldown(result.resendAfterSeconds ?? 60);
      setExpirySeconds(result.expiresInSeconds ?? 600);
      setPin("");
      setPhase("reset");
      toast({
        title: isResend ? "New PIN Sent" : "Reset PIN Sent",
        description: result.message || `A 6-digit PIN has been sent to ${target}. It expires in 10 minutes.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The reset PIN could not be sent.";
      setError(message);
      toast({ title: "Could Not Send PIN", description: message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetting) return;
    if (pin.length !== 6) {
      setError("Enter the 6-digit PIN from your email.");
      return;
    }
    if (!PASSWORD_RE.test(newPassword)) {
      setError("Password must be at least 8 characters with 1 uppercase letter, 1 number and 1 special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setResetting(true);
    setError("");
    try {
      const result = await resetPasswordWithPin(email.trim(), pin, newPassword, confirmPassword);
      toast(
        successToast ?? {
          title: "Password Successfully Reset",
          description: result.message || "Your password has been updated.",
        }
      );
      onResetComplete(email.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "The password could not be reset.";
      setError(message);
      toast({ title: "Reset Failed", description: message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        data-testid="button-forgot-cancel"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {cancelLabel}
      </button>

      <div className="w-full bg-white rounded-lg shadow-sm border border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
        {phase === "request" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendPin(false);
            }}
          >
            <p className="text-sm text-slate-500 mb-4">
              Enter your registered email address — we'll send you a 6-digit PIN to reset your password.
            </p>

            <div className="mb-5">
              <label className="block text-sm text-slate-500 mb-1">
                Registered email<span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={TEXT_INPUT}
                placeholder="you@example.com"
                required
                autoFocus
                data-testid="input-forgot-email"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 mb-3" data-testid="error-forgot">
                {error}
              </p>
            )}

            <button type="submit" disabled={sending} className={PRIMARY_BUTTON} style={{ background: "#4f56e8" }} data-testid="button-send-pin">
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending PIN...
                </>
              ) : (
                "Send Reset PIN"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <div className="mb-4 bg-blue-50 text-blue-800 text-sm py-2.5 px-4 rounded flex items-start text-left border border-blue-200">
              <span className="mr-2 text-base flex-shrink-0">📧</span>
              <p>We've sent a 6-digit PIN to <span className="font-semibold">{email}</span>. Please also check your SPAM folder.</p>
            </div>

            {devPin && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" data-testid="dev-pin-hint">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Prototype tip:</span> Use PIN{" "}
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{devPin}</span>
                </p>
              </div>
            )}

            {expirySeconds > 0 ? (
              <p className="text-xs text-slate-400 mb-4">
                PIN expires in{" "}
                <span className="font-mono font-medium text-slate-600">
                  {String(Math.floor(expirySeconds / 60)).padStart(2, "0")}:{String(expirySeconds % 60).padStart(2, "0")}
                </span>
              </p>
            ) : (
              <p className="text-xs text-red-500 mb-4 font-medium">Your PIN has expired. Please request a new one.</p>
            )}

            <div className="mb-4">
              <label className="block text-sm text-slate-500 mb-1">
                6-digit PIN<span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className={`${TEXT_INPUT} tracking-[0.5em] font-mono text-center`}
                placeholder="000000"
                required
                autoFocus
                data-testid="input-reset-pin"
              />
            </div>

            <div className="mb-2">
              <label className="block text-sm text-slate-500 mb-1">
                New password<span className="text-red-400">*</span>
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a new password"
                required
                data-testid="input-new-password"
                toggleTestId="toggle-new-password"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                At least 8 characters with 1 uppercase letter, 1 number and 1 special character.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-slate-500 mb-1">
                Confirm new password<span className="text-red-400">*</span>
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                data-testid="input-confirm-new-password"
                toggleTestId="toggle-confirm-new-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 mb-3" data-testid="error-forgot">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={resetting || pin.length !== 6 || !newPassword || !confirmPassword || expirySeconds === 0}
              className={PRIMARY_BUTTON}
              style={{ background: "#4f56e8" }}
              data-testid="button-reset-password"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="mt-4 text-center">
              {cooldown > 0 ? (
                <p className="text-xs text-slate-400">
                  Didn't receive the PIN? Resend available in{" "}
                  <span className="font-mono font-medium">{cooldown}s</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Didn't receive the PIN?{" "}
                  <button
                    type="button"
                    onClick={() => sendPin(true)}
                    disabled={sending}
                    className="text-blue-600 font-medium hover:underline disabled:opacity-50"
                    data-testid="button-resend-pin"
                  >
                    {sending ? "Sending..." : "Resend"}
                  </button>
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
