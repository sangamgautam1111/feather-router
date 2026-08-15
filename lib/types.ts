export type RouteMode = "fast" | "balanced" | "quality";

export type AgentStage = "plan" | "build" | "review";

export type TaskKind = "debugging" | "implementation" | "explanation" | "review" | "general";

export type StageStatus = "ready" | "running" | "complete" | "failed";

export interface CandidateComparison {
  model: string;
  score: number;
  signals: string[];
}

export interface RouteDecision {
  stage: AgentStage;
  label: string;
  model: string;
  reason: string;
  status: StageStatus;
  selectedScore?: number;
  candidatesEvaluated?: number;
  candidates?: CandidateComparison[];
  fallbackUsed?: boolean;
  latencyMs?: number;
  qualityGate?: string;
}

export interface AgentArtifact {
  stage: AgentStage;
  title: string;
  content: string;
  status: "complete" | "failed";
}

export interface RouteResponse {
  runId: string;
  taskKind: TaskKind;
  decisions: RouteDecision[];
  artifacts: AgentArtifact[];
  completedAt: string;
}

export interface RunEntry {
  id: string;
  prompt: string;
  mode: RouteMode;
  result: RouteResponse;
  timestamp: string;
}
