import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelMarket — Stock Anomaly & Manipulation Detection",
  description: "Real-time AI-powered market surveillance & pump-and-dump scheme detection for Indian stock markets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0d14] text-slate-100 selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
