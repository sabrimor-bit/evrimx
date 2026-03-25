// ============================================================
// app/dashboard/page.tsx
// ============================================================
"use client";
import { createClient } from "@/lib/supabase";
import { DailyLog, Priority, Status, Task, Week } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  P1: { label: "Kesinlikle bitir",  color: "text-red-700",    bg: "bg-red-50"    },
  P2: { label: "Önemli ilerleme",   color: "text-amber-700",  bg: "bg-amber-50"  },
  P3: { label: "Yaparsan iyi olur", color: "text-green-700",  bg: "bg-green-50"  },
  NEW:{ label: "Yeni / Beklenmedik",color: "text-blue-700",   bg: "bg-blue-50"   },
};

const STATUS_LABELS: Record<Status, string> = {
  Baslamadi: "Başlamadı", "Devam Ediyor": "Devam Ediyor",
  Tamamlandi: "Tamamlandı", Bloke: "Bloke",
};

function weekLabel(d = new Date()) {
  const mon = new Date(d);
  const day = mon.getDay();
  mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  const fmt = (x: Date) => `${String(x.getDate()).padStart(2,"0")}.${String(x.getMonth()+1).padStart(2,"0")}`;
  return `${fmt(mon)} - ${fmt(fri)}`;
}

function mondayOf(d = new Date()) {
  const mon = new Date(d);
  const day = mon.getDay();
  mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
  return mon.toISOString().split("T")[0];
}

