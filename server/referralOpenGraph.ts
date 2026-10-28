import type { Express, Request, Response } from "express";
import { serverConfig } from "./config";
import { mito } from "./rewardsService";

const OG_CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  INR: "₹",
  JPY: "¥",
  CNY: "¥",
  AUD: "A$",
  CAD: "C$",
  ZAR: "R",
  KES: "KSh ",
  GHS: "GH₵",
  AED: "AED ",
};

function fmtOgMoney(amount: number, currency: string): string {
  const dp = currency === "JPY" ? 0 : 2;
  const n = Number(amount || 0);
  return `${OG_CURRENCY_SYMBOLS[currency] ?? `${currency} `}${Math.abs(n).toLocaleString("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface ReferralPreviewDetails {
  code: string;
  referrerFirstName: string;
  currency: string;
  rewardFormatted: string;
  floorFormatted: string;
  windowDays: number;
  corridorText: string;
}

const KNOWN_SUFFIX_CURRENCIES = ["GBP", "USD", "EUR", "NGN", "INR", "JPY", "CNY", "AUD", "CAD", "ZAR", "KES", "GHS", "AED"];

function inferCurrencyFromCode(code: string): string | null {
  const upper = String(code || "").trim().toUpperCase();
  for (const cur of KNOWN_SUFFIX_CURRENCIES) {
    if (upper.length >= 9 && upper.endsWith(cur)) return cur;
  }
  return null;
}

export async function fetchReferralPreviewDetails(rawCode: string, ruleId?: number): Promise<ReferralPreviewDetails> {
  const code = String(rawCode || "").trim().toUpperCase();
  const inferredCur = inferCurrencyFromCode(code);
  try {
    const result = await mito(`/api/referral/codes/${encodeURIComponent(code)}${ruleId ? `?rule_id=${ruleId}` : ""}`);
    const offers: any[] = Array.isArray(result.currency_offers) && result.currency_offers.length > 0
      ? result.currency_offers
      : result.offer
        ? [result.offer]
        : [];
    const targetCur = String(result.currency || inferredCur || result.offer?.currency || "GBP").toUpperCase();
    const matchedOffer =
      (ruleId ? offers.find((o) => Number(o.rule_id) === ruleId) : null) ??
      offers.find((o) => String(o.currency).toUpperCase() === targetCur) ??
      result.offer ??
      offers[0] ??
      null;

    const currency = String(matchedOffer?.currency || targetCur || "GBP").toUpperCase();
    const rewardAmount =
      matchedOffer && matchedOffer.reward_type !== "REFERRER" && Number(matchedOffer.referee_reward) > 0
        ? Number(matchedOffer.referee_reward)
        : Number(matchedOffer?.referrer_reward || 10);
    const floorAmount = Number(matchedOffer?.floor ?? 100);
    const windowDays = Number(matchedOffer?.qualification_window_days || matchedOffer?.bonus_validity_days || 90);
    const corridorText = matchedOffer?.receive_currency ? ` to ${matchedOffer.receive_currency}` : "";

    return {
      code: String(result.code || code),
      referrerFirstName: String(result.referrer_first_name || "Your friend"),
      currency,
      rewardFormatted: fmtOgMoney(rewardAmount, currency),
      floorFormatted: fmtOgMoney(floorAmount, currency),
      windowDays,
      corridorText,
    };
  } catch {
    const currency = inferredCur || "GBP";
    const defaultReward = currency === "USD" ? 20 : currency === "EUR" ? 15 : 10;
    const defaultFloor = currency === "USD" ? 100 : currency === "EUR" ? 80 : 50;
    return {
      code,
      referrerFirstName: "Your friend",
      currency,
      rewardFormatted: fmtOgMoney(defaultReward, currency),
      floorFormatted: fmtOgMoney(defaultFloor, currency),
      windowDays: 90,
      corridorText: "",
    };
  }
}

export function renderReferralOgSvg(d: ReferralPreviewDetails): string {
  const code = escapeXml(d.code);
  const inviter = escapeXml(d.referrerFirstName);
  const reward = escapeXml(d.rewardFormatted);
  const floor = escapeXml(d.floorFormatted);
  const currency = escapeXml(d.currency);
  const corridor = escapeXml(d.corridorText);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="55%" stop-color="#182235"/>
      <stop offset="100%" stop-color="#231D49"/>
    </linearGradient>
    <radialGradient id="glowGrad" cx="85%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#6A50D8" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#6A50D8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#glowGrad)"/>

  <!-- Official Rhemito Logo (assets/Rhemito-logo.svg) + Brand Header -->
  <g transform="translate(72, 56)">
    <rect x="0" y="0" width="56" height="56" rx="14" fill="#FFFFFF"/>
    <g transform="translate(15, 11.5)">
      <path d="M25.0764 30.3999C25.0471 30.0963 24.9593 29.8023 24.813 29.5351L16.8761 14.4493L24.8398 3.57589C25.5715 2.5726 25.352 1.17091 24.3471 0.439699C23.9495 0.165191 23.5007 0 22.9983 0H2.25129C1.63908 0 1.08296 0.238069 0.658557 0.655904C0.251228 1.06159 0 1.62275 0 2.24222V30.604C0 31.3109 0.348792 32.0008 0.924419 32.4162C1.83664 33.0988 3.22693 32.9434 3.95622 32.0688C3.99769 32.0227 4.03183 31.9741 4.07086 31.9279L10.3296 23.3818L21.3836 32.3312C21.5568 32.4769 21.7543 32.5911 21.9641 32.6786C23.5007 33.332 25.2447 32.0591 25.0739 30.4023L25.0764 30.3999ZM9.49542 16.915L4.5099 23.7218V4.4893H18.6006L11.5857 14.0606L15.7541 21.9825L9.49542 16.915Z" fill="#3D48D1"/>
    </g>
    <text x="72" y="38" fill="#FFFFFF" font-family="Inter, Plus Jakarta Sans, Arial, sans-serif" font-size="32" font-weight="800" letter-spacing="-0.8">Rhemito</text>
    <rect x="236" y="12" width="380" height="34" rx="17" fill="#2E365A" stroke="#535E8C" stroke-width="1"/>
    <text x="256" y="34" fill="#C8B8FF" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="0.8">✦ PERSONAL INVITATION FROM ${inviter.toUpperCase()}</text>
  </g>

  <!-- Main Marketing Hook -->
  <text x="72" y="182" fill="#F8FAFC" font-family="Plus Jakarta Sans, Inter, Arial, sans-serif" font-size="54" font-weight="800" letter-spacing="-1.2">Get ${reward} Bonus Credit</text>
  <text x="72" y="232" fill="#CBD5E1" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="500">on your first ${currency} transfer of ${floor} or more${corridor} within ${d.windowDays} days</text>

  <!-- Why Register & Transfer Box -->
  <g transform="translate(72, 268)">
    <rect x="0" y="0" width="1056" height="196" rx="22" fill="#1F2942" stroke="#374368" stroke-width="1.5"/>
    <text x="32" y="42" fill="#93C5FD" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="1.4">WHY REGISTER &amp; TRANSFER WITH RHEMITO</text>
    <text x="32" y="84" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600">✓  Great exchange rates &amp; low, transparent fees across global corridors</text>
    <text x="32" y="126" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600">✓  Fast, secure transfers straight to bank accounts, mobile wallets &amp; cash pick-up</text>
    <text x="32" y="168" fill="#5EEAD4" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">✓  ${reward} welcome bonus unlocked automatically when your first qualifying transfer completes</text>
  </g>

  <!-- 3-Step Footer Bar -->
  <g transform="translate(72, 496)">
    <rect x="0" y="0" width="710" height="72" rx="16" fill="#162035" stroke="#2D3A59" stroke-width="1"/>
    <text x="24" y="43" fill="#E2E8F0" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="600">1. Register free   →   2. Send ${floor}+ in ${d.windowDays} days   →   3. Unlock ${reward}</text>

    <rect x="734" y="0" width="322" height="72" rx="16" fill="#3D48D1"/>
    <text x="760" y="28" fill="#DBEAFE" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1.2">INVITE CODE</text>
    <text x="760" y="55" fill="#FFFFFF" font-family="monospace, Inter, Arial" font-size="24" font-weight="800" letter-spacing="1.5">${code}</text>
  </g>
</svg>`;
}

