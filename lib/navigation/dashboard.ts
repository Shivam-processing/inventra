export const DASHBOARD_NAV_ITEMS = [
  { icon: "▦", labelKey: "navigation.dashboard", href: "/dashboard" },
  { icon: "◇", labelKey: "navigation.inventions", href: "/dashboard/inventions" },
  { icon: "⚙", labelKey: "navigation.manufacturing", href: "/dashboard/manufacturing" },
  { icon: "₹", labelKey: "navigation.grants", href: "/dashboard/grants" },
  { icon: "™", labelKey: "navigation.trademarks", href: "/dashboard/trademarks" },
  { icon: "+", labelKey: "navigation.startInvention", href: "/dashboard/inventions/new" },
] as const;

export function dashboardNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/inventions/new") return pathname === href;
  return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== "/dashboard/inventions/new");
}