function todayLabel() {
  const d = new Date();
  const days = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
}

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [view, setView] = useState<"tasks"|"daily"|"summary">("tasks");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("P1");
  const [logText, setLogText] = useState("");
  const [loading, setLoading] = useState(true);

  // Auth kontrol
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setUserId(data.user.id);
    });
  }, []);

  // Haftaları yükle
  useEffect(() => {
    if (!userId) return;
    supabase.from("weeks").select("*")
      .eq("user_id", userId).order("start_date", { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { ensureCurrentWeek(); return; }
        setWeeks(data);
        setActiveWeekId(data[0].id);
        setLoading(false);
      });
  }, [userId]);

  const ensureCurrentWeek = async () => {
    const monday = mondayOf();
    const { data } = await supabase.from("weeks").insert({
      user_id: userId, label: weekLabel(), start_date: monday,
    }).select().single();
    if (data) { setWeeks([data]); setActiveWeekId(data.id); }
    setLoading(false);
  };

  // Görev ve logları yükle
  useEffect(() => {
    if (!activeWeekId) return;
    supabase.from("tasks").select("*").eq("week_id", activeWeekId)
      .order("created_at").then(({ data }) => setTasks(data || []));
    supabase.from("daily_logs").select("*").eq("week_id", activeWeekId)
      .order("created_at", { ascending: false }).then(({ data }) => setLogs(data || []));
  }, [activeWeekId]);

  const addTask = async () => {
    if (!newTitle.trim() || !activeWeekId) return;
    const { data } = await supabase.from("tasks").insert({
      week_id: activeWeekId, user_id: userId,
      title: newTitle.trim(), priority: newPriority, status: "Baslamadi", note: "",
    }).select().single();
    if (data) setTasks(t => [...t, data]);
    setNewTitle("");
  };

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from("tasks").update({ status }).eq("id", id);
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(t => t.filter(x => x.id !== id));
  };

  const addLog = async () => {
    if (!logText.trim() || !activeWeekId) return;
    const { data } = await supabase.from("daily_logs").insert({
      week_id: activeWeekId, user_id: userId,
      day_label: todayLabel(), note: logText.trim(),
    }).select().single();
    if (data) setLogs(l => [data, ...l]);
    setLogText("");
  };

  const newWeek = async () => {
    const monday = mondayOf();
    const { data } = await supabase.from("weeks").insert({
      user_id: userId, label: weekLabel(), start_date: monday,
    }).select().single();
    if (data) { setWeeks(w => [data, ...w]); setActiveWeekId(data.id); }
  };

  const buildSummary = () => {
    const lines: string[] = ["Selamlar,", "", `Bu haftanın planları (${weeks.find(w=>w.id===activeWeekId)?.label}):`, ""];
    (["P1","P2","P3"] as Priority[]).forEach(p => {
      tasks.filter(t => t.priority === p).forEach(t => {
        const s = t.status === "Tamamlandi" ? "TAMAMLANDI" : STATUS_LABELS[t.status];
        lines.push(`${t.priority} - ${t.title} (${s}${t.note ? " - " + t.note : ""})`);
      });
    });
    const newTasks = tasks.filter(t => t.priority === "NEW");
    if (newTasks.length) {
      lines.push("", "Hafta içi eklenen konular:");
      newTasks.forEach(t => lines.push(`YENİ - ${t.title} (${STATUS_LABELS[t.status]})`));
    }
    const incomplete = tasks.filter(t => t.status !== "Tamamlandi");
    if (incomplete.length) {
      lines.push("", "Haftaya:");
      incomplete.forEach(t => lines.push(`${t.priority} - ${t.title}`));
    }
    return lines.join("\n");
  };

  const sendToCliq = async () => {
    await fetch("/api/cliq-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: buildSummary() }),
    });
    alert("Cliq'e gönderildi!");
  };

  if (loading) return <div className="p-8 text-gray-400">Yükleniyor...</div>;

  const activeWeek = weeks.find(w => w.id === activeWeekId);
  const done = tasks.filter(t => t.status === "Tamamlandi").length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium">Haftalık Plan</h1>
          <p className="text-sm text-gray-500">{activeWeek?.label}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/team")}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            Ekip Görünümü
          </button>
          <button onClick={newWeek}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            Yeni Hafta
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400">
            Çıkış
          </button>
        </div>
      </div>

      {/* Hafta seçici */}
      {weeks.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {weeks.map((w, i) => (
            <button key={w.id} onClick={() => setActiveWeekId(w.id)}
              className={`text-xs px-3 py-1 rounded-full border transition ${w.id === activeWeekId ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50"}`}>
              {i === 0 ? "Bu hafta" : w.label}
            </button>
          ))}
        </div>
      )}

      {/* Progress */}
      <div className="bg-gray-50 rounded-xl p-3 mb-5 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-600 rounded-full transition-all"
            style={{ width: `${tasks.length ? Math.round(done / tasks.length * 100) : 0}%` }} />
        </div>
        <span className="text-xs text-gray-500">{done}/{tasks.length} tamamlandı</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-100 mb-5">
        <div className="flex">
          {(["tasks","daily","summary"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-sm px-4 py-2 border-b-2 transition ${view === v ? "border-gray-900 font-medium" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {v === "tasks" ? "Görevler" : v === "daily" ? "Günlük Log" : "Cuma Özeti"}
            </button>
          ))}
        </div>
      </div>

      {/* GÖREVLER */}
      {view === "tasks" && (
        <div>
          {(["P1","P2","P3","NEW"] as Priority[]).map(p => {
            const cfg = PRIORITY_CFG[p];
            const pts = tasks.filter(t => t.priority === p);
            return (
              <div key={p} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.color} ${cfg.bg}`}>{p}</span>
                  <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                </div>
                {pts.length === 0 && <p className="text-xs text-gray-300 italic pl-1">Henüz görev yok</p>}
                {pts.map(t => (
                  <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${t.status === "Tamamlandi" ? "line-through text-gray-300" : ""}`}>{t.title}</p>
                      {t.note && <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>}
                    </div>
                    <select value={t.status} onChange={e => updateStatus(t.id, e.target.value as Status)}
                      className="text-xs border border-gray-100 rounded-lg px-2 py-1 bg-gray-50 outline-none">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={() => deleteTask(t.id)} className="text-gray-200 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Görev ekle */}
          <div className="flex gap-2 mt-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="Yeni görev ekle..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
              className="border border-gray-200 rounded-lg px-2 text-sm outline-none">
              <option>P1</option><option>P2</option><option>P3</option><option value="NEW">Yeni</option>
            </select>
            <button onClick={addTask} className="bg-gray-900 text-white rounded-lg px-4 text-sm hover:bg-gray-700">Ekle</button>
          </div>
        </div>
      )}

      {/* GÜNLÜK LOG */}
      {view === "daily" && (
        <div>
          <div className="flex gap-2 mb-5">
            <textarea value={logText} onChange={e => setLogText(e.target.value)}
              placeholder="Bugün ne yaptın? Yarın ne planlıyorsun?..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none h-20" />
            <button onClick={addLog} className="bg-gray-900 text-white rounded-xl px-4 text-sm hover:bg-gray-700 self-end pb-2.5 pt-2.5">Kaydet</button>
          </div>
          {logs.length === 0 && <p className="text-sm text-gray-300 italic">Henüz log yok</p>}
          {logs.map(log => (
            <div key={log.id} className="border-l-2 border-gray-200 pl-4 mb-5">
              <p className="text-xs font-medium text-gray-400 mb-1">{log.day_label}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{log.note}</p>
            </div>
          ))}
        </div>
      )}

      {/* CUMA ÖZETİ */}
      {view === "summary" && (
        <div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 mb-4 font-mono">
            {buildSummary()}
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigator.clipboard.writeText(buildSummary())}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm hover:bg-gray-50">
              Kopyala
            </button>
            <button onClick={sendToCliq}
              className="flex-1 bg-gray-900 text-white rounded-xl py-2.5 text-sm hover:bg-gray-700">
              Cliq'e Gönder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}