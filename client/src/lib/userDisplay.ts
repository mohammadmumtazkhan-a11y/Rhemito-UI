/** How the signed-in customer is shown in the header and the dashboard welcome. */
import type { AuthUser } from "@/hooks/use-auth";

type NameFields = Pick<AuthUser, "accountType" | "firstName" | "lastName" | "businessName" | "email">;

const clean = (v: string | null | undefined) => (v ?? "").trim();

/** First name for a person, business name for a business; falls back to the part of the email before the @. */
export function welcomeName(user: NameFields | null | undefined): string {
  if (!user) return "";
  const business = clean(user.businessName);
  const first = clean(user.firstName);
  if (user.accountType === "business" && business) return business;
  return first || business || clean(user.email).split("@")[0];
}

/** Up to two capital letters: first + last name, or the first two letters of a single name. */
export function userInitials(user: NameFields | null | undefined): string {
  if (!user) return "";
  const business = user.accountType === "business" ? clean(user.businessName) : "";
  const parts = (business ? business.split(/\s+/) : [clean(user.firstName), clean(user.lastName)]).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? welcomeName(user)).slice(0, 2);
  return letters.toUpperCase();
}

export function profileLabel(user: Pick<AuthUser, "accountType"> | null | undefined): string {
  return user?.accountType === "business" ? "Business Profile" : "Individual Profile";
}
