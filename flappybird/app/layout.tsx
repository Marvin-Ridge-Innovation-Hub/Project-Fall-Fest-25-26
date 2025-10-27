import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flappy Bird",
  description: "A simple Flappy Bird game with leaderboard.",
  openGraph: {
    title: "Flappy Bird",
    description: "Play Flappy Bird and submit your score to the leaderboard.",
    images: [
      {
        url: "/flappy-bird-assets-master/sprites/message.png",
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
    images: ["/flappy-bird-assets-master/sprites/message.png"],
  },
  icons: {
    icon: "/flappy-bird-assets-master/sprites/yellowbird-midflap.png",
  },
};

// Ensure correct mobile sizing and use of safe areas (iOS Safari)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/background-day.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/base.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/pipe-green.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/yellowbird-upflap.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/yellowbird-midflap.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/yellowbird-downflap.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/message.png" />
        <link rel="preload" as="image" href="/flappy-bird-assets-master/sprites/gameover.png" />
        {/* Optional: preload number sprites used for the score */}
        {Array.from({ length: 10 }, (_, i) => (
          <link key={i} rel="preload" as="image" href={`/flappy-bird-assets-master/sprites/${i}.png`} />
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
