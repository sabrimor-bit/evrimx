import { sendToCliq } from "@/lib/cliq";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const day = new Date().getDay();

  if (day === 5) {
    await sendToCliq("Merhaba ekip! Cuma geldi — haftalik plan ozetlerinizi guncellemeyi unutmayin.");
    return NextResponse.json({ ok: true, type: "friday" });
  }

  if (day === 4) {
    const supabase = await createServerSupabase();
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const monday = mon.toISOString().split("T")[0];

    const { data: weeks } = await supabase
      .from("weeks")
      .select("id, user_id")
      .gte("start_date", monday);

    if (!weeks || weeks.length === 0) {
      return NextResponse.json({ ok: true, type: "thursday_no_data" });
    }

    const { data: incompleteTasks } = await supabase
      .from("tasks")
      .select("title, user_id, week_id")
      .in("week_id", weeks.map(w => w.id))
      .eq("priority", "P1")
      .neq("status", "Tamamlandi");

    if (!incompleteTasks || incompleteTasks.length === 0) {
      await sendToCliq("Harika is ekip! Bu haftanin tum P1 gorevleri tamamlanmis gorunuyor.");
      return NextResponse.json({ ok: true, type: "thursday_all_done" });
    }

    const lines = [
      "Persembe uyarisi! Asagidaki P1 gorevler henuz tamamlanmadi:",
      "",
      ...incompleteTasks.map(t => "- " + t.title),
      "",
      "Bugun tamamlamaya calisalim!"
    ];

    await sendToCliq(lines.join("\n"));
    return NextResponse.json({ ok: true, type: "thursday_warning" });
  }

  return NextResponse.json({ ok: true, type: "not_a_reminder_day" });
}