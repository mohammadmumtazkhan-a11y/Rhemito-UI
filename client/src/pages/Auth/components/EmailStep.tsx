import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EmailStepProps {
  onRegistered: (email: string) => void;
  onNew: (email: string) => void;
  onPending: (email: string) => void;
}

export default function EmailStep({ onRegistered, onNew, onPending }: EmailStepProps) {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const checkEmail = useMutation({
    mutationFn: async (emailValue: string) => {
      const res = await apiRequest("POST", "/api/auth/check-email", { email: emailValue });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.registered) {
        if (data.status === "pending") {
          // User exists but not verified — go directly to OTP
          onPending(email);
        } else {
          onRegistered(email);
        }
      } else {
        onNew(email);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to check email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    checkEmail.mutate(email);
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="block text-sm text-slate-500 mb-1">
            Email<span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full px-3 py-2.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700"
            placeholder="e.g. jamescollor@email.com"
            required
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={checkEmail.isPending || !email}
          className="w-full text-white font-medium py-2.5 px-4 rounded disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm flex items-center justify-center"
          style={{ background: "#4f56e8" }}
        >
          {checkEmail.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>
    </div>
  );
}
