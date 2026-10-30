import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { countries } from "@/data/countries";
import { genderOptions } from "@/data/countries";
import { SearchableSelect } from "@/components/ui/searchable-select";
import AccountTypeToggle from "./AccountTypeToggle";
import PhoneInput from "./PhoneInput";
import PasswordInput from "./PasswordInput";
import { ReferralCodeField } from "@/components/rewards/ReferralSignup";
import { clearReferral, formatMoney, loadReferral, type StoredReferral } from "@/lib/rewards";

interface SignUpFormProps {
  email: string;
  onBack: () => void;
  onOtp: (email: string, devOtp?: string) => void;
  onBusinessStep2: (data: BusinessStep1Data) => void;
  referral?: StoredReferral | null;
  onReferralChange?: (referral: StoredReferral | null) => void;
}

export interface BusinessStep1Data {
  email: string;
  accountType: "business";
  country: string;
  businessName: string;
  businessRegNo: string;
  businessPhoneCode: string;
  businessPhoneNumber: string;
}

export default function SignUpForm({ email, onBack, onOtp, onBusinessStep2, referral = null, onReferralChange = () => {} }: SignUpFormProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [accountType, setAccountType] = useState<"individual" | "business">("individual");

  // Individual fields
  const [country, setCountry] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Business step 1 fields
  const [businessName, setBusinessName] = useState("");
  const [businessRegNo, setBusinessRegNo] = useState("");
  const [businessPhoneCode, setBusinessPhoneCode] = useState("");
  const [businessPhoneNumber, setBusinessPhoneNumber] = useState("");

  const handleCountrySelect = (selectedCountryCode: string) => {
    setCountry(selectedCountryCode);
    const matched = countries.find((c) => c.code === selectedCountryCode);
    if (matched) {
      setMobileCode(matched.dialCode);
      setBusinessPhoneCode(matched.dialCode);
    }
  };

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
      onOtp(email, data.devOtp);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleIndividualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!country) {
      toast({ title: "Country required", description: "Please select a country.", variant: "destructive" });
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

    // Password strength
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

    register.mutate({
      email,
      accountType: "individual",
      country,
      firstName,
      middleName: middleName || undefined,
      lastName,
      dateOfBirth,
      gender,
      mobileCode,
      mobileNumber,
      password,
      confirmPassword,
      referralCode: referral?.code,
      ...(referral?.ruleId ? { referralRuleId: referral.ruleId } : {}),
      ...(referral?.trackingId ? { referralTrackingId: referral.trackingId } : {}),
      ...(referral?.channel ? { referralChannel: referral.channel } : {}),
      ...(referral?.attributionMethod ? { referralAttributionMethod: referral.attributionMethod } : {}),
    });
  };

  const handleBusinessStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country) {
      toast({ title: "Country required", description: "Please select a country.", variant: "destructive" });
      return;
    }
    if (!businessPhoneCode) {
      toast({ title: "Phone code required", description: "Please select a business phone country code.", variant: "destructive" });
      return;
    }
    onBusinessStep2({
      email,
      accountType: "business",
      country,
      businessName,
      businessRegNo,
      businessPhoneCode,
      businessPhoneNumber,
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
        Change email
      </button>

      <div className="w-full bg-white rounded-lg shadow-sm border border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
        {/* Email (disabled) with edit link */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-slate-500">
              Email<span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={onBack}
              className="text-blue-600 font-medium text-xs hover:underline"
            >
              Edit email
            </button>
          </div>
          <input
            type="email"
            value={email}
            disabled
            className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded text-slate-400 text-sm cursor-not-allowed"
          />
        </div>

        {/* Account Type Toggle */}
        <AccountTypeToggle value={accountType} onChange={setAccountType} />

        {/* ─── Individual Form ──────────────────────────────────────── */}
        {accountType === "individual" && (
          <form onSubmit={handleIndividualSubmit}>
            <div className="space-y-4">
              {/* Country */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Country<span className="text-red-400">*</span>
                </label>
                <SearchableSelect
                  value={country}
                  onValueChange={(selected) => {
                    handleCountrySelect(selected);
                  }}
                  placeholder="Select country"
                  searchPlaceholder="Search country..."
                  className="[&>div:first-child]:h-[42px] [&>div:first-child]:border-slate-200 [&>div:first-child]:rounded"
                  options={countries.map((c) => ({
                    value: c.code,
                    label: `${c.flag} ${c.name}`,
                  }))}
                />
              </div>

              {/* First Name + Middle Name */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  First Name<span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
                  placeholder="Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Middle Name</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
                  placeholder="Name"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Last Name<span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
                  placeholder="Name"
                  required
                />
              </div>

              {/* Name hint */}
              <p className="text-xs text-slate-400 italic -mt-2">
                Your First and Last Name must match your driving license or passport exactly. We may
                require a copy of one of these documents for verification
              </p>

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
                  placeholder="DD/MM/YY"
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
                onCodeChange={(dial) => {
                  setMobileCode(dial);
                  setBusinessPhoneCode(dial);
                }}
                countryCode={country}
                onCountryChange={(cCode) => setCountry(cCode)}
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

            {/* Referral code (US-3.2) */}
            <div className="mt-4">
              <ReferralCodeField referral={referral} onChange={onReferralChange} />
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
        )}

        {/* ─── Business Step 1 Form ─────────────────────────────────── */}
        {accountType === "business" && (
          <form onSubmit={handleBusinessStep1Submit}>
            <div className="space-y-4">
              {/* Country */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Country<span className="text-red-400">*</span>
                </label>
                <SearchableSelect
                  value={country}
                  onValueChange={(selected) => {
                    handleCountrySelect(selected);
                  }}
                  placeholder="Select country"
                  searchPlaceholder="Search country..."
                  className="[&>div:first-child]:h-[42px] [&>div:first-child]:border-slate-200 [&>div:first-child]:rounded"
                  options={countries.map((c) => ({
                    value: c.code,
                    label: `${c.flag} ${c.name}`,
                  }))}
                />
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Business Name<span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
                  placeholder="Name"
                  required
                />
              </div>

              {/* Business Registration Number */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Business Registration Number<span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={businessRegNo}
                  onChange={(e) => setBusinessRegNo(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
                  placeholder=""
                  required
                />
              </div>

              {/* Business Phone Number */}
              <PhoneInput
                codeValue={businessPhoneCode}
                numberValue={businessPhoneNumber}
                onCodeChange={(dial) => {
                  setBusinessPhoneCode(dial);
                  setMobileCode(dial);
                }}
                countryCode={country}
                onCountryChange={(cCode) => setCountry(cCode)}
                onNumberChange={setBusinessPhoneNumber}
                label="Business Phone Number"
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
              className="w-full text-white font-medium py-2.5 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm"
              style={{ background: "#4f56e8" }}
            >
              Continue
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
