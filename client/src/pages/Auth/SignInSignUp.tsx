import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AuthLayout from "./components/AuthLayout";
import EmailStep from "./components/EmailStep";
import SignInStep from "./components/SignInStep";
import SignUpForm, { type BusinessStep1Data } from "./components/SignUpForm";
import BusinessStep2 from "./components/BusinessStep2";
import OtpStep from "./components/OtpStep";

type AuthStep = "email" | "signIn" | "signUp" | "businessStep2" | "otp";

const headings: Record<AuthStep, string> = {
  email: "Enter your email address",
  signIn: "Sign in to your account",
  signUp: "Get started for free",
  businessStep2: "Get started for free",
  otp: "Verify your email",
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

export default function SignInSignUp() {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [direction, setDirection] = useState(1);
  const [businessStep1Data, setBusinessStep1Data] = useState<BusinessStep1Data | null>(null);
  const [devOtp, setDevOtp] = useState<string | undefined>();

  const goTo = (newStep: AuthStep, dir: number = 1) => {
    setDirection(dir);
    setStep(newStep);
  };

  const handleRegistered = (emailValue: string) => {
    setEmail(emailValue);
    goTo("signIn");
  };

  const handleNew = (emailValue: string) => {
    setEmail(emailValue);
    goTo("signUp");
  };

  const handleBackToEmail = () => {
    setEmail("");
    goTo("email", -1);
  };

  const handleBusinessStep2 = (data: BusinessStep1Data) => {
    setBusinessStep1Data(data);
    goTo("businessStep2");
  };

  const handlePending = (emailValue: string) => {
    // Pending user: original registration OTP (123456) is still valid.
    // Do NOT call resend-otp here — that would invalidate the existing code.
    setEmail(emailValue);
    setDevOtp("123456");
    setDirection(1);
    setStep("otp");
  };

  const handleOtp = (_email: string, otpCode?: string) => {
    setDevOtp(otpCode);
    setDirection(1);
    setStep("otp");
  };

  const handleChangeEmailFromOtp = () => {
    setEmail("");
    goTo("email", -1);
  };

  return (
    <AuthLayout heading={headings[step]}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          {step === "email" && (
            <EmailStep onRegistered={handleRegistered} onNew={handleNew} onPending={handlePending} />
          )}

          {step === "signIn" && (
            <SignInStep email={email} onBack={handleBackToEmail} />
          )}

          {step === "signUp" && (
            <SignUpForm
              email={email}
              onBack={handleBackToEmail}
              onOtp={handleOtp}
              onBusinessStep2={handleBusinessStep2}
            />
          )}

          {step === "businessStep2" && businessStep1Data && (
            <BusinessStep2
              step1Data={businessStep1Data}
              onBack={() => goTo("signUp", -1)}
              onOtp={handleOtp}
            />
          )}

          {step === "otp" && (
            <OtpStep email={email} onChangeEmail={handleChangeEmailFromOtp} devOtp={devOtp} />
          )}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
}
