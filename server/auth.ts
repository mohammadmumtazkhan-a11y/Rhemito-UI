import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { storage } from "./storage";
import { demoModeEnabled, serverConfig } from "./config";
import { rateLimit, clientIpOf } from "./rateLimit";
import { devEmailProvider } from "./providers";
import {
  emailCheckSchema,
  forgotPasswordSchema,
  loginSchema,
  otpVerifySchema,
  resetPasswordSchema,
  PROTOTYPE_MASTER_PASSWORD,
} from "@shared/schema";
import { log } from "./index";

const RESET_PIN_TTL_MS = 10 * 60 * 1000;
const RESET_PIN_RESEND_COOLDOWN_MS = 60_000;
const RESET_PIN_MAX_ATTEMPTS = 5;
const RESET_PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Per-email resend cooldown and failed-attempt tracking (single-process prototype). */
const resetPinSentAt = new Map<string, number>();
const resetPinFailures = new Map<string, { count: number; windowStart: number }>();

function enforceAuthRateLimit(req: Request, res: Response, name: keyof typeof serverConfig.rateLimits): boolean {
  const { limit, windowMs } = serverConfig.rateLimits[name];
  const result = rateLimit(`auth:${name}:${clientIpOf(req)}`, limit, windowMs);
  if (!result.allowed) {
    res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
    res.status(429).json({ message: "Too many attempts. Please try again shortly." });
    return false;
  }
  return true;
}

function generateOtp(): string {
  // PROTOTYPE: always use 123456 for easy testing
  return "123456";
}

/** Prototype-only master password (any account) — never honoured in real production. */
function isPrototypeMasterPassword(password: string): boolean {
  return demoModeEnabled && password === PROTOTYPE_MASTER_PASSWORD;
}

