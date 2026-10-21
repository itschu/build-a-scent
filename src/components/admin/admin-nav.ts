export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/orders", label: "Orders", key: "orders" },
  { href: "/admin/products", label: "Products", key: "products" },
  { href: "/admin/ingredients", label: "Ingredients", key: "ingredients" },
  { href: "/admin/bottle-options", label: "Bottle Options", key: "bottle-options" },
  { href: "/admin/listings", label: "Listings", key: "listings" },
  { href: "/admin/analytics", label: "Analytics", key: "analytics" },
  { href: "/admin/settings", label: "Settings", key: "settings" },
] as const;

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]["key"];
export type AdminBadges = Partial<Record<AdminSectionKey, number>>;
