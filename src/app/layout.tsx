import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TikTok Telegram Bot",
  description: "Telegram bot that downloads TikTok videos and posts them back",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
