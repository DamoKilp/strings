// /components/outerSidebar/OuterSidebarClient.tsx
'use client';
import dynamic from "next/dynamic";

// Dynamically import the RenderOuterSidebar component with SSR disabled
const RenderOuterSidebar = dynamic(() => import("./renderOuterSidebar"), { ssr: false });

export default function OuterSidebarClient() {
  return <RenderOuterSidebar />;
}