export interface ReferralOpenGraphMeta {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

export async function resolveReferralOpenGraphMeta(req: Request): Promise<ReferralOpenGraphMeta | null> {
  const match = req.path.match(/^\/ref(?:er)?\/([A-Za-z0-9]{4,24})\/?$/);
  if (!match) return null;
  const code = match[1].toUpperCase();
  const ruleParam = req.query?.rule ?? req.query?.rule_id;
  const ruleId = ruleParam && /^\d+$/.test(String(ruleParam)) ? Number(ruleParam) : undefined;
  const details = await fetchReferralPreviewDetails(code, ruleId);

  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.get("host") || serverConfig.publicBaseUrl.replace(/^https?:\/\//, "");
  const origin = `${proto}://${host}`.replace(/\/+$/, "");

  const title = `${details.referrerFirstName} invited you to Rhemito — Get ${details.rewardFormatted} bonus credit on your first transfer!`;
  const description = `Join Rhemito with code ${details.code} and send ${details.floorFormatted} or more${details.corridorText} within ${details.windowDays} days to unlock your ${details.rewardFormatted} welcome bonus. Why Rhemito? Great exchange rates, low transparent fees, and fast, secure international transfers to bank accounts & mobile wallets.`;
  const imageUrl = `${origin}/api/rewards/og-image/${encodeURIComponent(details.code)}`;
  const url = `${origin}${req.originalUrl}`;

  return { title, description, imageUrl, url };
}

export function injectOpenGraphIntoHtml(html: string, meta: ReferralOpenGraphMeta): string {
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const title = esc(meta.title);
  const desc = esc(meta.description);
  const img = esc(meta.imageUrl);
  const url = esc(meta.url);

  return html
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${img}" />\n    <meta property="og:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${desc}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${img}" />`)
    .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
}

export function registerReferralOpenGraphRoutes(app: Express): void {
  app.get("/api/rewards/og-image/:code", async (req: Request, res: Response) => {
    try {
      const code = String(req.params.code ?? "").trim().toUpperCase();
      const ruleParam = req.query?.rule ?? req.query?.rule_id;
      const ruleId = ruleParam && /^\d+$/.test(String(ruleParam)) ? Number(ruleParam) : undefined;
      const details = await fetchReferralPreviewDetails(code, ruleId);
      const svg = renderReferralOgSvg(details);
      res
        .status(200)
        .set({
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        })
        .send(svg);
    } catch {
      const fallback = renderReferralOgSvg({
        code: String(req.params.code ?? "RHEMITO").trim().toUpperCase(),
        referrerFirstName: "Your friend",
        currency: "GBP",
        rewardFormatted: "£10.00",
        floorFormatted: "£50.00",
        windowDays: 90,
        corridorText: "",
      });
      res.status(200).set({ "Content-Type": "image/svg+xml; charset=utf-8" }).send(fallback);
    }
  });
}
