/** Where "Contact support" links go. One place to change when a support page or inbox is set up. */
export const SUPPORT_EMAIL = "admin@rhemito.com";

export function supportHref(subject?: string): string {
  return `mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
