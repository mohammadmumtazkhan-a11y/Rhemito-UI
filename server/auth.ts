import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { emailCheckSchema, loginSchema, otpVerifySchema } from "@shared/schema";
import { log } from "./index";

function generateOtp(): string {
  // PROTOTYPE: always use 123456 for easy testing
  return "123456";
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
      if (!isMatch) {
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
      const { confirmPassword, ...userData } = req.body;

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

  // ─── Get Current User ──────────────────────────────────────────
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId ?? "user_123";
      let user = await storage.getAuthUserById(userId);
      if (!user) {
        user = await storage.getAuthUserById("user_123");
      }
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
