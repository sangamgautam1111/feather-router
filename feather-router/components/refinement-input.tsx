"use client";

import { useState, type KeyboardEvent } from "react";

/* ── Icons ─────────────────────────────────────────────── */

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────── */

interface RefinementInputProps {
  onSubmit: (prompt: string) => void;
  isRouting: boolean;
}

export function RefinementInput({ onSubmit, isRouting }: RefinementInputProps) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !isRouting;

  function submit() {
    if (!canSubmit) return;
    onSubmit(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-white/[0.06] bg-[#0a0e18]/80 px-4 py-3">
      <input
        type="text"
        className="flex-1 rounded-lg border border-white/[0.06] bg-[#0c1120] px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400/30 focus:bg-[#0e1324]"
        placeholder="Type your request to refine the codebase..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isRouting}
        aria-label="Refinement prompt"
      />
      <button
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30 disabled:opacity-40 disabled:shadow-none"
        onClick={submit}
        disabled={!canSubmit}
        aria-label="Send refinement"
      >
        {isRouting ? <SpinnerIcon /> : <SendIcon />}
      </button>
    </div>
  );
}
