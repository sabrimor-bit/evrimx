import { sendToCliq } from "@/lib/cliq";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "Mesaj boş" }, { status: 400 });
  const ok = await sendToCliq(message);
  return NextResponse.json({ ok });
}