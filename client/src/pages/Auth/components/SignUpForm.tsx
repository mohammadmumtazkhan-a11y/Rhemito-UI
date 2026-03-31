import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { countries } from "@/data/countries";
import { genderOptions } from "@/data/countries";
import AccountTypeToggle from "./AccountTypeToggle";
import PhoneInput from "./PhoneInput";
import PasswordInput from "./PasswordInput";

interface SignUpFormProps {
  email: string;
  onBack: () => void;
  onOtp: (email: string, devOtp?: string) => void;
  onBusinessStep2: (data: BusinessStep1Data) => void;
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

export default function SignUpForm({ email, onBack, onOtp, onBusinessStep2 }: SignUpFormProps) {
  const { toast } = useToast();
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

  const register = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: (data) => {
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
    });
  };

  const handleBusinessStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
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
                <select
                  value={country}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCountry(selected);
                    const found = countries.find((c) => c.code === selected);
                    if (found) setMobileCode(found.dialCode);
                  }}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded text-sm text-slate-700 bg-white focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
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
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded text-sm text-slate-700 bg-white focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Gender</option>
                  {genderOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
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
                <select
                  value={country}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCountry(selected);
                    const found = countries.find((c) => c.code === selected);
                    if (found) setBusinessPhoneCode(found.dialCode);
                  }}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded text-sm text-slate-700 bg-white focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
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
                onCodeChange={setBusinessPhoneCode}
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
