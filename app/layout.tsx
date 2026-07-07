import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from '@clerk/themes';

const IBMPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  // Must match the variable Tailwind's font-IBMPlex utility reads
  // (tailwind.config.ts).
  variable: '--font-ibm-plex',
});

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(serverUrl),
  title: {
    default: "Photosynth AI",
    template: "%s | Photosynth AI",
  },
  description:
    "AI-powered image transformations: restore, recolor, remove objects and backgrounds, and generative fill.",
  openGraph: {
    title: "Photosynth AI",
    description:
      "AI-powered image transformations: restore, recolor, remove objects and backgrounds, and generative fill.",
    url: serverUrl,
    siteName: "Photosynth AI",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{
      variables: {colorPrimary: '#ffffff'},
      baseTheme: dark
    }}>
      <html lang="en">
        <body className=
        {cn('font-IBMPlex antialiased', IBMPlex.variable)}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
