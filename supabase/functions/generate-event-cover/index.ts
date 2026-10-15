import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
const BRIDGE_URL = "https://ssbesxgaijknwsjbsbcz.supabase.co/functions/v1/ame-estoque-cover-ai";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const auth = req.headers.get("Authorization") || "";
    if (!url || !anon || !/^Bearer\s+\S+$/.test(auth)) return json({ error: "Sessão obrigatória" }, 401);
    const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);
    const { data: profile, error: profileError } = await db.from("staff_profiles")
      .select("active,role").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.active) return json({ error: "Usuário sem acesso" }, 403);
    if (profile.role !== "admin") {
      const { data: permissions, error: permissionError } = await db.rpc("my_permissions");
      if (permissionError || !Array.isArray(permissions) || !permissions.some((x: { permission?: string }) => x.permission === "events.manage"))
        return json({ error: "Sem permissão de eventos" }, 403);
    }
    const body = await req.json().catch(() => null);
    const eventId = typeof body?.event_id === "string" ? body.event_id : "";
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))
      return json({ error: "Loja temporária inválida" }, 400);
    const { data: event, error: eventError } = await db.from("events")
      .select("id,deleted_at").eq("id", eventId).maybeSingle();
    if (eventError || !event || event.deleted_at) return json({ error: "Loja temporária não encontrada" }, 404);

    // O backend de IA existente está em outro projeto Supabase da organização.
    // Somente o JWT do usuário é encaminhado; nenhuma chave privada é exposta.
    const upstream = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Authorization": auth, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
      signal: AbortSignal.timeout(115000),
    });
    const response = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message = typeof response?.error === "string" ? response.error : "O servidor de imagens não respondeu corretamente.";
      return json({ error: message }, upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502);
    }
    if (typeof response?.base64 !== "string" || !response.base64)
      return json({ error: "O gerador não retornou uma capa válida." }, 502);
    return json({ base64: response.base64, mime: "image/webp" });
  } catch (error) {
    console.error("generate-event-cover proxy failure", error instanceof Error ? error.name : "unknown");
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
      return json({ error: "O gerador demorou mais que o esperado. Tente novamente." }, 504);
    return json({ error: "Serviço de geração de capas temporariamente indisponível." }, 502);
  }
});
