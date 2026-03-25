
// ============================================================
// app/page.tsx  —  Giriş / Kayıt sayfası (şifre ile)
// ============================================================
"use client";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError("E-posta veya şifre hatalı."); return; }
    router.push("/dashboard");
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-medium mb-1">Haftalık Plan</h1>
        <p className="text-gray-500 text-sm mb-6">
          {mode === "login" ? "Hesabına giriş yap" : "Yeni hesap oluştur"}
        </p>

        {mode === "register" && (
          <input
            type="text"
            placeholder="Adın Soyadın"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-gray-400"
          />
        )}

        <input
          type="email"
          placeholder="ad@sirket.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-gray-400"
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-gray-400"
        />

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <button
          onClick={mode === "login" ? handleLogin : handleRegister}
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
        >
          {loading ? "Bekle..." : mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
        </button>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="w-full text-gray-400 text-xs mt-4 hover:text-gray-600"
        >
          {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </div>
    </div>
  );
}