import { clearReferral, formatMoney, loadReferral } from "@/lib/rewards";
import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { genderOptions, countries } from "@/data/countries";
import { SearchableSelect } from "@/components/ui/searchable-select";
import PhoneInput from "./PhoneInput";
import PasswordInput from "./PasswordInput";
import type { BusinessStep1Data } from "./SignUpForm";

interface BusinessStep2Props {
  step1Data: BusinessStep1Data;
  onBack: () => void;
  onOtp: (email: string, devOtp?: string) => void;
}

// Mock directors list — in production this would come from a company lookup API
const mockDirectors = [
  "John Smith",
  "Jane Doe",
  "Robert Johnson",
  "Sarah Williams",
  "Michael Brown",
];

export default function BusinessStep2({ step1Data, onBack, onOtp }: BusinessStep2Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [directorName, setDirectorName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const register = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.activated) {
        const pendingStoreRedirect = loadReferral()?.postSignupAppStoreUrl ?? null;
        clearReferral();
        queryClient.clear();
        if (data?.user) {
          queryClient.setQueryData(["/api/auth/me"], { user: data.user });
        }
        const bonus = data?.referralBonus as { amount: number; currency: string; floor: number } | null | undefined;
        if (bonus && Number(bonus.amount) > 0) {
          const amt = formatMoney(bonus.amount, bonus.currency);
          const floorText =
            Number(bonus.floor) > 0
              ? ` Use it on transfers of ${formatMoney(bonus.floor, bonus.currency)} or more.`
              : "";
          toast({
            title: "Account Activated & Bonus Unlocked!",
            description: `Welcome to Rhemito! You have earned ${amt} Referral Bonus credit.${floorText}`,
          });
        } else {
          toast({
            title: "Registration Successful!",
            description: pendingStoreRedirect
              ? "Your referral is permanently linked! Redirecting to the Apple App Store..."
              : "Your account has been created and activated. Welcome to Rhemito!",
          });
        }
        if (pendingStoreRedirect) {
          window.location.href = pendingStoreRedirect;
        } else {
          setLocation("/");
        }
        return;
      }
      toast({
        title: "Registration Successful",
        description: "Please check your email for the verification code. Also check your SPAM folder.",
      });
      onOtp(step1Data.email, data.devOtp);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!directorName) {
      toast({ title: "Director required", description: "Please select a director name.", variant: "destructive" });
      return;
    }
    if (!gender) {
      toast({ title: "Gender required", description: "Please select your gender.", variant: "destructive" });
      return;
    }
    if (!mobileCode) {
      toast({ title: "Phone code required", description: "Please select a mobile country code.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setPasswordError("Password must contain at least 1 uppercase letter");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setPasswordError("Password must contain at least 1 number");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setPasswordError("Password must contain at least 1 special character");
      return;
    }

    const storedRef = loadReferral();
    register.mutate({
      ...step1Data,
      referralCode: loadReferral()?.code,
      ...(storedRef?.ruleId ? { referralRuleId: storedRef.ruleId } : {}),
      ...(storedRef?.trackingId ? { referralTrackingId: storedRef.trackingId } : {}),
      ...(storedRef?.channel ? { referralChannel: storedRef.channel } : {}),
      ...(storedRef?.attributionMethod ? { referralAttributionMethod: storedRef.attributionMethod } : {}),
      directorName,
      dateOfBirth,
      gender,
      mobileCode,
      mobileNumber,
      password,
      confirmPassword,
    });
  };

  return (
    <div className="w-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </button>

      <div className="w-full bg-white rounded-lg shadow-sm border border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
        {/* Email (disabled) */}
        <div className="mb-4">
          <label className="block text-sm text-slate-500 mb-1">
            Email<span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={step1Data.email}
            disabled
            className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded text-slate-400 text-sm cursor-not-allowed"
          />
        </div>

        {/* Company info banner */}
        <div className="bg-slate-50 rounded-md px-4 py-3 mb-5 border border-slate-100">
          <p className="text-sm font-semibold text-slate-700">{step1Data.businessName}</p>
          <p className="text-xs text-slate-400">{step1Data.businessRegNo}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Director */}
            <div>
              <label className="block text-sm text-slate-500 mb-1">
                Director<span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                value={directorName}
                onValueChange={(val) => setDirectorName(val)}
                placeholder="Select director name"
                searchPlaceholder="Search director..."
                className="[&>div:first-child]:h-[42px] [&>div:first-child]:border-slate-200 [&>div:first-child]:rounded"
                options={mockDirectors.map((d) => ({
                  value: d,
                  label: d,
                }))}
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm text-slate-500 mb-1">
                Date Of Birth<span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
                required
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm text-slate-500 mb-1">
                Gender<span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                value={gender}
                onValueChange={(val) => setGender(val)}
                placeholder="Select Gender"
                searchPlaceholder="Search gender..."
                className="[&>div:first-child]:h-[42px] [&>div:first-child]:border-slate-200 [&>div:first-child]:rounded"
                options={genderOptions.map((g) => ({
                  value: g.value,
                  label: g.label,
                }))}
              />
            </div>

            {/* Mobile Number */}
            <PhoneInput
              codeValue={mobileCode}
              numberValue={mobileNumber}
              onCodeChange={setMobileCode}
              onNumberChange={setMobileNumber}
            />

            {/* Password */}
            <PasswordInput
              value={password}
              onChange={(v) => {
                setPassword(v);
                setPasswordError("");
              }}
              label="Password"
              placeholder="Password"
            />

            {/* Confirm Password */}
            <PasswordInput
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                setPasswordError("");
              }}
              label="Confirm Password"
              placeholder="Confirm Password"
              error={passwordError}
            />
          </div>

          {/* Legal text */}
          <p className="text-xs text-slate-500 mt-5 mb-4">
            By clicking Sign up, you agree to the Rhemito's{" "}
            <a href="#" className="text-blue-600 font-medium hover:underline">
              User Agreement
            </a>
            ,{" "}
            <a href="#" className="text-blue-600 font-medium hover:underline">
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="#" className="text-blue-600 font-medium hover:underline">
              Cookie Policy
            </a>
            .
          </p>

          <button
            type="submit"
            disabled={register.isPending}
            className="w-full text-white font-medium py-2.5 px-4 rounded disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm flex items-center justify-center"
            style={{ background: "#4f56e8" }}
          >
            {register.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "Sign up"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
