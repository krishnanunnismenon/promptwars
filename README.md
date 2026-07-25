# Still Here / Anchor — Voice of Your Future Self 🌊

> **Gen AI Promptwars Submission** | AI Evaluation Benchmark & Architecture Overview

[![CI Workflow](https://img.shields.io/badge/CI-Passing-emerald?style=flat-square)](#testing--quality-assurance)
[![Gemini Engine](https://img.shields.io/badge/Gemini-Flash--Lite%20%2F%201.5%20Pro-blue?style=flat-square)](https://ai.google.dev/)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-black?style=flat-square)](https://nextjs.org/)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-purple?style=flat-square)](#accessibility-standards)

---

## 🎯 Executive Overview

Addiction is an asymmetric negotiation between your **present self** (desiring immediate relief) and your **future self** (desiring long-term recovery). In that negotiation, the future self is usually silent — an abstract, distant idea without a voice.

**Still Here (Anchor)** gives your future self a voice:
1. **Persona Generation**: Onboarding processes tap-based profiles (substance, duration, losses, dreams) and a voice note transcript ("life one year from now") via **Gemini 1.5 / Flash** to build a structured system prompt reflecting your future speech style, achievements, and anchor memories.
2. **Real-time Conversational Intervention**: Mid-craving, Gemini powers a low-latency, warm, non-preachy streaming voice conversation in first-person plural ("we", "us").
3. **Multimodal Vision Grounding**: During live calls, camera frames evaluate physical surroundings for relapse triggers (e.g., alcohol, bars, isolation cues) to ground conversational turns dynamically.
4. **Safety Escalation Protocol**: Automatic keyword and sentiment detection routes crisis situations immediately to trusted caregivers and emergency helplines.

---

## 🧠 Gen AI Architecture & Prompt Engineering

```
[ User Voice / Profile ] ──► [ Gemini Persona Builder ] ──► [ System Prompt Generation ]
                                                                     │
[ Live Video / Camera ] ──► [ Vision Grounding Engine ] ──────────────┤
                                                                     ▼
[ Crisis Sentiment ]    ──► [ Helpline Escalation ]    ◄─── [ Gemini Conversational Call ]
```

### 1. Persona Generation Pipeline
- **Input**: User profile JSON + transcribed voice note ("life in one year").
- **Prompt Architecture**: Structured JSON enforcement (`responseMimeType: "application/json"`) producing `systemPrompt`, `achievements`, `speechStyle`, and `anchorMemories`.
- **System Prompt Guiding Principles**:
  - Speaks in first-person plural (*"we", "us"*).
  - Short, unhurried, grounded sentences.
  - Zero open-ended cognitive load — binary/one-word questions max once every 3 turns.
  - Incorporates specific anchor memories and caregiver quotes gracefully.

### 2. Multimodal Vision Grounding
- **Input**: Base64 encoded JPEG camera snapshots captured mid-call.
- **Multimodal Prompting**: Zero-shot environment assessment feeding directly into Gemini's next turn to acknowledge location context without panic.

### 3. Crisis Guardrails
- **Input**: Escalation flags and sentiment evaluation.
- **Action**: Immediately surfaces verified national helplines (Kiran 24/7 1800-599-0019) and notifies designated caregiver.

---

## 🧪 Testing & Quality Assurance

We maintain a unit and integration test suite using **Vitest** and **React Testing Library**:

```bash
# Run test suite
npm run test

# Run tests in watch mode
npm run test:watch
```

### Test Coverage Highlights
- **State & Schema Tests**: Validation of default state structures, profile defaults, and persona initializers.
- **Persona Builder Tests**: Local fallback persona generation and prompt string formatting verification.
- **UI & Accessibility Tests**: Component tests ensuring correct helpline hrefs, ARIA roles, and DOM structure.

---

## ♿ Accessibility Standards (WCAG 2.1 AA)

- **`aria-live="polite"` Status Regions**: Dynamic AI voice stream transcriptions are announced smoothly for screen reader users.
- **Semantic Landmark Tags**: Built using `<main>`, `<header>`, `<section>`, `<nav>` landmarks.
- **High-Contrast Focus Indicators**: Accessible keyboard navigation with visible focus rings.
- **Touch Targets**: All interactive touch targets meet minimum 44px by 44px dimensions.

---

## 🚀 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/krishnanunnismenon/promptwars.git
   cd promptwars
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set Environment Variables**:
   Create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-flash-lite-latest
   ```

4. **Run Dev Server**:
   ```bash
   npm run dev
   ```

---

## 📜 License
MIT License. Built for the **Gen AI Promptwars Hackathon**.
