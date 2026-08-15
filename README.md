# FeatherRouter

**An intelligent model routing engine for multi-stage code generation.**

FeatherRouter breaks down coding tasks into specialized pipeline stages — architecture planning, code implementation, and security review — and dynamically assigns the best open-source model for each stage using Gemini as a cognitive routing layer.

Built for the [Impact Forge Hackathon 2026](https://impactforge26.devpost.com/), powered by the [Featherless API](https://featherless.ai/).

---

## How It Works

Most AI coding tools use a single model for everything. That's a problem — a model trained for code generation isn't necessarily the best at architecture planning or security auditing.

FeatherRouter solves this with a four-layer pipeline:

1. **Prompt Analysis** — Gemini analyzes the user's coding request, classifying intent, complexity, and required capabilities.
2. **Model Selection** — Based on that analysis, Gemini selects the optimal open-source model from 21,700+ models available on Featherless for each pipeline stage.
3. **Execution** — The selected models execute their specialized stages (plan → build → review) on Featherless infrastructure.
4. **Quality Review** — Gemini reviews the final generated code for common bugs (contrast issues, NaN edge cases, broken state machines) and patches them before the user sees the output.

Every routing decision is fully transparent — users can inspect the score breakdowns, model rankings, and reasoning behind each selection in real time.

---

## Features

- **Transparent routing decisions** with score breakdowns and natural-language reasoning
- **Cascading fallback queue** — if a model times out, the next-best candidate picks up automatically
- **Live web preview** for HTML/CSS/JS projects directly in the browser
- **Image-to-code** — paste a wireframe screenshot and the vision pipeline generates code from it
- **Code sanitization** — strips LLM artifacts (trailing prose, markdown fences) before rendering
- **One-click ZIP export** of the generated codebase
- **Three pipeline modes** — Fast (2 stages), Balanced (3 stages), Quality (3 stages + deeper evaluation)

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | Next.js 16, React, TypeScript |
| Router Brain | Gemini 2.5 Flash (Google AI) |
| Model Execution | Featherless API (21,700+ open models) |
| Key Models | Qwen2.5-Coder-32B, Qwen3-VL-30B, DeepSeek-R1, Mistral-Small-3.1 |
| Styling | Hand-written CSS with dark mode |

---

## Setup

```bash
git clone https://github.com/sangamgautam1111/feather-router.git
cd feather-router
npm install
```

Create `.env.local` in the project root:

```
FEATHERLESS_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
User Prompt
    │
    ▼
┌──────────────────────────┐
│  Gemini 2.5 Flash        │  ← Analyzes task, selects models
│  (Router Brain)          │
└──────────┬───────────────┘
           │
    ┌──────┼──────────────────┐
    ▼      ▼                  ▼
 Stage 1   Stage 2         Stage 3
  Plan      Build           Review
 (Qwen3)  (Qwen2.5-Coder) (Mistral)
    │      │                  │
    └──────┼──────────────────┘
           │
           ▼
┌──────────────────────────┐
│  Gemini 2.5 Flash        │  ← Reviews output, fixes bugs
│  (Quality Gate)          │
└──────────┬───────────────┘
           │
           ▼
     Final Output
```

## Technical Overview & Hard Challenges

### The Problem
Single-model LLM generation often leads to sub-optimal results: vision models excel at planning from wireframes, code specialists (like Qwen2.5-Coder) excel at implementation, and general instruct models excel at auditing. Forcing one model to handle all stages degrades overall output quality.

### Architecture & Solution
FeatherRouter uses a 4-layer orchestrator:
1. **Prompt Analysis & Routing (Gemini 2.5 Flash):** Evaluates user intent against 30 candidate models in the Featherless inventory.
2. **Specialized Execution (Featherless API):** Dispatches stage tasks to specialized open-source models with fallback queues.
3. **Canvas Sanitization & Deduplication:** Cleans code fences, strips LLM prose, and prevents duplicated script blocks.
4. **Automated Quality Review (Gemini QA):** Audits multi-file DOM IDs, CSS contrast, and JS event listener bindings before rendering.

### Technical Challenges Solved
- **Model Output Deduplication:** Resolved internal block repetitions using top-level entry point triggers.
- **Client-Side Iframe Execution:** Implemented a `DOMContentLoaded` event polyfill so preview scripts execute reliably even if loaded dynamically.
- **Vendor Model Normalization:** Built fuzzy resolution matching Featherless model IDs against raw LLM output strings.

---

## Video Demo

*Demo video link will be added here prior to submission.*

---

## License

MIT
