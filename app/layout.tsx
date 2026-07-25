import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

/** One family throughout — rounded humanist, friendly at display sizes,
    still legible at 13px on a label. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Anchor",
  description: "The version of you that made it, one call away.",
};

export const viewport: Viewport = {
  themeColor: "#F3EDE5",
  // The call screen runs edge to edge on a phone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} bg-cream text-ink antialiased`}>{children}</body>
    </html>
  );
}
