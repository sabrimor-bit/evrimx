// ============================================================
// app/layout.tsx
// ============================================================
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haftalık Plan Takipçisi",
  description: "Ekip haftalık plan takip uygulaması",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}