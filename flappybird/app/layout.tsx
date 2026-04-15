import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { sprites, digits } from "@/lib/assets";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Avoid Next defaulting to http://localhost:3000 for social images in static export.
  // (This does not affect gameplay; it just keeps metadata consistent across environments.)
  metadataBase: new URL("https://fall-fest-flappy.local"),
  title: "Flappy Bird",
  description: "A simple Flappy Bird game with leaderboard.",
  openGraph: {
    title: "Flappy Bird",
    description: "Play Flappy Bird and submit your score to the leaderboard.",
    images: [
      {
        url: sprites.message,
        width: 512,
        height: 512,
        alt: "Flappy Bird",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flappy Bird",
    description: "Play Flappy Bird and submit your score to the leaderboard.",
    images: [sprites.message],
  },
  icons: {
    // Use a relative favicon path so `file://` opens don't try to load `/favicon.ico` from disk root.
    icon: [{ url: "./favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preload key sprites so the first frame isn't blank */}
        <link rel="preload" as="image" href={sprites.backgroundDay} />
        <link rel="preload" as="image" href={sprites.pipeGreen} />
        <link rel="preload" as="image" href={sprites.yellowbirdUpflap} />
        <link rel="preload" as="image" href={sprites.yellowbirdMidflap} />
        <link rel="preload" as="image" href={sprites.yellowbirdDownflap} />
        <link rel="preload" as="image" href={sprites.message} />
        <link rel="preload" as="image" href={sprites.gameover} />
        {/* Optional: preload number sprites used for the score */}
        {digits.map((digit, i) => (
          <link key={i} rel="preload" as="image" href={digit} />
        ))}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
