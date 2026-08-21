import type { Metadata } from "next";
import "./globals.css";
import "./onboarding.css";

export const metadata: Metadata = {
  title: "졸업나침반 | KMOU 졸업요건 진단",
  description: "한국해양대학교 학생을 위한 졸업요건 진단 및 수강설계 서비스",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
