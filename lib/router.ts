import { rankModels, recordModelOutcome, validateStageOutput, isVisionModel } from "@/lib/routing-policy";
import type { RankedModel } from "@/lib/routing-policy";
import type { AgentArtifact, AgentStage, RouteDecision, RouteMode, RouteResponse, TaskKind } from "@/lib/types";

/* ─── Provider Configuration ────────────────────────────────────────────── */

const featherlessBaseUrl = process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1";
const inventoryCacheTtlMs = 5 * 60 * 1000;

let modelInventoryCache: { models: string[]; expiresAt: number } | null = null;

/**
 * Fallback models used when the Featherless inventory API is unreachable.
 * All IDs must be valid on the Featherless platform.
 */
const fallbackModels = [
  "Qwen/Qwen2.5-Coder-32B-Instruct",
  "Qwen/Qwen3-VL-30B-A3B-Instruct",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
  "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
  "meta-llama/Llama-3.3-70B-Instruct",
  "Qwen/Qwen3-32B",
];

/* ─── Stage Prompts ─────────────────────────────────────────────────────── */

const stageMetadata: Record<AgentStage, { label: string; prompt: string; refinePrompt?: string }> = {
  plan: {
    label: "Architecture",
    prompt: "Create a concise implementation plan using headings or numbered steps. Identify files, decisions, and edge cases. Do not write final code.",
    refinePrompt: "The user wants to refine an existing codebase. Create a concise plan for the requested changes. Identify which files need modification, what to add/remove, and edge cases. Do not write final code.",
  },
  build: {
    label: "Implementation",
    prompt: "Return COMPLETE, production-ready, fully functional implementation code in fenced code blocks. Start every code block with a file marker: // file: path/to/file.ts for TypeScript, /* file: styles.css */ for CSS, or <!-- file: index.html --> for HTML. MANDATORY QUALITY RULES: 1. STUNNING MODERN VISUAL DESIGN: Create vibrant dark-mode or glassmorphism UI designs with Google Fonts (Inter/Outfit), rich CSS gradients, flexbox/grid layouts, and smooth micro-animations. 2. REAL HIGH-RES IMAGES: For restaurant/food/landing pages, use real high-resolution Unsplash image URLs (e.g. https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600 for burgers, https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600 for pizza). NEVER use grey placeholders or broken image boxes. 3. HIGH-CONTRAST TEXT: High contrast white/gold/cyan text on dark containers. 4. NO DUPLICATE CODE: Never repeat <!DOCTYPE html> or code markers inside a single response. Output each file exactly ONCE. 5. 100% BUG-FREE JS: Complete, working interactive logic with zero prose text inside code blocks.",
    refinePrompt: "The user wants to refine their existing codebase. Output ONLY the files that need changes with their COMPLETE, fully implemented updated content in fenced code blocks. Start every code block with a file marker: // file: path/to/file.ts. Enforce stunning dark-mode CSS aesthetics, real Unsplash image URLs, and 100% bug-free JavaScript. Never truncate code. Output each file exactly ONCE.",
  },
  review: {
    label: "Review",
    prompt: "Review the proposed implementation for correctness, security, and missed edge cases. Return prioritized, actionable fixes and tests.",
  },
};

/* ─── Task Classification & Helpers ─────────────────────────────────────── */

function frameworkGuidance(task: string) {
  const t = task.toLowerCase();
  if (/\bnext(?:\.js|js)?\b|app router|pages router/.test(t))
    return "The requested framework is Next.js. Produce a complete Next.js App Router component file (app/page.tsx). Include all UI sections, subcomponents, icons, and Tailwind CSS classes in complete, un-truncated TSX code so it renders instantly both in Next.js CLI and in the live browser preview iframe.";
  if (/\breact\b|\bvite\b/.test(t))
    return "The requested library is React. Produce component and style files for a React TypeScript project.";
  if (/\bvue\b|\bsvelte\b|\bangular\b/.test(t))
    return "The user specified a target framework. Produce code specifically targeting that framework.";
  if (/\bpython\b|\bflask\b|\bfastapi\b|\bdjango\b/.test(t))
    return "The requested language/framework is Python. Produce clean, modular Python scripts.";
  return "Unless the user explicitly specifies a framework (like Next.js or React), default to producing an efficient, modular HTML/CSS/JS base web application (index.html, styles.css, script.js) for maximum performance and instant browser previewability.";
}

