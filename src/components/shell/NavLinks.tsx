"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { isActive, NAV_ITEMS } from "./nav";

function SidebarLinksInner({ pathname }: { pathname: string | null }) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-accent/12 text-fg ring-1 ring-accent/30" : "text-fg-muted hover:bg-surface-2 hover:text-fg"}`}
            >
              <Icon aria-hidden="true" className={`size-4 ${active ? "text-accent" : ""}`} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MobileLinksInner({ pathname }: { pathname: string | null }) {
  return (
    <ul className="grid grid-cols-5">
      {NAV_ITEMS.filter((i) => i.mobile).map(({ href, short, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium ${active ? "text-accent" : "text-fg-muted"}`}>
              <Icon aria-hidden="true" className="size-5" />
              <span>{short}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WithPathname({ render }: { render: (pathname: string | null) => ReactNode }) {
  return render(usePathname());
}

// usePathname suspends while Next builds the fallback shell for dynamic routes, so the
// active-state read sits in a small Suspense leaf with an inactive fallback.
export function SidebarLinks() {
  return (
    <Suspense fallback={<SidebarLinksInner pathname={null} />}>
      <WithPathname render={(p) => <SidebarLinksInner pathname={p} />} />
    </Suspense>
  );
}

export function MobileLinks() {
  return (
    <Suspense fallback={<MobileLinksInner pathname={null} />}>
      <WithPathname render={(p) => <MobileLinksInner pathname={p} />} />
    </Suspense>
  );
}
