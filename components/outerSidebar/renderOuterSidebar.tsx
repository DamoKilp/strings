// /components/outerSidebar/renderOuterSidebar.tsx
'use client';
import { usePathname } from "next/navigation";
import { OuterSidebar } from "@/components/outerSidebar/outerSidebar";

export default function RenderOuterSidebar() {
  const pathname = usePathname();

  // Do not render OuterSidebar on authentication pages ("/sign-in", "/sign-up", "/sign-out")
  if (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/sign-out")
  ) {
    return null;
  }

  return <OuterSidebar />;
}