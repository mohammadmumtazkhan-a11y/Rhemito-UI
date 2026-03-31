import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { genderOptions, countries } from "@/data/countries";
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
  const [directorName, setDirectorName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [mobileCode, setMobileCode] = useState(() => {
    const found = countries.find((c) => c.code === step1Data.country);
    return found ? found.dialCode : "";
  });
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

    register.mutate({
      ...step1Data,
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
              <select
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                className="block w-full px-3 py-2.5 border border-slate-200 rounded text-sm text-slate-700 bg-white focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select director name</option>
                {mockDirectors.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
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
      </div>
    </div>
  );
}
