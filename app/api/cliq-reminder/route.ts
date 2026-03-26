// ============================================================
// app/api/cliq-reminder/route.ts  —  Otomatik Cuma hatırlatıcı
// Cron job veya Vercel Cron ile her Cuma sabahı çağır.
// vercel.json dosyasına şunu ekle:
// { "crons": [{ "path": "/api/cliq-reminder", "schedule": "0 7 * * 5" }] }
// ============================================================
import { NextResponse } from "next/server";

export async function GET() {
  const webhookUrl = process.env.CLIQ_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ error: "Webhook URL yok" }, { status: 500 });

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Merhaba ekip! Cuma geldi — haftalık plan özetlerinizi güncellemeyi unutmayın. 📋"
    }),
  });

  return NextResponse.json({ ok: true });
}