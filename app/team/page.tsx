// ============================================================
// app/team/page.tsx  —  Ekip haftalık planlarını göster
// ============================================================
"use client";
import { createClient } from "@/lib/supabase";
import { Profile, Task, Week } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeamPage() {
  const supabase = createClient();
  const router = useRouter();
  const [data, setData] = useState<Array<{ profile: Profile; week: Week; tasks: Task[] }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Tüm profilleri çek
      const { data: profiles } = await supabase.from("profiles").select("*");
      if (!profiles) return;

      // Her profil için bu haftanın verilerini çek
      const monday = mondayOf();
      const results = await Promise.all(
        profiles.map(async (profile) => {
          const { data: weekData } = await supabase
            .from("weeks").select("*")
            .eq("user_id", profile.id)
            .gte("start_date", monday)
            .order("start_date", { ascending: false })
            .limit(1).single();

          const tasks = weekData
            ? (await supabase.from("tasks").select("*").eq("week_id", weekData.id).order("created_at")).data || []
            : [];

          return { profile, week: weekData, tasks };
        })
      );

      setData(results.filter(r => r.week)); // haftası olmayanları filtrele
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Yükleniyor...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium">Ekip Planları</h1>
        <button onClick={() => router.push("/dashboard")}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          Kendi Planım
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map(({ profile, week, tasks }) => {
          const done = tasks.filter(t => t.status === "Tamamlandi").length;
          return (
            <div key={profile.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                  {(profile.full_name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{profile.full_name || "İsimsiz"}</p>
                  <p className="text-xs text-gray-400">{week.label} · {done}/{tasks.length} tamamlandı</p>
                </div>
              </div>

              <div className="space-y-1">
                {(["P1","P2","P3"] as const).map(p => {
                  const pts = tasks.filter(t => t.priority === p);
                  if (!pts.length) return null;
                  return pts.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${
                        t.status === "Tamamlandi" ? "bg-green-50 text-green-600" :
                        t.status === "Devam Ediyor" ? "bg-amber-50 text-amber-600" :
                        t.status === "Bloke" ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"
                      }`}>{t.priority}</span>
                      <span className={`truncate ${t.status === "Tamamlandi" ? "line-through text-gray-300" : "text-gray-600"}`}>
                        {t.title}
                      </span>
                    </div>
                  ));
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mondayOf(d = new Date()) {
  const mon = new Date(d);
  const day = mon.getDay();
  mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
  return mon.toISOString().split("T")[0];
}