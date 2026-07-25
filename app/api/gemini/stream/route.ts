import { DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, type ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_ID = process.env.GEMINI_MODEL || DEFAULT_MODEL;

/**
 * Streaming sibling of /api/gemini. Returns plain text deltas so the call
 * engine can speak sentence-by-sentence as they arrive.
 *
 * This endpoint never fails: if the upstream call dies, the stream carries a
 * canned in-character line instead. Someone mid-craving must never hear an
 * error, or silence.
 */
const FALLBACK_TEXT =
  "I'm here. Stay with me. We don't have to do anything for the next ten minutes " +
  "except breathe. We've stood exactly where you are. We got through it, one " +
  "minute at a time. Just keep breathing with me.";

function toContents(messages: ChatTurn[]) {
  return messages
    .filter((m) => m.role !== "system" && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  let messages: ChatTurn[] = [];
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  try {
    const body = (await request.json()) as { messages?: ChatTurn[]; systemPrompt?: string };
    messages = Array.isArray(body?.messages) ? body.messages : [];
    systemPrompt = body?.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  } catch {
    /* fall through to the canned line */
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const contents = toContents(messages);

  if (!apiKey || contents.length === 0) {
    return new Response(FALLBACK_TEXT, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Fallback": "1" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wroteAnything = false;
      try {
        const upstream = await fetch(
          `${API_BASE}/${encodeURIComponent(MODEL_ID)}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: { temperature: 0.85, maxOutputTokens: 400 },
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error("[api/gemini/stream]", upstream.status, detail.slice(0, 300));
          throw new Error(`upstream ${upstream.status}`);
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are newline-delimited; keep the trailing partial line.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[];
              };
              const text = (chunk.candidates?.[0]?.content?.parts ?? [])
                .map((p) => p.text ?? "")
                .join("");
              if (text) {
                controller.enqueue(encoder.encode(text));
                wroteAnything = true;
              }
            } catch {
              /* skip malformed frame */
            }
          }
        }
      } catch (error) {
        console.error("[api/gemini/stream] falling back:", error);
      } finally {
        if (!wroteAnything) controller.enqueue(encoder.encode(FALLBACK_TEXT));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
