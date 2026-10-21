import { BarChart3, BookOpenCheck, Layers, LayoutDashboard, PenLine, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Shown in the mobile tab bar. */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Command centre", short: "Home", icon: LayoutDashboard, mobile: true },
  { href: "/review", label: "Flashcard review", short: "Review", icon: BookOpenCheck, mobile: true },
  { href: "/exam", label: "Exam practice", short: "Exam", icon: PenLine, mobile: true },
  { href: "/units", label: "Units F200–F206", short: "Units", icon: Layers, mobile: true },
  { href: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3, mobile: true },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, mobile: false },
];

export function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
