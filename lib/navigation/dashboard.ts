import type { MessageKey } from "@/lib/i18n/messages/en";

export type DashboardNavItem = { icon: string; labelKey: MessageKey; descriptionKey: MessageKey; href: string };
export type DashboardNavGroup = { id: "invent" | "protect" | "grow" | "account"; labelKey: MessageKey; items: readonly DashboardNavItem[] };

export const DASHBOARD_NAV_GROUPS: readonly DashboardNavGroup[] = [
  {
    id: "invent",
    labelKey: "navigation.invent",
    items: [
      { icon: "⌂", labelKey: "navigation.home", descriptionKey: "navigation.homeHelp", href: "/dashboard" },
      { icon: "◇", labelKey: "navigation.myInventions", descriptionKey: "navigation.inventionsHelp", href: "/dashboard/inventions" },
      { icon: "+", labelKey: "navigation.startInvention", descriptionKey: "navigation.startHelp", href: "/dashboard/inventions/new" },
    ],
  },
  {
    id: "protect",
    labelKey: "navigation.protect",
    items: [
      { icon: "§", labelKey: "navigation.patentWorkspace", descriptionKey: "navigation.patentWorkspaceHelp", href: "/dashboard/inventions?intent=patent-workspace" },
      { icon: "™", labelKey: "navigation.trademarks", descriptionKey: "navigation.trademarksHelp", href: "/dashboard/trademarks" },
    ],
  },
  {
    id: "grow",
    labelKey: "navigation.grow",
    items: [
      { icon: "₹", labelKey: "navigation.grants", descriptionKey: "navigation.grantsHelp", href: "/dashboard/grants" },
      { icon: "⚙", labelKey: "navigation.manufacturing", descriptionKey: "navigation.manufacturingHelp", href: "/dashboard/manufacturing" },
    ],
  },
  {
    id: "account",
    labelKey: "navigation.account",
    items: [
      { icon: "⚙", labelKey: "navigation.settings", descriptionKey: "navigation.settingsHelp", href: "/dashboard/settings" },
      { icon: "?", labelKey: "navigation.help", descriptionKey: "navigation.helpDescription", href: "/dashboard/help" },
    ],
  },
] as const;

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = DASHBOARD_NAV_GROUPS.flatMap((group) => [...group.items]);

export function dashboardNavItemActive(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  if (cleanHref === "/dashboard") return pathname === cleanHref;
  if (cleanHref === "/dashboard/inventions/new") return pathname === cleanHref;
  if (href.includes("intent=patent-workspace")) return /^\/dashboard\/inventions\/[^/]+/.test(pathname);
  if (cleanHref === "/dashboard/inventions") return pathname === cleanHref;
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
