# 🛡️ Code Quality & Architecture Specification

> **Still Here (Anchor)** — System Architecture, Strict API Validation, and Quality Engineering Guidelines.

---

## 📐 1. Architectural Principles

This application follows a strict modular Next.js App Router architecture optimized for ultra-low latency audio processing, high reliability, and strict runtime type safety.

### System Boundaries
- **Client Components (`/app`, `/components`)**: Render interactive state, manage Web Audio API streaming hooks (`lib/callEngine.ts`), and handle offline storage fallback (`lib/storage.ts`).
- **Server API Routes (`/app/api`)**: Handle Gemini API orchestration, schema validation, zero-shot multimodal image handling, and structured JSON parsing.
- **Validation Engine (`/lib/schemas.ts`)**: Serves as the single source of truth for runtime API request payloads using **Zod**.

---

## 🔒 2. Strict API Schema Validation & Error Contracts

All server API routes enforce strict runtime schema validation via **Zod**.

### Standard Validation Flow
```ts
import { GeminiRequestBodySchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const rawBody = await request.json();
  const result = GeminiRequestBodySchema.safeParse(rawBody);
  
  if (!result.success) {
    return NextResponse.json({
      error: "Schema validation failed",
      issues: result.error.issues,
    }, { status: 400 });
  }
  
  // Executed with guaranteed type safety:
  const body = result.data;
}
```

### Registered Schemas (`lib/schemas.ts`)
1. **`UserProfileSchema`**: Validates user recovery goals, losses, voice note transcripts, and caregiver metadata.
2. **`GeminiRequestBodySchema`**: Enforces array structure for chat turns (`user`, `assistant`, `system`), system prompts (max 10,000 chars), base64 image data, and Gemini model targets.
3. **`PersonaRequestBodySchema`**: Validates input data for Gemini persona builder generation.
4. **`CaregiverRequestBodySchema`**: Enforces strict typing on outcome tracking (`calmed` | `escalated`) and clean-day counts.

---

## 🧪 3. Quality Assurance & Automated Testing Standards

### Test Suite Execution
```bash
# Run unit & integration test suite
npm run test

# Run tests in watch mode
npm run test:watch
```

### Coverage Guidelines
- **Schema Contracts**: Every API schema must have corresponding test specs verifying valid and invalid payload cases in `test/schemas.test.ts`.
- **Component Integrity**: Interactive UI components must pass React Testing Library accessibility checks in `test/helplines.test.tsx`.
- **Logic & State**: Core helper functions must be covered by isolated tests in `test/types.test.ts` and `test/persona.test.ts`.

---

## ♿ 4. Accessibility Compliance (WCAG 2.1 AA)

- **Screen-Reader Announcements**: Real-time AI voice streaming transcripts are bound to `aria-live="polite"` and `aria-atomic="true"` containers.
- **Landmark Structure**: All pages enforce semantic HTML5 tags (`<main>`, `<header>`, `<section>`, `<nav>`).
- **Accessible Touch & Focus**: Interactive buttons enforce minimum `44px x 44px` touch targets and visible focus indicators (`focus-visible:ring-2`).

---

## 🛡️ 5. Security & Data Privacy Protocols

- **Environment Isolation**: API keys (`GEMINI_API_KEY`, `GOOGLE_API_KEY`) are kept exclusively in server-side process environments and never exposed to client-side bundles.
- **In-Memory Graceful Fallback**: If network interruptions or rate limits occur during crisis calls, the engine returns a deterministic, warm in-character response without throwing unhandled exceptions.
