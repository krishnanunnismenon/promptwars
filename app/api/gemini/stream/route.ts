import { streamGenerate, type GeminiContent } from "@/lib/server/gemini";
import { DEFAULT_SYSTEM_PROMPT, type ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function toContents(messages: ChatTurn[]): GeminiContent[] {
  return messages
    .filter((m) => m.role !== "system" && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
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

  const contents = toContents(messages);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wroteAnything = false;
      try {
        // Hard ceiling on reply length — the call is meant to be short, and a
        // long reply is a long wait before the user can speak.
        for await (const delta of streamGenerate({
          contents,
          systemPrompt,
          temperature: 0.85,
          maxOutputTokens: 150,
        })) {
          controller.enqueue(encoder.encode(delta));
          wroteAnything = true;
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
