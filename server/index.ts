import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDemoNotifications } from "./notificationService";
import { storage } from "./storage";

// Extend session to include userId
declare module "express-session" {
  interface SessionData {
    userId: string;
    paymentRequestVerification?: {
      email: string;
      token: string;
      isEmailLink: boolean;
      verified: boolean;
      failedAttempts: number;
      lastSentAt: number;
    };
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function main() {
  // Seed demo notifications so /notifications/demo-notification-* URLs render
  // real content on a fresh boot. Idempotent.
  seedDemoNotifications();

  const app = express();
  const httpServer = createServer(app);

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  // Behind a proxy (Render/Replit), trust X-Forwarded-Proto so session cookies
  // are marked Secure only when the actual connection is HTTPS.
  app.set("trust proxy", 1);

  // Session middleware — development swaps in a file-backed store so logins
  // survive dev-server restarts; production must use a shared store (Postgres).
  const SessionStore =
    process.env.NODE_ENV === "production" ? undefined : new (await import("./fileSessionStore")).FileSessionStore();

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "rhemito-dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: SessionStore,
      cookie: {
        secure: "auto", // Secure over HTTPS, plain over HTTP (e.g. local runs)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax",
      },
    }),
  );

  // Development only: restore registered users / pending OTPs from the dev
  // snapshot so restarts do not silently log everyone out. Invoices, money
  // requests and payout accounts ride along so mid-test journeys survive
  // restarts too. Production uses real persistence infrastructure instead.
  if (process.env.NODE_ENV !== "production") {
    const { loadSnapshot } = await import("./devPersistence");
    const snapshot = loadSnapshot();
    if (snapshot) {
      storage.hydrateForDev(
        snapshot.authUsers as never[],
        snapshot.otpCodes as never[],
        snapshot.groupPayCampaigns as never[],
        snapshot.groupPayContributions as never[],
        snapshot.invoices as never[],
        snapshot.invoiceDocuments as never[],
        snapshot.invoiceEvents as never[],
        snapshot.clientEmails as never[],
        snapshot.moneyRequests as never[],
        snapshot.payoutAccounts as never[],
        snapshot.sequences,
      );
      log(
        `[devPersistence] restored ${snapshot.authUsers.length} user(s), ` +
        `${snapshot.groupPayCampaigns.length} campaign(s), ${snapshot.invoices.length} invoice(s), ` +
        `${snapshot.moneyRequests.length} money request(s)`,
      );
    }
  }

  // Authentication always comes from an explicit login/registration session;
  // development must exercise the same payer identity boundary as production.
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if none is specified.
  // This serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // Health check endpoint
  app.get("/healthz", (_req, res) => {
    res.status(200).send("OK");
  });

  httpServer.listen(port, () => {
    log(`serving on port ${port}`);
  });
}

void main();
