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
  return Math.max(1, Math.min(99, Math.round(score)));
}

function has(model: string, expression: RegExp) {
  return expression.test(model.toLowerCase());
}

function stageSignals(model: string, stage: AgentStage) {
  if (stage === "plan") {
    if (has(model, /qwen3-vl|qwen2-vl|vision/)) return { score: 35, signal: "vision-multimodal architecture" };
    if (has(model, /kimi|glm|deepseek|qwen3|reason/)) return { score: 35, signal: "reasoning-capable" };
    if (has(model, /coder|code/)) return { score: 25, signal: "general planning" };
    return { score: 20, signal: "general planning" };
  }

  if (stage === "build") {
    if (has(model, /qwen2\.5-coder|coder|codestral|code-v2/)) return { score: 50, signal: "code-specialist" };
    if (has(model, /mistral-small|mistral|deepseek|glm/)) return { score: 25, signal: "general implementation" };
    if (has(model, /qwen3-vl|qwen2-vl|vision/)) return { score: 18, signal: "vision fallback" };
    if (has(model, /qwen3|reason/)) return { score: 18, signal: "reasoning-first fallback" };
    return { score: 15, signal: "general implementation" };
  }

  if (has(model, /mistral|qwen|llama|glm|deepseek/)) return { score: 35, signal: "review-capable" };
  return { score: 22, signal: "general review" };
}

function modeScore(model: string, mode: RouteMode) {
  if (mode === "fast") {
    if (has(model, /small|mini|14b|8b|7b/)) return { score: 20, signal: "ultra-fast latency" };
    if (has(model, /24b|32b|30b/)) return { score: 14, signal: "efficient throughput" };
    return { score: 6, signal: "standard latency" };
  }

  if (mode === "quality") {
    if (has(model, /qwen3-vl|qwen3|32b|70b|coder-32b|mistral-small-3\.1/)) return { score: 20, signal: "flagship quality capacity" };
    if (has(model, /coder|code|glm|deepseek/)) return { score: 14, signal: "high-capacity baseline" };
    return { score: 8, signal: "quality baseline" };
  }

  // Balanced Mode: Optimal compromise between speed and depth
  if (has(model, /coder|mistral|24b|32b|30b/)) return { score: 16, signal: "balanced speed & quality" };
  return { score: 10, signal: "balanced capacity" };
}

function taskScore(model: string, taskKind: TaskKind, stage: AgentStage) {
  if (taskKind === "vision" && stage === "plan") {
    if (isVisionModel(model)) return { score: 15, signal: "vision task specialist" };
    return { score: 3, signal: "text-only fallback" };
  }
  if (taskKind === "vision" && stage === "build") {
    if (has(model, /qwen2\.5-coder|coder|codestral|code-v2/)) return { score: 15, signal: "code generation specialist" };
    if (has(model, /mistral-small|mistral|deepseek|glm/)) return { score: 12, signal: "implementation specialist" };
    return { score: 5, signal: "general implementation" };
  }
  if (taskKind === "debugging" && stage !== "plan" && has(model, /coder|code|mistral|deepseek/)) return { score: 12, signal: "debugging fit" };
  if (taskKind === "review" && stage === "review" && has(model, /mistral|qwen|llama/)) return { score: 12, signal: "review fit" };
  if (taskKind === "implementation" && stage === "build" && has(model, /coder|code|mistral|deepseek|glm/)) return { score: 12, signal: "implementation fit" };
  return { score: 5, signal: "task baseline" };
}

function runtimeScore(stage: AgentStage, model: string) {
  const health = readHealth(stage, model);
  if (health.attempts === 0) return { score: 0, signals: ["no runtime history"] };

  const successRate = health.successes / health.attempts;
  const averageLatency = health.totalLatencyMs / health.attempts;
  const reliabilityScore = Math.round((successRate - 0.5) * 16);
  const latencyScore = averageLatency < 7_000 ? 4 : averageLatency < 14_000 ? 1 : -3;
  const cooldownScore = health.cooldownUntil > Date.now() ? -30 : 0;
  const signals = [`${Math.round(successRate * 100)}% stage reliability`, `${Math.round(averageLatency / 1000)}s observed latency`];

  if (cooldownScore) signals.push("recent output-gate failure");
  return { score: reliabilityScore + latencyScore + cooldownScore, signals };
}

export function isVisionModel(model: string): boolean {
  return /qwen3-vl|qwen2-vl|vision|pixtral|llava|cogvlm|llama3\.2-.*vision/i.test(model.toLowerCase());
}

function visionScore(model: string, hasImage?: boolean, stage?: AgentStage) {
  if (!hasImage || stage !== "plan") return { score: 0, signal: null };
  if (isVisionModel(model)) {
    return { score: 15, signal: "vision-multimodal capability" };
  }
  return { score: 0, signal: "text fallback for vision prompt" };
}

export function rankModels(models: string[], stage: AgentStage, mode: RouteMode, taskKind: TaskKind, hasImage?: boolean): RankedModel[] {
  const uniqueModels = Array.from(new Set(models));
  const recognizedModels = uniqueModels.filter((model) =>
    has(model, /qwen|mistral|deepseek|glm|kimi|llama|codestral|coder|code|vl|vision|pixtral|llava/)
  );
  const candidatePool = recognizedModels.length > 0 ? recognizedModels : uniqueModels;

  return candidatePool
    .map((model) => {
      const stageFit = stageSignals(model, stage);
      const modeFit = modeScore(model, mode);
      const taskFit = taskScore(model, taskKind, stage);
      const vFit = visionScore(model, hasImage, stage);
      const runtimeFit = runtimeScore(stage, model);

      const signals = [stageFit.signal, taskFit.signal, modeFit.signal];
      if (vFit.signal) signals.unshift(vFit.signal);
      signals.push(...runtimeFit.signals);

      return {
        model,
        score: clampScore(15 + stageFit.score + modeFit.score + taskFit.score + vFit.score + runtimeFit.score),
        signals,
      };
    })
    .sort((left, right) => {
      if (hasImage && stage === "plan") {
        const leftIsVision = isVisionModel(left.model);
        const rightIsVision = isVisionModel(right.model);
        if (leftIsVision && !rightIsVision) return -1;
        if (!leftIsVision && rightIsVision) return 1;
      }
      return right.score - left.score || left.model.localeCompare(right.model);
    });
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

  health.cooldownUntil = Date.now() + 15 * 1000;
}

export function validateStageOutput(stage: AgentStage, content: string): QualityGateResult {
  const normalized = content.trim();
  const reflectiveFragments = normalized.match(/\b(okay|wait|hmm|let me think|i need to|first, i remember)\b/gi)?.length ?? 0;

  if (normalized.length < 80) return { passed: false, summary: "response was too short to be useful" };

  if (stage === "build") {
    const hasCodeFence = /```[a-zA-Z0-9+#.-]*\n[\s\S]+?```/.test(normalized);
    const hasFileMarker = /(^|\n)[ \t]*(?:\/\/|#|\/\*|<!--)\s*file:\s*/i.test(normalized);
    if (!hasCodeFence && !hasFileMarker) return { passed: false, summary: "implementation did not identify its code files" };
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
