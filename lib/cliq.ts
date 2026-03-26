
// ============================================================
// lib/cliq.ts  —  Cliq mesaj gönderme yardımcısı
// ============================================================

async function getValidToken(): Promise<string> {
  let token = process.env.CLIQ_ACCESS_TOKEN!;

  // Token'ı test et
  const test = await fetch(`https://cliq.zoho.com/company/717535685/api/v2/channelsbyname/${process.env.CLIQ_CHANNEL}/message`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" }),
  });

  if (test.status !== 401) return token;

  // Token süresi dolmuş, refresh et
  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.CLIQ_CLIENT_ID!,
      client_secret: process.env.CLIQ_CLIENT_SECRET!,
      refresh_token: process.env.CLIQ_REFRESH_TOKEN!,
    }),
  });

  const data = await res.json();
  return data.access_token;
}

export async function sendToCliq(message: string): Promise<boolean> {
  try {
    const token = await getValidToken();
    const res = await fetch(
      `https://cliq.zoho.com/company/717535685/api/v2/channelsbyname/${process.env.CLIQ_CHANNEL}/message`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}