"use client";

import { useState, useEffect, useRef, type ClipboardEvent, type ChangeEvent, type DragEvent } from "react";
import { compressImageForVision } from "@/lib/image-utils";
import type { RouteMode } from "@/lib/types";

interface TaskComposerProps {
  task: string;
  mode: RouteMode;
  isRouting: boolean;
  image?: string;
  onTaskChange: (task: string) => void;
  onImageChange: (image?: string) => void;
  onModeChange: (mode: RouteMode) => void;
  onRoute: () => void;
}

const MODES: Array<{ value: RouteMode; label: string; description: string }> = [
  { value: "fast", label: "Fast", description: "Fewer stages (Plan + Build)" },
  { value: "balanced", label: "Balanced", description: "Plan, build, review" },
  { value: "quality", label: "Quality", description: "More thorough prompts & deep checks" },
];

const EXAMPLES = [
  "responsive HTML/CSS landing page for AI startup with dark mode",
  "interactive HTML/CSS canvas snake game with score tracking",
  "glassmorphism calculator web app with smooth CSS transitions",
  "restaurant menu & reservation page with dark mode theme",
  "interactive HTML/CSS/JS tic-tac-toe game with score counter",
];

const QUICK_SUGGESTIONS = [
  { label: "🎮 Snake Game", prompt: "Build an interactive HTML CSS JS canvas snake game with score tracking and controls" },
  { label: "🧮 Calculator App", prompt: "Build a responsive calculator web app with dark mode and smooth animations" },
  { label: "✨ AI Landing Page", prompt: "Build a modern HTML CSS JS landing page for an AI SaaS platform with glassmorphism UI and high-contrast dark theme" },
  { label: "🍕 Gourmet Restaurant", prompt: "Build a responsive HTML CSS JS gourmet restaurant menu & lounge website with dark mode" },
];

export function TaskComposer({
  task,
  mode,
  isRouting,
  image,
  onTaskChange,
  onImageChange,
  onModeChange,
  onRoute,
}: TaskComposerProps) {
  const [animatedText, setAnimatedText] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* Typewriter & Cycling Placeholder Animation */
  useEffect(() => {
    if (task.length > 0 || image) return;

    const currentExample = EXAMPLES[exampleIndex % EXAMPLES.length];
    const typingSpeed = isDeleting ? 30 : 65;

    const timer = setTimeout(() => {
      if (!isDeleting && animatedText === currentExample) {
        setTimeout(() => setIsDeleting(true), 1800);
      } else if (isDeleting && animatedText === "") {
        setIsDeleting(false);
        setExampleIndex((prev) => prev + 1);
      } else {
        const nextText = isDeleting
          ? currentExample.slice(0, animatedText.length - 1)
          : currentExample.slice(0, animatedText.length + 1);
        setAnimatedText(nextText);
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [animatedText, isDeleting, exampleIndex, task, image]);

  /* Handle Clipboard Paste (Ctrl+V) */
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          readImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  }

  /* Handle Drag and Drop */
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      readImageFile(file);
    }
  }

  /* Handle File Input Upload */
  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readImageFile(file);
  }

  function readImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const result = evt.target?.result;
      if (typeof result === "string") {
        const compressed = await compressImageForVision(result);
        onImageChange(compressed);
      }
    };
    reader.readAsDataURL(file);
  }

  const placeholderText = image
    ? "Describe what you want to build from this attached wireframe/image..."
    : `Say what you wanna build... e.g. ${animatedText} (or paste image with Ctrl+V)`;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200 ${
        isDragging
          ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_90px_rgba(34,211,238,0.25)]"
          : "border-cyan-200/20 bg-slate-950/75 shadow-[0_0_70px_rgba(14,165,233,0.1)]"
      }`}
    >
      <label className="sr-only" htmlFor="coding-task">
        Describe a coding task
      </label>

      {/* Image Preview Thumbnail */}
      {image && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-2.5">
          <div className="flex items-center gap-3">
            <img src={image} alt="Attached wireframe/screenshot" className="h-12 w-12 rounded-lg object-cover border border-cyan-400/40 shadow-sm" />
            <div>
              <p className="text-xs font-semibold text-cyan-200">🖼️ Image attached (1024px compressed)</p>
              <p className="text-[11px] text-slate-400">Routes to Qwen3-VL open vision flagship model</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onImageChange(undefined)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
            title="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Textarea with Drag & Drop + Ctrl+V Paste */}
      <div className="relative">
        <textarea
          id="coding-task"
          className="min-h-36 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 text-base leading-6 text-slate-100 outline-none transition placeholder:text-slate-500/90 focus:border-cyan-300/60 focus:bg-cyan-300/[0.035]"
          maxLength={6000}
          onChange={(event) => onTaskChange(event.target.value)}
          onPaste={handlePaste}
          placeholder={placeholderText}
          value={task}
        />

        {/* Image File Attachment Trigger Button */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-cyan-200"
          title="Attach image or screenshot (or paste with Ctrl+V)"
        >
          <svg className="h-4 w-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>{image ? "Change Image" : "Attach Image (Ctrl+V)"}</span>
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      {!image && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-3">
          <span className="text-[11px] font-medium text-slate-500 mr-1">Quick Try:</span>
          {QUICK_SUGGESTIONS.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onTaskChange(chip.prompt)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* FeatherRouter Pipeline Mode Controls & Execution Button */}
      <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Routing mode">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mr-1">Pipeline Mode:</span>
          {MODES.map((option) => (
            <button
              key={option.value}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                mode === option.value
                  ? "bg-cyan-300 text-slate-950 font-semibold shadow-[0_0_22px_rgba(103,232,249,0.35)]"
                  : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
              }`}
              onClick={() => onModeChange(option.value)}
              title={option.description}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-6 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-cyan-500/20"
          disabled={isRouting}
          onClick={onRoute}
          type="button"
        >
          {isRouting ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Routing agent…
            </span>
          ) : (
            <>
              {image ? "Route task with Vision" : "Route task"}
              <span aria-hidden="true" className="text-lg leading-none">
                →
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
