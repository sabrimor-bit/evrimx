async function getValidToken(): Promise<string> {
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
  console.log("Token refresh:", data.access_token ? "OK" : JSON.stringify(data));
  return data.access_token;
}

export async function sendToCliq(message: string): Promise<boolean> {
  try {
    const token = await getValidToken();
    const res = await fetch(
      `https://cliq.zoho.com/api/v2/bots/haftalkplan/message`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      }
    );
    const data = await res.json();
    console.log("Cliq response:", res.status, JSON.stringify(data));
    return res.ok;
  } catch(e) {
    console.error("Cliq error:", e);
    return false;
  }
}