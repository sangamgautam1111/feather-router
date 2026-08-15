import type { AgentStage, CandidateComparison, RouteMode, TaskKind } from "@/lib/types";

interface ModelHealth {
  attempts: number;
  successes: number;
  totalLatencyMs: number;
  cooldownUntil: number;
}

export interface RankedModel extends CandidateComparison {
  model: string;
}

export interface QualityGateResult {
  passed: boolean;
  summary: string;
}

const healthByStage = new Map<string, ModelHealth>();

function healthKey(stage: AgentStage, model: string) {
  return `${stage}:${model}`;
}

function readHealth(stage: AgentStage, model: string): ModelHealth {
  const key = healthKey(stage, model);
  const health = healthByStage.get(key);

  if (health) return health;

  const initialHealth = { attempts: 0, successes: 0, totalLatencyMs: 0, cooldownUntil: 0 };
  healthByStage.set(key, initialHealth);
  return initialHealth;
}

function clampScore(score: number) {
  return Math.max(1, Math.min(100, Math.round(score)));
}

function has(model: string, expression: RegExp) {
  return expression.test(model.toLowerCase());
}

function stageSignals(model: string, stage: AgentStage) {
  if (stage === "plan") {
    if (has(model, /kimi|glm|deepseek|qwen3|reason/)) return { score: 42, signal: "reasoning-capable" };
    if (has(model, /coder|code/)) return { score: 23, signal: "general planning" };
    return { score: 30, signal: "general planning" };
  }

  if (stage === "build") {
    if (has(model, /codestral|coder|code/)) return { score: 48, signal: "code-specialist" };
    if (has(model, /mistral|deepseek|glm/)) return { score: 38, signal: "implementation-capable" };
    if (has(model, /qwen3|reason/)) return { score: 18, signal: "reasoning-first fallback" };
    return { score: 26, signal: "general implementation" };
  }

  if (has(model, /mistral|qwen|llama|glm|deepseek/)) return { score: 38, signal: "review-capable" };
  return { score: 28, signal: "general review" };
}

function modeScore(model: string, mode: RouteMode) {
  if (mode === "fast") return has(model, /small|mini|8b|14b/) ? { score: 12, signal: "latency-oriented" } : { score: 3, signal: "standard latency" };
  if (mode === "quality") return has(model, /kimi|glm|deepseek|coder|32b|70b/) ? { score: 12, signal: "quality capacity" } : { score: 4, signal: "quality baseline" };
  return has(model, /small|mini/) ? { score: 4, signal: "efficient capacity" } : { score: 8, signal: "balanced capacity" };
}

function taskScore(model: string, taskKind: TaskKind, stage: AgentStage) {
  if (taskKind === "debugging" && stage !== "plan" && has(model, /coder|code|mistral|deepseek/)) return { score: 10, signal: "debugging fit" };
  if (taskKind === "review" && stage === "review" && has(model, /mistral|qwen|llama/)) return { score: 10, signal: "review fit" };
  if (taskKind === "implementation" && stage === "build" && has(model, /coder|code|mistral|deepseek|glm/)) return { score: 10, signal: "implementation fit" };
  return { score: 4, signal: "task baseline" };
}

function runtimeScore(stage: AgentStage, model: string) {
  const health = readHealth(stage, model);
  if (health.attempts === 0) return { score: 0, signals: ["no runtime history"] };

  const successRate = health.successes / health.attempts;
  const averageLatency = health.totalLatencyMs / health.attempts;
  const reliabilityScore = Math.round((successRate - 0.5) * 22);
  const latencyScore = averageLatency < 7_000 ? 5 : averageLatency < 14_000 ? 1 : -4;
  const cooldownScore = health.cooldownUntil > Date.now() ? -45 : 0;
  const signals = [`${Math.round(successRate * 100)}% stage reliability`, `${Math.round(averageLatency / 1000)}s observed latency`];

  if (cooldownScore) signals.push("recent output-gate failure");
  return { score: reliabilityScore + latencyScore + cooldownScore, signals };
}

export function rankModels(models: string[], stage: AgentStage, mode: RouteMode, taskKind: TaskKind): RankedModel[] {
  const uniqueModels = Array.from(new Set(models));
  const recognizedModels = uniqueModels.filter((model) => has(model, /qwen|mistral|deepseek|glm|kimi|llama|codestral|coder|code/));
  const candidatePool = recognizedModels.length > 0 ? recognizedModels : uniqueModels;

  return candidatePool
    .map((model) => {
      const stageFit = stageSignals(model, stage);
      const modeFit = modeScore(model, mode);
      const taskFit = taskScore(model, taskKind, stage);
      const runtimeFit = runtimeScore(stage, model);
      const signals = [stageFit.signal, taskFit.signal, modeFit.signal, ...runtimeFit.signals];

      return {
        model,
        score: clampScore(30 + stageFit.score + modeFit.score + taskFit.score + runtimeFit.score),
        signals,
      };
    })
    .sort((left, right) => right.score - left.score || left.model.localeCompare(right.model));
}

export function recordModelOutcome({ stage, model, passed, latencyMs }: { stage: AgentStage; model: string; passed: boolean; latencyMs: number }) {
  const health = readHealth(stage, model);
  health.attempts += 1;
  health.totalLatencyMs += latencyMs;

  if (passed) {
    health.successes += 1;
    health.cooldownUntil = 0;
    return;
  }

  health.cooldownUntil = Date.now() + 5 * 60 * 1000;
}

export function validateStageOutput(stage: AgentStage, content: string): QualityGateResult {
  const normalized = content.trim();
  const reflectiveFragments = normalized.match(/\b(okay|wait|hmm|let me think|i need to|first, i remember)\b/gi)?.length ?? 0;

  if (normalized.length < 80) return { passed: false, summary: "response was too short to be useful" };

  if (stage === "build") {
    const hasCodeFence = /```[a-zA-Z0-9+#.-]*\n[\s\S]+?```/.test(normalized);
    const hasFileMarker = /(^|\n)[ \t]*(?:\/\/|#|\/\*|<!--)\s*file:\s*/i.test(normalized);
    if (!hasCodeFence && !hasFileMarker) return { passed: false, summary: "implementation did not identify its code files" };
    if (reflectiveFragments >= 3) return { passed: false, summary: "implementation was reasoning-heavy instead of code-first" };
    return { passed: true, summary: "code output passed the implementation gate" };
  }

  if (stage === "plan") {
    const hasStructure = /(^|\n)\s*(?:[-*]|\d+[.)])\s+/m.test(normalized) || /#+\s+/.test(normalized);
    if (!hasStructure && reflectiveFragments >= 3) return { passed: false, summary: "plan was unstructured internal reasoning" };
    return { passed: true, summary: "plan passed the structure gate" };
  }

  const hasActionableLanguage = /\b(should|must|consider|issue|risk|fix|test)\b/i.test(normalized);
  return hasActionableLanguage
    ? { passed: true, summary: "review passed the actionability gate" }
    : { passed: false, summary: "review did not contain actionable guidance" };
}
