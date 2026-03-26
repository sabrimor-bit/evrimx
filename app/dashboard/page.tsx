// ============================================================
// app/dashboard/page.tsx
// ============================================================
"use client";
import { createClient } from "@/lib/supabase";
import { DailyLog, Priority, Status, Task, Week } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PRIORITY_CFG: Record<Priority, { label: string; dot: string; badge: string }> = {
  P1: { label: "Kesinlikle bitir",   dot: "bg-red-500",    badge: "bg-red-950 text-red-300 border-red-800"      },
  P2: { label: "Önemli ilerleme",    dot: "bg-amber-400",  badge: "bg-amber-950 text-amber-300 border-amber-800" },
  P3: { label: "Yaparsan iyi olur",  dot: "bg-emerald-500",badge: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  NEW:{ label: "Yeni / Beklenmedik", dot: "bg-indigo-400", badge: "bg-indigo-950 text-indigo-300 border-indigo-800"  },
};

const STATUS_CFG: Record<Status, { label: string; cls: string }> = {
  Baslamadi:      { label: "Başlamadı",    cls: "bg-gray-800 text-gray-400"   },
  "Devam Ediyor": { label: "Devam Ediyor", cls: "bg-indigo-950 text-indigo-300" },
  Tamamlandi:     { label: "Tamamlandı",   cls: "bg-emerald-950 text-emerald-300" },
  Bloke:          { label: "Bloke",        cls: "bg-red-950 text-red-300"     },
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase.from("weeks").select("*").eq("user_id", userId)
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { ensureCurrentWeek(); return; }
        setWeeks(data); setActiveWeekId(data[0].id); setLoading(false);
      });
  }, [userId]);

  const ensureCurrentWeek = async () => {
    const { data } = await supabase.from("weeks").insert({
      user_id: userId, label: weekLabel(), start_date: mondayOf(),
    }).select().single();
    if (data) { setWeeks([data]); setActiveWeekId(data.id); }
    setLoading(false);
  };

  useEffect(() => {
    if (!activeWeekId) return;
    supabase.from("tasks").select("*").eq("week_id", activeWeekId).order("created_at").then(({ data }) => setTasks(data || []));
    supabase.from("daily_logs").select("*").eq("week_id", activeWeekId).order("created_at", { ascending: false }).then(({ data }) => setLogs(data || []));
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
      week_id: activeWeekId, user_id: userId, day_label: todayLabel(), note: logText.trim(),
    }).select().single();
    if (data) setLogs(l => [data, ...l]);
    setLogText("");
  };

  const newWeek = async () => {
    const { data } = await supabase.from("weeks").insert({
      user_id: userId, label: weekLabel(), start_date: mondayOf(),
    }).select().single();
    if (data) { setWeeks(w => [data, ...w]); setActiveWeekId(data.id); }
  };

  const buildSummary = () => {
    const lines: string[] = ["Selamlar,", "", `Bu haftanın planları (${weeks.find(w=>w.id===activeWeekId)?.label}):`, ""];
    (["P1","P2","P3"] as Priority[]).forEach(p => {
      tasks.filter(t => t.priority === p).forEach(t => {
        const s = t.status === "Tamamlandi" ? "TAMAMLANDI" : STATUS_CFG[t.status].label;
        lines.push(`${t.priority} - ${t.title} (${s}${t.note ? " - " + t.note : ""})`);
      });
    });
    const newT = tasks.filter(t => t.priority === "NEW");
    if (newT.length) { lines.push("", "Hafta içi eklenen:"); newT.forEach(t => lines.push(`YENİ - ${t.title}`)); }
    const incomplete = tasks.filter(t => t.status !== "Tamamlandi");
    if (incomplete.length) { lines.push("", "Haftaya:"); incomplete.forEach(t => lines.push(`${t.priority} - ${t.title}`)); }
    return lines.join("\n");
  };

  const sendToCliq = async () => {
    await fetch("/api/cliq-notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: buildSummary() }) });
    alert("Cliq'e gönderildi!");
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Yükleniyor...</div>;

  const activeWeek = weeks.find(w => w.id === activeWeekId);
  const done = tasks.filter(t => t.status === "Tamamlandi").length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Topbar */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">H</div>
            <span className="font-semibold text-white text-sm">Haftalık Plan</span>
            <span className="text-gray-600 text-xs">|</span>
            <span className="text-gray-400 text-xs">{activeWeek?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/team")} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">Ekip</button>
            <button onClick={newWeek} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">Yeni Hafta</button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push("/"))} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 transition">Çıkış</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Hafta seçici */}
        {weeks.length > 1 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {weeks.map((w, i) => (
              <button key={w.id} onClick={() => setActiveWeekId(w.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${w.id === activeWeekId ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"}`}>
                {i === 0 ? "Bu hafta" : w.label}
              </button>
            ))}
          </div>
        )}

        {/* Progress kartı */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Bu haftaki ilerleme</span>
            <span className="text-sm font-semibold text-white">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-3">
            {(["P1","P2","P3"] as Priority[]).map(p => {
              const pts = tasks.filter(t => t.priority === p);
              const pd = pts.filter(t => t.status === "Tamamlandi").length;
              const cfg = PRIORITY_CFG[p];
              return (
                <div key={p} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${cfg.badge}`}>
                  <span className="font-semibold">{p}</span>
                  <span className="opacity-70">{pd}/{pts.length}</span>
                </div>
              );
            })}
            <div className="ml-auto text-xs text-gray-500">{done}/{tasks.length} tamamlandı</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6">
          {(["tasks","daily","summary"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 text-sm py-2 rounded-lg transition font-medium ${view === v ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {v === "tasks" ? "Görevler" : v === "daily" ? "Günlük Log" : "Cuma Özeti"}
            </button>
          ))}
        </div>

        {/* GÖREVLER */}
        {view === "tasks" && (
          <div>
            {(["P1","P2","P3","NEW"] as Priority[]).map(p => {
              const cfg = PRIORITY_CFG[p];
              const pts = tasks.filter(t => t.priority === p);
              return (
                <div key={p} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${cfg.badge}`}>{p}</span>
                    <span className="text-xs text-gray-500">{cfg.label}</span>
                  </div>
                  {pts.length === 0 && <p className="text-xs text-gray-700 italic pl-4">Henüz görev yok</p>}
                  {pts.map(t => {
                    const scfg = STATUS_CFG[t.status];
                    return (
                      <div key={t.id} className="group flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3 mb-2 transition">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ${t.status === "Tamamlandi" ? "opacity-30" : ""}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${t.status === "Tamamlandi" ? "line-through text-gray-600" : "text-gray-100"}`}>{t.title}</p>
                          {t.note && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                        </div>
                        <select value={t.status} onChange={e => updateStatus(t.id, e.target.value as Status)}
                          className={`text-xs px-2.5 py-1 rounded-lg border-0 outline-none cursor-pointer ${scfg.cls}`}>
                          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition">✕</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="flex gap-2 mt-4">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Yeni görev ekle..."
                className="flex-1 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition" />
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
                className="bg-gray-900 border border-gray-700 rounded-xl px-3 text-sm text-gray-300 outline-none">
                <option>P1</option><option>P2</option><option>P3</option><option value="NEW">Yeni</option>
              </select>
              <button onClick={addTask} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 text-sm font-medium transition">Ekle</button>
            </div>
          </div>
        )}

        {/* GÜNLÜK LOG */}
        {view === "daily" && (
          <div>
            <div className="flex gap-3 mb-6">
              <textarea value={logText} onChange={e => setLogText(e.target.value)}
                placeholder="Bugün ne yaptın? Yarın ne planlıyorsun?..."
                className="flex-1 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none resize-none h-24 transition" />
              <button onClick={addLog} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 text-sm font-medium self-end py-3 transition">Kaydet</button>
            </div>
            {logs.length === 0 && <p className="text-sm text-gray-700 italic">Henüz log yok</p>}
            {logs.map(log => (
              <div key={log.id} className="border-l-2 border-indigo-800 pl-4 mb-6">
                <p className="text-xs font-semibold text-indigo-400 mb-1.5">{log.day_label}</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{log.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* CUMA ÖZETİ */}
        {view === "summary" && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{buildSummary()}</pre>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigator.clipboard.writeText(buildSummary())}
                className="flex-1 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-200 rounded-xl py-3 text-sm transition">
                Kopyala
              </button>
              <button onClick={sendToCliq}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium transition">
                Cliq'e Gönder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  P1: { label: "Kesinlikle bitir",  color: "text-red-700 dark:text-red-300",    bg: "bg-red-50 dark:bg-red-950",    border: "border-red-200 dark:border-red-800"    },
  P2: { label: "Önemli ilerleme",   color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-950",  border: "border-amber-200 dark:border-amber-800"  },
  P3: { label: "Yaparsan iyi olur", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950", border: "border-emerald-200 dark:border-emerald-800" },
  NEW:{ label: "Yeni / Beklenmedik",color: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-50 dark:bg-blue-950",   border: "border-blue-200 dark:border-blue-800"   },
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Haftalık Plan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{activeWeek?.label}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/team")}
            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Ekip Görünümü
          </button>
          <button onClick={newWeek}
            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Yeni Hafta
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
            Çıkış
          </button>
        </div>
      </div>

      {/* Hafta seçici */}
      {weeks.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {weeks.map((w, i) => (
            <button key={w.id} onClick={() => setActiveWeekId(w.id)}
              className={`text-xs px-3 py-1 rounded-full border transition ${w.id === activeWeekId ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
              {i === 0 ? "Bu hafta" : w.label}
            </button>
          ))}
        </div>
      )}

      {/* Progress */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-5 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${tasks.length ? Math.round(done / tasks.length * 100) : 0}%` }} />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{done}/{tasks.length} tamamlandı</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-5">
        <div className="flex">
          {(["tasks","daily","summary"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-sm px-4 py-2 border-b-2 transition ${view === v ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
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
                <div className={`flex items-center gap-2 mb-2`}>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>{p}</span>
                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
                {pts.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-600 italic pl-1">Henüz görev yok</p>}
                {pts.map(t => (
                  <div key={t.id} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 mb-2 hover:border-gray-300 dark:hover:border-gray-600 transition">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${t.status === "Tamamlandi" ? "line-through text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-gray-100"}`}>{t.title}</p>
                      {t.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.note}</p>}
                    </div>
                    <select value={t.status} onChange={e => updateStatus(t.id, e.target.value as Status)}
                      className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={() => deleteTask(t.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-400 text-xs">✕</button>
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
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 text-sm outline-none bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              <option>P1</option><option>P2</option><option>P3</option><option value="NEW">Yeni</option>
            </select>
            <button onClick={addTask} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 text-sm transition">Ekle</button>
          </div>
        </div>
      )}

      {/* GÜNLÜK LOG */}
      {view === "daily" && (
        <div>
          <div className="flex gap-2 mb-5">
            <textarea value={logText} onChange={e => setLogText(e.target.value)}
              placeholder="Bugün ne yaptın? Yarın ne planlıyorsun?..."
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 resize-none h-20 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
            <button onClick={addLog} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 text-sm self-end pb-2.5 pt-2.5 transition">Kaydet</button>
          </div>
          {logs.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-600 italic">Henüz log yok</p>}
          {logs.map(log => (
            <div key={log.id} className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-4 mb-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{log.day_label}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{log.note}</p>
            </div>
          ))}
        </div>
      )}

      {/* CUMA ÖZETİ */}
      {view === "summary" && (
        <div>
          <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-100 mb-4 font-mono border border-gray-700">
            {buildSummary()}
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigator.clipboard.writeText(buildSummary())}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition">
              Kopyala
            </button>
            <button onClick={sendToCliq}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition">
              Cliq'e Gönder
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}