function classifyTask(task: string): TaskKind {
  const t = task.toLowerCase();
  if (/bug|fix|error|broken|crash|debug|failing/.test(t)) return "debugging";
  if (/review|audit|inspect|security review/.test(t)) return "review";
  if (/explain|why|teach|walk me through/.test(t)) return "explanation";
  if (/add|build|create|implement|refactor|feature/.test(t)) return "implementation";
  return "general";
}

function stagesForMode(mode: RouteMode): AgentStage[] {
  return mode === "fast" ? ["plan", "build"] : ["plan", "build", "review"];
}

function getFeatherlessKey() {
  const key = process.env.FEATHERLESS_API_KEY ?? process.env.FEATHERLESS_API;
  return key ? key.trim() : undefined;
}

function getGeminiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim();
  return raw && raw.length > 10 ? raw : null;
}

/* ─── Model Inventory (Featherless) ─────────────────────────────────────── */

async function getModelInventory(apiKey: string): Promise<string[]> {
  if (modelInventoryCache && modelInventoryCache.expiresAt > Date.now()) return modelInventoryCache.models;

  try {
    const response = await fetch(`${featherlessBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Could not load model inventory.");

    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const models = payload.data?.map((m) => m.id).filter((id): id is string => Boolean(id)) ?? [];
    if (models.length === 0) throw new Error("No models were returned.");

    modelInventoryCache = { models, expiresAt: Date.now() + inventoryCacheTtlMs };
    return models;
  } catch {
    return fallbackModels;
  }
}

/* ─── Gemini Router Brain ───────────────────────────────────────────────── */
/*
 * Architecture:
 *   Gemini (Google)  →  Intelligent routing brain. Analyzes each coding task
 *                       and picks the optimal open-source model per stage.
 *   Featherless API  →  Open-source model execution engine. Runs the model
 *                       selected by Gemini to produce the actual code output.
 *
 * When GEMINI_API_KEY is set, every stage gets a Gemini routing call (~1-2s)
 * that intelligently picks the best model. When unavailable, falls back to
 * the deterministic heuristic scoring engine in routing-policy.ts.
 */

const GEMINI_ROUTER_MODEL = "gemini-2.5-flash";

async function geminiSelectModel({
  task,
  stage,
  mode,
  candidates,
  taskKind,
}: {
  task: string;
  stage: AgentStage;
  mode: RouteMode;
  candidates: RankedModel[];
  taskKind: string;
}): Promise<{ model: string; reason: string } | null> {
  const geminiKey = getGeminiKey();
  if (!geminiKey || candidates.length === 0) return null;

  const topPool = candidates.slice(0, 15);
  const modelList = topPool
    .map((c, i) => `${i + 1}. ${c.model} (heuristic: ${c.score}/100, signals: ${c.signals.slice(0, 3).join(", ")})`)
    .join("\n");

  const stageGuide: Record<AgentStage, string> = {
    plan: "ARCHITECTURE stage: Pick models with strong reasoning, multi-step planning, and vision capabilities (e.g. VL models for image prompts). Reasoning models and large general models excel here.",
    build: "IMPLEMENTATION stage: Pick the strongest CODE GENERATION specialist. Models with 'Coder' in their name (Qwen2.5-Coder, Codestral) or code-specialized training are STRONGLY preferred over general chat models. Code quality matters most.",
    review: "REVIEW stage: Pick models good at critical analysis, bug detection, security auditing, and producing actionable feedback. General instruct models with strong reasoning work well.",
  };

  const modeGuide: Record<RouteMode, string> = {
    fast: "FAST mode: Favor smaller, lower-latency models (7B-14B) for quick turnaround.",
    balanced: "BALANCED mode: Favor mid-range models (24B-32B) that balance speed and quality.",
    quality: "QUALITY mode: Favor the most capable, largest models (32B-70B+) for maximum output quality. Latency is secondary.",
  };

  const prompt = `You are the intelligent routing brain of FeatherRouter. Your sole job: given a coding task, its current pipeline stage, and a list of available open-source models, select the SINGLE BEST model.

## Coding Task
"${task.slice(0, 600)}"

## Current Stage: ${stage.toUpperCase()} — ${stageMetadata[stage].label}
${stageGuide[stage]}

## Pipeline Mode: ${mode.toUpperCase()}
${modeGuide[mode]}

## Task Classification: ${taskKind}

## Available Open-Source Models (Featherless API)
${modelList}

## Decision Rules
- For IMPLEMENTATION: ALWAYS prefer code-specialized models (Coder, Codestral) over general chat models.
- For ARCHITECTURE with image inputs: Prefer vision-language models (VL models).
- For REVIEW: Prefer strong reasoning/instruct models.
- Consider model size vs mode requirements.

Respond with ONLY a JSON object. No markdown fences. No explanation outside the JSON:
{"model":"exact-model-id","reason":"one clear sentence why this model is optimal for this task and stage"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ROUTER_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 200 },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return null;

    // Strip markdown fences if model wraps output
    const clean = raw.replace(/```(?:json)?\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as { model?: string; reason?: string };

    if (!parsed.model) return null;

    // Validate that the selected model actually exists in the candidate pool
    const match = topPool.find((c) => c.model === parsed.model);
    if (!match) return null;

    return {
      model: parsed.model,
      reason: parsed.reason ?? "Selected by Gemini router intelligence",
    };
  } catch {
    // Gemini call failed — silently fall back to heuristic scoring
    return null;
  }
}

/* ─── Response Extraction ───────────────────────────────────────────────── */

function contentFromResponse(payload: unknown) {
  const candidate = payload as { choices?: Array<{ message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown } }> };
  const message = candidate.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }

  // Accept reasoning_content as a fallback (e.g. DeepSeek/Qwen reasoning models)
  const reasoning = message?.reasoning_content ?? message?.reasoning;
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning.trim();
  throw new Error("The model returned no usable completion.");
}

/* ─── Token & Timeout Budgets ───────────────────────────────────────────── */

const maxTokensByMode: Record<RouteMode, Record<AgentStage, number>> = {
  fast: { plan: 800, build: 4096, review: 800 },
  balanced: { plan: 1200, build: 6144, review: 1200 },
  quality: { plan: 1800, build: 8192, review: 1800 },
};

/* ─── Stage Execution (Featherless) ─────────────────────────────────────── */

async function runStage({ apiKey, model, stage, mode, task, context, isRefining, image }: {
  apiKey: string;
  model: string;
  stage: AgentStage;
  mode: RouteMode;
  task: string;
  context: string;
  isRefining: boolean;
  image?: string;
}) {
  const baseTimeout = stage === "build" ? 90_000 : 45_000;
  const timeoutMs = image ? 180_000 : baseTimeout;
  const maxTokens = maxTokensByMode[mode]?.[stage] ?? 4096;
  const stagePrompt = isRefining && stageMetadata[stage].refinePrompt
    ? stageMetadata[stage].refinePrompt
    : stageMetadata[stage].prompt;

  // Vision payload only during Architecture Plan stage to models that support it
  const supportsVision = Boolean(image && stage === "plan" && isVisionModel(model));

  const userContent = supportsVision
    ? [
        { type: "text", text: `Coding task (refer to attached image/wireframe):\n${task}\n\nPrior stage context:\n${context || "No prior context."}` },
        { type: "image_url", image_url: { url: image } },
      ]
    : `Coding task (refer to attached wireframe/image description):\n${task}\n\nPrior stage context:\n${context || "No prior context. Begin from the task."}`;

  const response = await fetch(`${featherlessBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: stage === "build" ? 0.2 : 0.1,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: `You are one stage in an explainable coding agent running in ${mode} mode. ${stagePrompt}\n${frameworkGuidance(task)}` },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Model request failed (${response.status}): ${body.slice(0, 180)}`);
  }

  return contentFromResponse(await response.json());
}

/* ─── Decision Reason Formatting ────────────────────────────────────────── */

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "This model could not complete the stage.";
}

function heuristicReason(signals: string[], usedFallback: boolean) {
  const summary = signals.slice(0, 3).join(" · ");
  return usedFallback ? `${summary} · recovered with a validated fallback.` : summary;
}

/* ─── Main Pipeline ─────────────────────────────────────────────────────── */

export async function runCodingAgent({ task, mode, existingCode, image }: {
  task: string;
  mode: RouteMode;
  existingCode?: string;
  image?: string;
}): Promise<RouteResponse> {
  const apiKey = getFeatherlessKey();
  if (!apiKey) throw new Error("Add FEATHERLESS_API_KEY to .env.local before routing a task.");

  const taskKind: TaskKind = image ? "vision" : classifyTask(task);
  const models = await getModelInventory(apiKey);
  const decisions: RouteDecision[] = [];
  const artifacts: AgentArtifact[] = [];
  let context = existingCode ? `Existing codebase:\n${existingCode}` : "";
  const isRefining = Boolean(existingCode);
  const hasGemini = Boolean(getGeminiKey());

  for (const stage of stagesForMode(mode)) {
    /* ── Step 1: Heuristic pre-ranking (fast, deterministic) ── */
    const rankedModels = rankModels(models, stage, mode, taskKind, Boolean(image));

    /* ── Step 2: Gemini intelligent selection (when available) ── */
    let orderedCandidates = rankedModels;
    let routedByGemini = false;
    let geminiReason = "";

    if (hasGemini) {
      const geminiPick = await geminiSelectModel({
        task, stage, mode, candidates: rankedModels, taskKind,
      });

      if (geminiPick) {
        const picked = rankedModels.find((m) => m.model === geminiPick.model);
        if (picked) {
          // Gemini's pick goes first, remaining models stay as ordered fallbacks
          orderedCandidates = [picked, ...rankedModels.filter((m) => m.model !== geminiPick.model)];
          routedByGemini = true;
          geminiReason = geminiPick.reason;
        }
      }
    }

    /* ── Step 3: Build candidate execution queue ── */
    const attemptLimit = mode === "fast" ? 2 : mode === "quality" ? 5 : 3;
    const candidates = orderedCandidates.slice(0, attemptLimit);
    const primaryCandidate = candidates[0];

    if (!primaryCandidate) {
      throw new Error("No eligible models were available for routing.");
    }

    const decision: RouteDecision = {
      stage,
      label: stageMetadata[stage].label,
      model: primaryCandidate.model,
      reason: routedByGemini
        ? `🧠 Gemini Router: ${geminiReason}`
        : heuristicReason(primaryCandidate.signals, false),
      status: "running",
      selectedScore: primaryCandidate.score,
      candidatesEvaluated: rankedModels.length,
      candidates: rankedModels.slice(0, 5).map(({ model, score, signals }) => ({ model, score, signals })),
      fallbackUsed: false,
      qualityGate: "awaiting model output",
    };
    decisions.push(decision);

    /* ── Step 4: Execute with cascading fallback ── */
    const failures: string[] = [];
    let completed = false;

    for (const [index, candidate] of candidates.entries()) {
      const startedAt = performance.now();

      try {
        const content = await runStage({ apiKey, model: candidate.model, stage, mode, task, context, isRefining, image });
        const latencyMs = Math.round(performance.now() - startedAt);
        const qualityGate = validateStageOutput(stage, content);
        recordModelOutcome({ stage, model: candidate.model, passed: qualityGate.passed, latencyMs });

        if (!qualityGate.passed) {
          failures.push(`${candidate.model}: ${qualityGate.summary}`);
          continue;
        }

        decision.model = candidate.model;
        decision.reason = routedByGemini && index === 0
          ? `🧠 Gemini Router: ${geminiReason}`
          : heuristicReason(candidate.signals, index > 0);
        decision.status = "complete";
        decision.selectedScore = candidate.score;
        decision.fallbackUsed = index > 0;
        decision.latencyMs = latencyMs;
        decision.qualityGate = qualityGate.summary;
        artifacts.push({ stage, title: stageMetadata[stage].label, content, status: "complete" });
        context = `${context}\n\n${stageMetadata[stage].label}:\n${content}`.trim();
        completed = true;
        break;
      } catch (error) {
        const latencyMs = Math.round(performance.now() - startedAt);
        recordModelOutcome({ stage, model: candidate.model, passed: false, latencyMs });
        failures.push(`${candidate.model}: ${failureMessage(error)}`);
      }
    }

    if (!completed) {
      decision.status = "failed";
      decision.qualityGate = "no candidate passed the stage quality gate";
      decision.reason = failures.join(" | ").slice(0, 420);
      artifacts.push({
        stage,
        title: stageMetadata[stage].label,
        content: "No candidate produced a response that passed this stage's quality gate.",
        status: "failed",
      });
      break;
    }
  }

  if (!artifacts.some((a) => a.status === "complete")) {
    const first = artifacts[0];
    throw new Error(`${first?.title ?? "Model request"} failed: ${first?.content ?? "Check your Featherless API key and selected plan."}`);
  }

  return {
    runId: `run_${crypto.randomUUID().slice(0, 8)}`,
    taskKind,
    decisions,
    artifacts,
    completedAt: new Date().toISOString(),
  };
}
