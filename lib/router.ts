import { rankModels, recordModelOutcome, validateStageOutput } from "@/lib/routing-policy";
import type { AgentArtifact, AgentStage, RouteDecision, RouteMode, RouteResponse, TaskKind } from "@/lib/types";

const featherlessBaseUrl = process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1";
const inventoryCacheTtlMs = 5 * 60 * 1000;

let modelInventoryCache: { models: string[]; expiresAt: number } | null = null;

const fallbackModels = [
  "Qwen/Qwen2.5-Coder-32B-Instruct",
  "Qwen/Qwen3-32B",
  "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
];

const stageMetadata: Record<AgentStage, { label: string; prompt: string; refinePrompt?: string }> = {
  plan: {
    label: "Architecture",
    prompt: "Create a concise implementation plan using headings or numbered steps. Identify files, decisions, and edge cases. Do not write final code.",
    refinePrompt: "The user wants to refine an existing codebase. Create a concise plan for the requested changes. Identify which files need modification, what to add/remove, and edge cases. Do not write final code.",
  },
  build: {
    label: "Implementation",
    prompt: "Return usable implementation code in fenced code blocks. Start every code block with a file marker: // file: path/to/file.ts for TypeScript, /* file: styles.css */ for CSS, or <!-- file: index.html --> for HTML. Keep prose under three lines, do not narrate reasoning, and use maintainable TypeScript unless the task specifies another language.",
    refinePrompt: "The user wants to refine their existing codebase. Output ONLY the files that need changes with their COMPLETE updated content in fenced code blocks. Start every code block with a file marker: // file: path/to/file.ts. Do not output unchanged files. Do not narrate reasoning.",
  },
  review: {
    label: "Review",
    prompt: "Review the proposed implementation for correctness, security, and missed edge cases. Return prioritized, actionable fixes and tests.",
  },
};

function frameworkGuidance(task: string) {
  const normalizedTask = task.toLowerCase();
  if (/\bnext(?:\.js|js)?\b|app router|pages router/.test(normalizedTask)) {
    return "The requested runtime is Next.js. Use the requested router and TypeScript source paths, produce files that fit an existing Next.js project, and never substitute static HTML for server or framework behavior.";
  }
  if (/\breact\b|\bvite\b/.test(normalizedTask)) {
    return "The requested runtime is React. Produce component and styling files that fit a React TypeScript project; do not replace the requested application with static HTML.";
  }
  if (/\bhtml\b|landing page|static site|static web/.test(normalizedTask)) {
    return "The requested runtime is a static website. Return index.html first, then separate styles.css and script.js files when needed so the canvas can run an isolated browser preview.";
  }
  return "Respect the framework, language, and runtime named in the task. If no runtime is named, choose the smallest maintainable implementation that satisfies the request.";
}

function getApiKey() {
  return process.env.FEATHERLESS_API_KEY ?? process.env.FEATHERLESS_API;
}

function classifyTask(task: string): TaskKind {
  const normalizedTask = task.toLowerCase();
  if (/bug|fix|error|broken|crash|debug|failing/.test(normalizedTask)) return "debugging";
  if (/review|audit|inspect|security review/.test(normalizedTask)) return "review";
  if (/explain|why|teach|walk me through/.test(normalizedTask)) return "explanation";
  if (/add|build|create|implement|refactor|feature/.test(normalizedTask)) return "implementation";
  return "general";
}

function stagesForMode(mode: RouteMode): AgentStage[] {
  return mode === "fast" ? ["plan", "build"] : ["plan", "build", "review"];
}

