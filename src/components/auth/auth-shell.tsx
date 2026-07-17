import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

/**
 * Centered card layout shared by the public auth pages (sign in, sign up,
 * password reset, email verification): the brand logo linking home plus a
 * page title above the page-specific content.
 */
export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" aria-label={`${brand.name} home`} className="mb-8 w-fit">
        <BrandLogo markClassName="h-9 w-9" wordmarkClassName="text-2xl" />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}
