import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectOpenGraphIntoHtml, resolveReferralOpenGraphMeta } from "./referralOpenGraph";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (injecting dynamic OpenGraph tags for /ref/:code)
  app.use("*", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      const ogMeta = await resolveReferralOpenGraphMeta(req).catch(() => null);
      if (ogMeta) {
        const html = await fs.promises.readFile(indexPath, "utf-8");
        res.status(200).set({ "Content-Type": "text/html" }).send(injectOpenGraphIntoHtml(html, ogMeta));
        return;
      }
    } catch {
      // Fall back to static index.html
    }
    res.sendFile(indexPath);
  });
}