async function getModelInventory(apiKey: string) {
  if (modelInventoryCache && modelInventoryCache.expiresAt > Date.now()) return modelInventoryCache.models;

  try {
    const response = await fetch(`${featherlessBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Could not load model inventory.");

    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const models = payload.data?.map((model) => model.id).filter((id): id is string => Boolean(id)) ?? [];
    if (models.length === 0) throw new Error("No models were returned.");

    modelInventoryCache = { models, expiresAt: Date.now() + inventoryCacheTtlMs };
    return models;
  } catch {
    return fallbackModels;
  }
}

function contentFromResponse(payload: unknown, allowReasoning: boolean) {
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

  const reasoning = message?.reasoning_content ?? message?.reasoning;
  if (allowReasoning && typeof reasoning === "string" && reasoning.trim()) return reasoning.trim();
  throw new Error("The model returned no usable completion.");
}

async function runStage({ apiKey, model, stage, task, context, isRefining }: {
  apiKey: string;
  model: string;
  stage: AgentStage;
  task: string;
  context: string;
  isRefining: boolean;
}) {
  const timeoutMs = stage === "build" ? 90_000 : 45_000;
  const stagePrompt = isRefining && stageMetadata[stage].refinePrompt
    ? stageMetadata[stage].refinePrompt
    : stageMetadata[stage].prompt;
  const response = await fetch(`${featherlessBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: stage === "build" ? 0.2 : 0.1,
      max_tokens: stage === "build" ? 4096 : 1200,
      messages: [
        { role: "system", content: `You are one stage in an explainable coding agent. ${stagePrompt}\n${frameworkGuidance(task)}` },
        { role: "user", content: `Coding task:\n${task}\n\nPrior stage context:\n${context || "No prior context. Begin from the task."}` },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Model request failed (${response.status}): ${body.slice(0, 180)}`);
  }

  return contentFromResponse(await response.json(), stage !== "build");
}

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "This model could not complete the stage.";
}

function decisionReason(signals: string[], usedFallback: boolean) {
  const summary = signals.slice(0, 3).join(" · ");
  return usedFallback ? `${summary} · recovered with a validated fallback.` : summary;
}

export async function runCodingAgent({ task, mode, existingCode }: { task: string; mode: RouteMode; existingCode?: string }): Promise<RouteResponse> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Add FEATHERLESS_API to .env.local before routing a task.");

  const taskKind = classifyTask(task);
  const models = await getModelInventory(apiKey);
  const decisions: RouteDecision[] = [];
  const artifacts: AgentArtifact[] = [];
  let context = existingCode ? `Existing codebase:\n${existingCode}` : "";
  const isRefining = Boolean(existingCode);

  for (const stage of stagesForMode(mode)) {
    const rankedModels = rankModels(models, stage, mode, taskKind);
    const attemptLimit = mode === "quality" ? 3 : 2;
    const candidates = rankedModels.slice(0, attemptLimit);
    const primaryCandidate = candidates[0];

    if (!primaryCandidate) {
      throw new Error("No eligible models were available for routing.");
    }

    const decision: RouteDecision = {
      stage,
      label: stageMetadata[stage].label,
      model: primaryCandidate.model,
      reason: decisionReason(primaryCandidate.signals, false),
      status: "running",
      selectedScore: primaryCandidate.score,
      candidatesEvaluated: rankedModels.length,
      candidates: rankedModels.slice(0, 3).map(({ model, score, signals }) => ({ model, score, signals })),
      fallbackUsed: false,
      qualityGate: "awaiting model output",
    };
    decisions.push(decision);

    const failures: string[] = [];
    let completed = false;

    for (const [index, candidate] of candidates.entries()) {
      const startedAt = performance.now();

      try {
        const content = await runStage({ apiKey, model: candidate.model, stage, task, context, isRefining });
        const latencyMs = Math.round(performance.now() - startedAt);
        const qualityGate = validateStageOutput(stage, content);
        recordModelOutcome({ stage, model: candidate.model, passed: qualityGate.passed, latencyMs });

        if (!qualityGate.passed) {
          failures.push(`${candidate.model}: ${qualityGate.summary}`);
          continue;
        }

        decision.model = candidate.model;
        decision.reason = decisionReason(candidate.signals, index > 0);
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

  if (!artifacts.some((artifact) => artifact.status === "complete")) {
    const firstFailure = artifacts[0];
    throw new Error(`${firstFailure?.title ?? "Model request"} failed: ${firstFailure?.content ?? "Check your Featherless API key and selected plan."}`);
  }

  return {
    runId: `run_${crypto.randomUUID().slice(0, 8)}`,
    taskKind,
    decisions,
    artifacts,
    completedAt: new Date().toISOString(),
  };
}
