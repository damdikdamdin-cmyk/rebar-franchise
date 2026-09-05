export async function notifyTelegram(text: string, chatId?: string | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const target = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !target) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: target, text, disable_web_page_preview: true }),
    });
  } catch (error) {
    console.error("telegram notify failed", error);
  }
}
