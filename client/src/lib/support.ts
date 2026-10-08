/** Where "Contact support" links go. One place to change when a support page or inbox is set up. */
export const SUPPORT_EMAIL = "admin@rhemito.com";

/** The Contact support links are shown but disabled until a support channel is decided. Set to true to enable them. */
export const SUPPORT_LINK_ENABLED = false;

export function supportHref(subject?: string): string {
  return `mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
