// ============================================================
// lib/types.ts
// ============================================================
export type Priority = "P1" | "P2" | "P3" | "NEW";
export type Status = "Baslamadi" | "Devam Ediyor" | "Tamamlandi" | "Bloke";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export interface Week {
  id: string;
  user_id: string;
  label: string;
  start_date: string;
  created_at: string;
  profile?: Profile;
}

export interface Task {
  id: string;
  week_id: string;
  user_id: string;
  title: string;
  priority: Priority;
  status: Status;
  note: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  week_id: string;
  user_id: string;
  day_label: string;
  note: string;
  created_at: string;
}

export interface WeekWithData extends Week {
  tasks: Task[];
  daily_logs: DailyLog[];
}


// ============================================================
// lib/supabase.ts  —  browser tarafı client
// ============================================================
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}


// ============================================================
// lib/supabase-server.ts  —  server tarafı client (API routes için)
// ============================================================
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}