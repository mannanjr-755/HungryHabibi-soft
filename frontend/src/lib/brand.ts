/** Hungry Habibi brand + customer menu URL helpers (CRM ↔ Digital Menu). */

export const BRAND_NAME = "Hungry Habibi";
export const BRAND_SLUG = "hungryhabibi";
export const ADMIN_EMAIL = "admin@hungryhabibi.com";

export const CUSTOMER_MENU_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://hungryhabibi-menu.vercel.app";

export function tableMenuUrl(tableNumber: number, slug: string = BRAND_SLUG): string {
  return `${CUSTOMER_MENU_URL}/r/${slug}/t/${tableNumber}`;
}

export function waitingCustomerMenuUrl(slug: string = BRAND_SLUG): string {
  return `${CUSTOMER_MENU_URL}/r/${slug}/waiting-customer`;
}
