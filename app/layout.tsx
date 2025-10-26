import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/app/styles/liquid-glass.css";
import { ChatProvider } from "@/components/contexts/ChatProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { BackgroundModeProvider } from "@/components/contexts/BackgroundModeContext";
import OuterSidebarClient from "@/components/outerSidebar/OuterSidebarClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Strings",
  description: "AI chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`} style={{ background: 'var(--background-gradient, rgba(255,255,255,0.3))' }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <BackgroundModeProvider>
          <ChatProvider>
            {/* Fixed outer sidebar rail */}
            <OuterSidebarClient />
        {children}
          </ChatProvider>
          </BackgroundModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
