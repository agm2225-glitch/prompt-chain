// Small adapter for Anthropic, OpenAI and Gemini.
export type LlmImage = { mediaType: string; base64: string };
export type Provider = "anthropic" | "openai" | "gemini";

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-2.5-flash",
};

export function normalizeProvider(name?: string | null): Provider | null {
  const n = (name || "").toLowerCase();
  if (n.includes("anthropic") || n.includes("claude")) return "anthropic";
  if (n.includes("openai") || n.includes("gpt")) return "openai";
  if (n.includes("google") || n.includes("gemini")) return "gemini";
  return null;
}

export function defaultProvider(): Provider {
  return normalizeProvider(process.env.LLM_PROVIDER) ?? "anthropic";
}

export function defaultModel(p: Provider) {
  return (p === defaultProvider() && process.env.LLM_MODEL) || DEFAULT_MODEL[p];
}

function keyFor(p: Provider): string {
  const specific = process.env[`${p.toUpperCase()}_API_KEY`];
  const key = specific || (p === defaultProvider() ? process.env.LLM_API_KEY : undefined);
  if (!key) throw new Error(`No API key for ${p}. Set ${p.toUpperCase()}_API_KEY (or LLM_API_KEY with LLM_PROVIDER=${p}).`);
  return key;
}

type Opts = {
  provider: Provider;
  model: string;
  system: string;
  user: string;
  image?: LlmImage | null;
  temperature?: number | null;
};

export async function callLlm(opts: Opts): Promise<string> {
  let current = opts;
  const delays = [2000, 5000, 10000]; // wait times before retries 1, 2, 3
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Some newer models reject a custom temperature; retry once without it.
      if (current.temperature != null && /temperature/i.test(msg)) {
        current = { ...current, temperature: null };
        continue;
      }
      // Temporary overload or rate limit: wait and try again.
      const busy = /high demand|overloaded|unavailable|rate limit|try again|\b(429|503|529)\b/i.test(msg);
      if (busy && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      throw e;
    }
  }
}

async function callOnce({ provider, model, system, user, image, temperature }: Opts): Promise<string> {
  const key = keyFor(provider);
  const userText = user || "(no text input)";

  if (provider === "anthropic") {
    const content: unknown[] = [];
    if (image)
      content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } });
    content.push({ type: "text", text: userText });
    const body: Record<string, unknown> = { model, max_tokens: 2000, messages: [{ role: "user", content }] };
    if (system) body.system = system;
    if (temperature != null) body.temperature = Math.min(1, Math.max(0, temperature));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `Anthropic error ${res.status}`);
    return (json.content as { type: string; text?: string }[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  if (provider === "openai") {
    const content: unknown[] = [{ type: "text", text: userText }];
    if (image) content.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } });
    const messages: unknown[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content });
    const body: Record<string, unknown> = { model, messages };
    if (temperature != null) body.temperature = temperature;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `OpenAI error ${res.status}`);
    return json.choices[0].message.content ?? "";
  }

  const parts: unknown[] = [{ text: userText }];
  if (image) parts.push({ inline_data: { mime_type: image.mediaType, data: image.base64 } });
  const body: Record<string, unknown> = { contents: [{ role: "user", parts }] };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (temperature != null) body.generationConfig = { temperature };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Gemini error ${res.status}`);
  return (json.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
}
