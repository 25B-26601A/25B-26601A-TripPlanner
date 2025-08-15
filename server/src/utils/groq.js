const BASE = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

async function groqChatJSON({ messages, temperature = 0.3, max_tokens = 1800 }) {
  const key = process.env.GROQ_KEY;
  if (!key) throw new Error("Missing GROQ_KEY");

  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GROQ error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}

module.exports = { groqChatJSON };
