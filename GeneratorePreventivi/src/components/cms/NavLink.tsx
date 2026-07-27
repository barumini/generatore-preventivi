"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "9px 14px",
        borderRadius: "var(--radius-md)",
        font: active ? "700 14px var(--font-sans)" : "500 14px var(--font-sans)",
        color: active ? "var(--teal-800)" : "var(--text-secondary)",
        background: active ? "var(--teal-100)" : "transparent",
      }}
    >
      {children}
    </Link>
  );
}
