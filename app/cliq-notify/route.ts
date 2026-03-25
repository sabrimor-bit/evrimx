// ============================================================
// app/api/cliq-notify/route.ts  —  Zoho Cliq webhook
// ============================================================
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  const webhookUrl = process.env.CLIQ_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ error: "Webhook URL tanımlı değil" }, { status: 500 });

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  return NextResponse.json({ ok: true });
}