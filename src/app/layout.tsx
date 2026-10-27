import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// zonemix.tech's typeface: one variable family for display and reading.
const sans = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--ff-sans",
  axes: ["opsz", "wdth"],
  display: "swap",
});

const SITE_URL = "https://elections.zonemix.tech";
const TITLE = "South Dakota Votes: 2026 General Election";
const DESCRIPTION =
  "Live results for South Dakota's November 3, 2026 general election, plus a ZIP code lookup to see what's on your ballot.";
// Bump OG_VERSION when public/og.png changes, so link previews refetch it.
const OG_VERSION = "2";
const OG_IMAGE = {
  url: `${SITE_URL}/og.png?v=${OG_VERSION}`,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "South Dakota votes: November 3, 2026 general election results",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "zonemix elections",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Runs before paint: saved choice, else the system setting. Storage can throw
// (private mode, blocked site data), so it falls back silently to the system.
const THEME_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
