"use client";
import { createClient } from "@/lib/supabase";
import { DailyLog, Priority, Status, Task, Week } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIORITY_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  P1: { label: "Kesinlikle bitir",   dot: "bg-red-500",     badge: "bg-red-950 text-red-300 border-red-800"         },
  P2: { label: "Önemli ilerleme",    dot: "bg-amber-400",   badge: "bg-amber-950 text-amber-300 border-amber-800"   },
  P3: { label: "Yaparsan iyi olur",  dot: "bg-emerald-500", badge: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  NEW:{ label: "Yeni / Beklenmedik", dot: "bg-indigo-400",  badge: "bg-indigo-950 text-indigo-300 border-indigo-800" },
};

const STATUS_CFG: Record<Status, { label: string; cls: string }> = {
  Baslamadi:      { label: "Başlamadı",    cls: "bg-gray-800 text-gray-400"      },
  "Devam Ediyor": { label: "Devam Ediyor", cls: "bg-indigo-950 text-indigo-300"  },
  Tamamlandi:     { label: "Tamamlandı",   cls: "bg-emerald-950 text-emerald-300"},
  Bloke:          { label: "Bloke",        cls: "bg-red-950 text-red-300"        },
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
  const [newIsNew, setNewIsNew] = useState(false);
  const [logText, setLogText] = useState("");
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLTextAreaElement>(null);

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

  // Textarea otomatik büyüme
  const handleLogChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLogText(e.target.value);
    if (logRef.current) {
      logRef.current.style.height = "auto";
      logRef.current.style.height = logRef.current.scrollHeight + "px";
    }
  };

  const addTask = async () => {
    if (!newTitle.trim() || !activeWeekId) return;
    // YENİ işaretliyse öncelik ne olursa olsun note'a [YENİ] ekle
    // Sadece YENİ işaretli ama öncelik seçilmemişse priority = NEW
    // YENİ + öncelik seçilmişse priority = seçilen, note = [YENİ]
    const priority = newIsNew && newPriority === "P1" && !newPriority ? "NEW" : newPriority;
    const note = newIsNew ? "[YENİ]" : "";
    const finalPriority = newIsNew && newPriority ? newPriority : (newIsNew ? "NEW" : newPriority);

    const { data } = await supabase.from("tasks").insert({
      week_id: activeWeekId, user_id: userId,
      title: newTitle.trim(), priority: finalPriority, status: "Baslamadi", note,
    }).select().single();
    if (data) setTasks(t => [...t, data]);
    setNewTitle("");
    setNewIsNew(false);
  };

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from("tasks").update({ status }).eq("id", id);
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
  };

  const updatePriority = async (id: string, priority: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    // Öncelik atanınca YENİ etiketini note'a ekle, priority'yi güncelle
    const note = task.note?.includes("[YENİ]") ? task.note : (task.note ? task.note + " [YENİ]" : "[YENİ]");
    await supabase.from("tasks").update({ priority, note }).eq("id", id);
    setTasks(t => t.map(x => x.id === id ? { ...x, priority: priority as Priority, note } : x));
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
    if (logRef.current) logRef.current.style.height = "96px";
  };

  const newWeek = async () => {
    const { data } = await supabase.from("weeks").insert({
      user_id: userId, label: weekLabel(), start_date: mondayOf(),
    }).select().single();
    if (data) { setWeeks(w => [data, ...w]); setActiveWeekId(data.id); }
  };

  // Devir: NEW görevler seçilen önceliğe taşınır
  const carryOver = async () => {
    if (!activeWeekId) return;
    const incomplete = tasks.filter(t => t.status !== "Tamamlandi");
    const { data: newWeekData } = await supabase.from("weeks").insert({
      user_id: userId, label: weekLabel(), start_date: mondayOf(),
    }).select().single();
    if (!newWeekData) return;

    for (const t of incomplete) {
      // YENİ etiketini kaldır, öncelik atanmamışsa P3 yap
      const cleanNote = (t.note || "").replace("[YENİ]","").trim();
      const priority = t.priority === "NEW" ? "P3" : t.priority;
      await supabase.from("tasks").insert({
        week_id: newWeekData.id,
        user_id: userId,
        title: t.title,
        priority,
        status: "Baslamadi",
        note: cleanNote ? `[Devir] ${cleanNote}` : "[Devir]",
      });
    }
    setWeeks(w => [newWeekData, ...w]);
    setActiveWeekId(newWeekData.id);
    setTasks([]);
  };

  const buildSummary = () => {
    const lines: string[] = ["Selamlar,", "", `Bu haftanın planları (${weeks.find(w => w.id === activeWeekId)?.label}):`, ""];

    // Planlı görevler (NEW olmayanlar)
    (["P1","P2","P3"] as Priority[]).forEach(p => {
      tasks.filter(t => t.priority === p && !t.note?.includes("[YENİ]")).forEach(t => {
        const s = t.status === "Tamamlandi" ? "TAMAMLANDI" : STATUS_CFG[t.status].label;
        lines.push(`${t.priority} - ${t.title} (${s}${t.note ? " - " + t.note : ""})`);
      });
    });

    // Hafta içi eklenen NEW görevler — durum bilgisiyle
    const newT = tasks.filter(t => t.priority === "NEW");
    // Ayrıca öncelik atanmış ama YENİ etiketli görevler
    const newTagged = tasks.filter(t => t.priority !== "NEW" && t.note?.includes("[YENİ]"));
    const allNew = [...newT, ...newTagged];

    if (allNew.length) {
      lines.push("", "Hafta içi eklenen:");
      allNew.forEach(t => {
        const s = t.status === "Tamamlandi" ? "TAMAMLANDI" : STATUS_CFG[t.status].label;
        lines.push(`YENİ - ${t.title} (${s})`);
      });
    }

    // Haftaya: tamamlanmamışlar — NEW olanlar artık öncelik ile listelenir
    const incomplete = tasks.filter(t => t.status !== "Tamamlandi");
    if (incomplete.length) {
      lines.push("", "Haftaya:");
      (["P1","P2","P3"] as Priority[]).forEach(p => {
        // Normal görevler
        incomplete.filter(t => t.priority === p && !t.note?.includes("[YENİ]")).forEach(t => {
          lines.push(`${p} - ${t.title}`);
        });
        // YENİ etiketliler ama bu öncelikte olanlar
        incomplete.filter(t => t.priority === p && t.note?.includes("[YENİ]")).forEach(t => {
          lines.push(`${p} - ${t.title}`);
        });
      });
      // Öncelik atanmamış NEW'ler
      incomplete.filter(t => t.priority === "NEW").forEach(t => {
        lines.push(`NEW - ${t.title}`);
      });
    }

    return lines.join("\n");
  };

  const sendToCliq = async (message: string) => {
    await fetch("/api/cliq-notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    alert("Cliq'e gönderildi!");
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
      Yükleniyor...
    </div>
  );

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
            <button onClick={carryOver} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">Devret + Yeni Hafta</button>
            <button onClick={newWeek} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">Boş Yeni Hafta</button>
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
          <div className="flex gap-3 items-center">
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
            {(["P1","P2","P3","NEW"]).map(p => {
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
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${t.status === "Tamamlandi" ? "line-through text-gray-600" : "text-gray-100"}`}>{t.title}</p>
                            {t.note?.includes("[YENİ]") && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">YENİ</span>
                            )}
                          </div>
                          {t.note && !t.note.includes("[YENİ]") && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                          {t.note?.includes("[YENİ]") && t.note.replace("[YENİ]","").trim() && (
                            <p className="text-xs text-gray-500 mt-0.5">{t.note.replace("[YENİ]","").trim()}</p>
                          )}
                        </div>
                        {/* NEW görevler için öncelik değiştirme */}
                        {t.priority === "NEW" && (
                          <select value={t.priority} onChange={e => updatePriority(t.id, e.target.value)}
                            className="text-xs px-2 py-1 rounded-lg border-0 outline-none cursor-pointer bg-indigo-950 text-indigo-300">
                            <option value="NEW">YENİ</option>
                            <option value="P1">P1</option>
                            <option value="P2">P2</option>
                            <option value="P3">P3</option>
                          </select>
                        )}
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

            {/* Görev ekle */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-4">
              <div className="flex gap-2 mb-3">
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="Yeni görev ekle..."
                  className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none transition" />
                <button onClick={addTask} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-5 text-sm font-medium transition">Ekle</button>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-2">
                  {(["P1","P2","P3"] as Priority[]).map(p => (
                    <button key={p} onClick={() => setNewPriority(p)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${newPriority === p ? PRIORITY_CFG[p].badge : "border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                      {p}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer ml-2">
                  <input type="checkbox" checked={newIsNew} onChange={e => setNewIsNew(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500" />
                  <span className="text-xs text-gray-400">Hafta içi eklenen (YENİ)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* GÜNLÜK LOG */}
        {view === "daily" && (
          <div>
            <div className="mb-6">
              <textarea
                ref={logRef}
                value={logText}
                onChange={handleLogChange}
                placeholder="Bugün ne yaptın? Yarın ne planlıyorsun?..."
                className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none resize-none transition overflow-hidden"
                style={{ minHeight: "96px" }}
              />
              <div className="flex gap-3 mt-3">
                <button onClick={addLog}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition">
                  Kaydet
                </button>
                <button onClick={() => sendToCliq(logText)}
                  className="border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-200 rounded-xl px-5 py-2.5 text-sm transition">
                  Cliq'e Gönder
                </button>
              </div>
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
              <button onClick={() => sendToCliq(buildSummary())}
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