export function registerAuthRoutes(app: Express) {
  // ─── Check Email ────────────────────────────────────────────────
  app.post("/api/auth/check-email", async (req: Request, res: Response) => {
    try {
      const parsed = emailCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const user = await storage.getAuthUserByEmail(parsed.data.email);
      return res.json({
        registered: !!user,
        status: user?.status || null,
      });
    } catch (error) {
      console.error("Check email error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Login ──────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const user = await storage.getAuthUserByEmail(parsed.data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.status === "blocked") {
        return res.status(403).json({ message: "Your account has been blocked. Please contact support at admin@rhemito.com" });
      }

      if (user.status === "pending") {
        return res.status(403).json({ message: "Your account is not yet verified. Please check your email for the verification code." });
      }

      const isMatch = await bcrypt.compare(parsed.data.password, user.password);
      if (!isMatch && !isPrototypeMasterPassword(parsed.data.password)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      return res.json({ user: safeUser });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Register ───────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { confirmPassword, paymentRequestToken, isEmailLink, ...userData } = req.body;
      const payerVerification = req.session.paymentRequestVerification;
      const isVerifiedPayerRegistration = Boolean(paymentRequestToken);
      if (isVerifiedPayerRegistration && (
        !payerVerification?.verified
        || payerVerification.email !== String(userData.email ?? "").toLowerCase()
        || payerVerification.token !== paymentRequestToken
        || payerVerification.isEmailLink !== Boolean(isEmailLink)
      )) {
        return res.status(403).json({ message: "Verify this email from the payment request before registering." });
      }

      // Check if email already exists
      const existing = await storage.getAuthUserByEmail(userData.email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create user with pending status
      const user = await storage.createAuthUser({
        ...userData,
        password: hashedPassword,
        status: "pending",
      });

      if (isVerifiedPayerRegistration) {
        await storage.activateUser(userData.email);
        req.session.userId = user.id;
        delete req.session.paymentRequestVerification;
        const activated = await storage.getAuthUserById(user.id);
        const { password: _, ...safeUser } = activated ?? user;
        return res.json({ success: true, message: "Registration complete.", user: { ...safeUser, status: "active" } });
      }

      // Generate & store OTP (valid for 1 hour)
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.createOtp(userData.email, otpCode, expiresAt);

      // Log OTP to console for prototype
      log(`📧 OTP for ${userData.email}: ${otpCode} (expires in 60 minutes)`, "auth");

      return res.json({
        success: true,
        message: "Registration successful! Please check your email for the verification code.",
        devOtp: otpCode, // PROTOTYPE ONLY — remove in production
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Verify OTP ─────────────────────────────────────────────────
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const parsed = otpVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, code } = parsed.data;

      // PROTOTYPE: verify by checking the user exists + code matches dev OTP
      if (code !== "123456") {
        return res.status(400).json({ message: "Invalid verification code. Use 123456 for this prototype." });
      }

      const user = await storage.getAuthUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No account found with this email. Please register first." });
      }

      if (user.status === "active") {
        return res.status(400).json({ message: "This account is already verified. Please sign in." });
      }

      if (user.status === "blocked") {
        return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
      }

      // Activate user and start session
      await storage.activateUser(email);
      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      return res.json({
        success: true,
        message: "Account activated successfully!",
        user: { ...safeUser, status: "active" },
      });
    } catch (error) {
      console.error("Verify OTP error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Resend OTP ─────────────────────────────────────────────────
  app.post("/api/auth/resend-otp", async (req: Request, res: Response) => {
    try {
      const parsed = emailCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const user = await storage.getAuthUserByEmail(parsed.data.email);
      if (!user) {
        return res.status(404).json({ message: "No account found with this email" });
      }

      // PROTOTYPE: OTP is always 123456, just log it
      const otpCode = generateOtp();
      log(`📧 OTP for ${parsed.data.email}: ${otpCode}`, "auth");

      return res.json({
        success: true,
        message: "A new verification code has been sent to your email.",
        devOtp: otpCode, // PROTOTYPE ONLY
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Forgot Password (send 6-digit PIN to registered email) ────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      if (!enforceAuthRateLimit(req, res, "passwordResetSend")) return;

      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const email = parsed.data.email.trim().toLowerCase();
      const user = await storage.getAuthUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No Rhemito account is registered with this email." });
      }
      if (user.status === "blocked") {
        return res.status(403).json({ message: "Your account has been blocked. Please contact support at admin@rhemito.com" });
      }

      const now = Date.now();
      const lastSentAt = resetPinSentAt.get(email) ?? 0;
      if (now - lastSentAt < RESET_PIN_RESEND_COOLDOWN_MS) {
        const retryAfterMs = RESET_PIN_RESEND_COOLDOWN_MS - (now - lastSentAt);
        res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
        return res.status(429).json({ message: `A PIN was already sent. Please wait ${Math.ceil(retryAfterMs / 1000)}s before requesting another.` });
      }

      const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await storage.invalidateOtps(email);
      await storage.createOtp(email, pin, new Date(now + RESET_PIN_TTL_MS));
      resetPinSentAt.set(email, now);
      resetPinFailures.delete(email);

      await devEmailProvider.send({
        to: user.email,
        subject: "Your Rhemito password reset PIN",
        text:
          `Hello,\n\n` +
          `Use this 6-digit PIN to reset your Rhemito password:\n\n${pin}\n\n` +
          `This PIN expires in 10 minutes.\n\n` +
          `⚠ Rhemito will never ask for your password, full card number or one-time codes by email or phone. ` +
          `If you did not request a password reset, ignore this email — your password remains unchanged.\n\n` +
          `— Rhemito`,
      });
      log(`🔑 Password-reset PIN for ${email}: ${pin} (expires in 10 minutes)`, "auth");

      return res.json({
        success: true,
        message: "A 6-digit PIN has been sent to your registered email address.",
        expiresInSeconds: RESET_PIN_TTL_MS / 1000,
        resendAfterSeconds: RESET_PIN_RESEND_COOLDOWN_MS / 1000,
        ...(demoModeEnabled ? { devPin: pin } : {}), // PROTOTYPE ONLY — remove in production
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Reset Password (verify PIN, set new password, sign in) ─────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      if (!enforceAuthRateLimit(req, res, "passwordResetVerify")) return;

      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const email = parsed.data.email.trim().toLowerCase();
      const user = await storage.getAuthUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No Rhemito account is registered with this email." });
      }
      if (user.status === "blocked") {
        return res.status(403).json({ message: "Your account has been blocked. Please contact support at admin@rhemito.com" });
      }

      const now = Date.now();
      const failures = resetPinFailures.get(email);
      if (failures && failures.count >= RESET_PIN_MAX_ATTEMPTS && now - failures.windowStart < RESET_PIN_ATTEMPT_WINDOW_MS) {
        return res.status(429).json({ message: "Too many incorrect PIN attempts. Please request a new PIN." });
      }

      const otp = await storage.getValidOtp(email, parsed.data.code);
      if (!otp) {
        const inWindow = failures && now - failures.windowStart < RESET_PIN_ATTEMPT_WINDOW_MS;
        const count = inWindow ? failures!.count + 1 : 1;
        resetPinFailures.set(email, { count, windowStart: inWindow ? failures!.windowStart : now });
        const remaining = Math.max(0, RESET_PIN_MAX_ATTEMPTS - count);
        return res.status(400).json({
          message:
            remaining > 0
              ? `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
              : "Incorrect PIN. Please request a new PIN.",
        });
      }

      await storage.markOtpUsed(otp.id);
      await storage.invalidateOtps(email);
      const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
      await storage.updateAuthUserPassword(email, hashedPassword);
      resetPinFailures.delete(email);

      // Verifying the email PIN proves account control — sign the user in so
      // they can continue their journey (e.g. an open payment request checkout).
      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      return res.json({
        success: true,
        message: "Password successfully reset.",
        user: safeUser,
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Campaign contributor identification (GroupPay share links) ──────────
  // Mirrors the request-money/invoice payer PIN flow. Campaigns live in
  // server-side storage, so the campaignId is validated against a real
  // campaign record before any PIN is issued — unknown links get a 404
  // instead of a verification session.
  app.post("/api/public/campaign-verifications/send", async (req: Request, res: Response) => {
    try {
      if (!enforceAuthRateLimit(req, res, "paymentIntent")) return;
      const parsed = emailCheckSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a valid email address." } });
      }
      const campaignId = String(req.body?.campaignId ?? "").trim();
      if (!campaignId) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A campaign context is required." } });
      }
      const campaign = await storage.getGroupPayCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: { code: "CAMPAIGN_NOT_FOUND", message: "This contribution link is not valid or the campaign has ended." } });
      }
      const email = parsed.data.email.toLowerCase();
      if (await storage.getAuthUserByEmail(email)) {
        return res.status(409).json({ error: { code: "EMAIL_REGISTERED", message: "This email already has a Rhemito account. Please sign in." } });
      }
      const previous = req.session.paymentRequestVerification;
      if (previous?.email === email && Date.now() - previous.lastSentAt < 60_000) {
        res.setHeader("Retry-After", Math.ceil((60_000 - (Date.now() - previous.lastSentAt)) / 1000));
        return res.status(429).json({ error: { code: "PIN_COOLDOWN", message: "Please wait before requesting another PIN." } });
      }
      await storage.invalidateOtps(email);
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await storage.createOtp(email, code, new Date(Date.now() + 10 * 60_000));
      req.session.paymentRequestVerification = {
        email,
        token: campaignId,
        isEmailLink: false,
        verified: false,
        failedAttempts: 0,
        lastSentAt: Date.now(),
      };
      return res.json({
        data: {
          sent: true,
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
          ...(demoModeEnabled ? { devPin: code } : {}),
        },
      });
    } catch (error) {
      console.error("Campaign verification send error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/public/campaign-verifications/verify", async (req: Request, res: Response) => {
    try {
      if (!enforceAuthRateLimit(req, res, "paymentIntent")) return;
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const campaignId = String(req.body?.campaignId ?? "").trim();
      const code = String(req.body?.code ?? "").trim();
      const campaign = await storage.getGroupPayCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: { code: "CAMPAIGN_NOT_FOUND", message: "This contribution link is not valid or the campaign has ended." } });
      }
      const verification = req.session.paymentRequestVerification;
      if (!verification || verification.token !== campaignId || verification.isEmailLink !== false || verification.email !== email) {
        return res.status(400).json({ error: { code: "PIN_NOT_SENT", message: "Request a new PIN for this email address." } });
      }
      if (verification.failedAttempts >= 5) {
        return res.status(429).json({ error: { code: "PIN_LOCKED", message: "Too many incorrect attempts. Request a new PIN later." } });
      }
      const otp = code.length === 6 ? await storage.getValidOtp(email, code) : undefined;
      if (!otp) {
        verification.failedAttempts += 1;
        return res.status(400).json({ error: { code: "INVALID_PIN", message: "The PIN is invalid or has expired." } });
      }
      await storage.markOtpUsed(otp.id);
      verification.verified = true;
      return res.json({ data: { verified: true } });
    } catch (error) {
      console.error("Campaign verification verify error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Get Current User ──────────────────────────────────────────
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getAuthUserById(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { password: _, ...safeUser } = user;
      return res.json({ user: safeUser });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Logout ─────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ success: true, message: "Logged out successfully" });
    });
  });
}
