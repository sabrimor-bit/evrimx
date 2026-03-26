"use client";
import { createClient } from "@/lib/supabase";
import { Profile, Task, Week } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PRIORITY_CFG: Record<string, { badge: string; dot: string }> = {
  P1: { badge: "bg-red-950 text-red-300 border-red-800",         dot: "bg-red-500"     },
  P2: { badge: "bg-amber-950 text-amber-300 border-amber-800",   dot: "bg-amber-400"   },
  P3: { badge: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-500" },
  NEW:{ badge: "bg-indigo-950 text-indigo-300 border-indigo-800", dot: "bg-indigo-400"  },
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  Baslamadi:      { label: "Başlamadı",    cls: "bg-gray-800 text-gray-400"       },
  "Devam Ediyor": { label: "Devam Ediyor", cls: "bg-indigo-950 text-indigo-300"   },
  Tamamlandi:     { label: "Tamamlandı",   cls: "bg-emerald-950 text-emerald-300" },
  Bloke:          { label: "Bloke",        cls: "bg-red-950 text-red-300"         },
};

function mondayOf(d = new Date()) {
  const mon = new Date(d);
  const day = mon.getDay();
  mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
  return mon.toISOString().split("T")[0];
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-900 text-indigo-300",
  "bg-emerald-900 text-emerald-300",
  "bg-amber-900 text-amber-300",
  "bg-red-900 text-red-300",
  "bg-purple-900 text-purple-300",
];

export default function TeamPage() {
  const supabase = createClient();
  const router = useRouter();
  const [data, setData] = useState<Array<{ profile: Profile; week: Week | null; tasks: Task[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setCurrentUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      if (!profiles) { setLoading(false); return; }

      const monday = mondayOf();
      const results = await Promise.all(
        profiles.map(async (profile) => {
          const { data: weekData } = await supabase
            .from("weeks").select("*")
            .eq("user_id", profile.id)
            .gte("start_date", monday)
            .order("start_date", { ascending: false })
            .limit(1).maybeSingle();

          const tasks = weekData
            ? (await supabase.from("tasks").select("*").eq("week_id", weekData.id).order("created_at")).data || []
            : [];

          return { profile, week: weekData, tasks };
        })
      );

      setData(results);
      setLoading(false);
    })();
  }, [currentUserId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
      Yükleniyor...
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Topbar */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">H</div>
            <span className="font-semibold text-white text-sm">Ekip Planları</span>
            <span className="text-gray-600 text-xs">|</span>
            <span className="text-gray-400 text-xs">Bu hafta</span>
          </div>
          <button onClick={() => router.push("/dashboard")}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">
            Kendi Planım
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {data.length === 0 && (
          <p className="text-gray-500 text-sm italic">Henüz ekip üyesi yok.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(({ profile, week, tasks }, idx) => {
            const done = tasks.filter(t => t.status === "Tamamlandi").length;
            const total = tasks.length;
            const pct = total ? Math.round(done / total * 100) : 0;
            const isMe = profile.id === currentUserId;
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

            return (
              <div key={profile.id}
                className={`bg-gray-900 border rounded-2xl p-5 transition ${isMe ? "border-indigo-700" : "border-gray-800"}`}>
                {/* Kart header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold ${avatarColor}`}>
                    {initials(profile.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">
                        {profile.full_name || "İsimsiz Kullanıcı"}
                      </p>
                      {isMe && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">Sen</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{week?.label || "Bu hafta plan yok"}</p>
                  </div>
                  {total > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{pct}%</p>
                      <p className="text-xs text-gray-500">{done}/{total}</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {/* Görev listesi */}
                {tasks.length === 0 ? (
                  <p className="text-xs text-gray-700 italic">Bu hafta plan girilmemiş</p>
                ) : (
                  <div className="space-y-2">
                    {(["P1","P2","P3","NEW"]).map(p => {
                      const pts = tasks.filter(t => t.priority === p);
                      if (!pts.length) return null;
                      return pts.map(t => {
                        const scfg = STATUS_CFG[t.status] || STATUS_CFG["Baslamadi"];
                        const pcfg = PRIORITY_CFG[p];
                        return (
                          <div key={t.id} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pcfg.dot} ${t.status === "Tamamlandi" ? "opacity-30" : ""}`} />
                            <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${pcfg.badge}`}>{p}</span>
                            <span className={`text-xs flex-1 truncate ${t.status === "Tamamlandi" ? "line-through text-gray-600" : "text-gray-300"}`}>
                              {t.title}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${scfg.cls}`}>
                              {scfg.label}
                            </span>
                          </div>
                        );
                      });
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}