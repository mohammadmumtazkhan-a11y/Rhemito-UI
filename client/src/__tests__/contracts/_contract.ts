/**
 * Contract-test helpers for the Promo Code, Bonus, Referral and payment-flow features.
 *
 * A "contract" is a rule of the implemented design that must not change by accident. When one fails, the
 * failure message starts with a CONTRACT block that tells an engineer or AI agent:
 *   (a) which rule broke        -> id + title
 *   (b) why the rule exists     -> WHY
 *   (c) what the correct, implemented behaviour is and where it lives -> HOW IT IS IMPLEMENTED / FIX + CODE
 * The original assertion error follows the block so the exact mismatch is still visible.
 *
 * Only change a contract when the product owner (Mohammad) has changed the rule, and update the test in the
 * same PR with the reason (see "Rewards contract tests" in CLAUDE.md).
 */
import { it } from "vitest";
import fs from "fs";
import path from "path";

export interface RuleInfo {
  /** Why the rule exists (the product or money-safety reason). */
  why: string;
  /** What the implemented behaviour is, and how to restore it if a change broke it. */
  fix: string;
  /** Files where the behaviour lives. */
  where: string | string[];
  /** Optional per-test timeout in ms. */
  timeout?: number;
}

export function contractBlock(id: string, title: string, info: RuleInfo): string {
  const code = Array.isArray(info.where) ? info.where.join(", ") : info.where;
  return `\nCONTRACT ${id} BROKEN: ${title}\nWHY: ${info.why}\nHOW IT IS IMPLEMENTED / FIX: ${info.fix}\nCODE: ${code}\n\n--- original error ---\n`;
}

/** Registers `it("[ID] title")`. Any failure is rethrown with the CONTRACT block in front of the original message. */
export function rule(id: string, title: string, info: RuleInfo, fn: () => unknown | Promise<unknown>): void {
  it(
    `[${id}] ${title}`,
    async () => {
      try {
        await fn();
      } catch (err) {
        const block = contractBlock(id, title, info);
        if (err instanceof Error) {
          // Keep the original error object so vitest still shows the expected/actual diff
          err.message = `${block}${err.message}`;
          throw err;
        }
        throw new Error(`${block}${String(err)}`);
      }
    },
    info.timeout,
  );
}

// ─── Static source checks ─────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "../../../..");

/** Source file (repo-relative path) with comments removed, so a rule is not satisfied by a comment. */
export function source(rel: string): string {
  const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** Number of regex matches (global) in a source file. */
export function countMatches(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`)) ?? []).length;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
