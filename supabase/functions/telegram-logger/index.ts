import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(input: unknown, max = 1500): string {
  const s = String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function asText(input: unknown, max: number): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "string" && typeof input !== "number" && typeof input !== "boolean") return "";
  return escapeHtml(input, max);
}

const MAX_BODY_BYTES = 32 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

    // Require an authenticated app user: this endpoint relays content into an
    // internal monitoring channel, so anonymous callers must not reach it.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ") || !supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authedUserEmail = "Anônimo";
    let authedUserId = "Não autenticado";
    try {
      const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData } = await authedClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authedUserEmail = userData.user.email ?? authedUserEmail;
      authedUserId = userData.user.id ?? authedUserId;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text().catch(() => "");
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(rawBody || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appName = asText(body["app_name"], 80) || "App Desconhecido";
    const errorMessage = asText(body["error_message"], 800) || "Sem mensagem de erro";
    const stackTrace = asText(body["stack_trace"], 1200);
    const url = asText(body["url"], 250) || "N/A";
    const additionalInfo =
      body["additional_info"] && typeof body["additional_info"] === "object" && !Array.isArray(body["additional_info"])
        ? (body["additional_info"] as Record<string, unknown>)
        : {};

    // Identity always comes from the verified token, never from the request body.
    const finalEmail = escapeHtml(authedUserEmail, 100);
    const finalUserId = escapeHtml(authedUserId, 60);

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: "Telegram not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });

    let messageText = `🚨 <b>ERRO NO SISTEMA / TELA</b> 🚨\n\n`;
    messageText += `📱 <b>App:</b> ${appName}\n`;
    messageText += `🕒 <b>Hora:</b> ${escapeHtml(timestamp, 50)}\n`;
    messageText += `🔗 <b>URL:</b> <code>${url}</code>\n`;
    messageText += `👤 <b>Usuário:</b> ${finalEmail} (<code>${finalUserId}</code>)\n\n`;
    messageText += `⚠️ <b>Mensagem:</b>\n<b>${errorMessage}</b>\n\n`;

    if (stackTrace) {
      messageText += `📜 <b>Stack Trace:</b>\n<pre>${stackTrace}</pre>\n\n`;
    }

    if (Object.keys(additionalInfo).length > 0) {
      messageText += `🔍 <b>Detalhes adicionais:</b>\n<pre>${escapeHtml(
        JSON.stringify(additionalInfo, null, 2),
        800,
      )}</pre>\n`;
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const ok = response.ok;
    return new Response(JSON.stringify({ success: ok }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in telegram-logger:", err?.message);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
