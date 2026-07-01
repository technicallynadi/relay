import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay — cross-trade referral router",
  description:
    "Relay routes completed jobs into cross-trade referrals: a detector, a federated partner graph, and a jury of diverse LLM judges gated on Kendall's W agreement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DotGothic16 (hero) + JetBrains Mono (everything) — same load as the mock. */}
        <link
          href="https://fonts.googleapis.com/css2?family=DotGothic16&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
