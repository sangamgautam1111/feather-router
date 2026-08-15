"use client";

import { useState, useRef, type KeyboardEvent, type ClipboardEvent, type ChangeEvent } from "react";
import { compressImageForVision } from "@/lib/image-utils";

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
  onSubmit: (prompt: string, image?: string) => void;
  isRouting: boolean;
}

export function RefinementInput({ onSubmit, isRouting }: RefinementInputProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = value.trim();
  const canSubmit = (trimmed.length > 0 || Boolean(image)) && !isRouting;

  function submit() {
    if (!canSubmit) return;
    onSubmit(trimmed || "Refine codebase based on attached image/wireframe.", image);
    setValue("");
    setImage(undefined);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  /* Handle Ctrl+V image pasting */
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
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
        setImage(compressed);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col border-t border-white/[0.06] bg-[#0a0e18]/90">
      {/* Attached image preview banner */}
      {image && (
        <div className="flex items-center justify-between border-b border-white/[0.04] bg-cyan-950/20 px-4 py-2 text-xs">
          <div className="flex items-center gap-2.5">
            <img src={image} alt="Attached screenshot" className="h-7 w-7 rounded object-cover border border-cyan-400/40" />
            <span className="text-cyan-200 font-medium">Image attached</span>
          </div>
          <button
            onClick={() => setImage(undefined)}
            className="text-slate-400 hover:text-rose-300"
            title="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-3">
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        {/* Attach image button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/10 hover:text-cyan-300"
          title="Attach image/wireframe (or paste Ctrl+V)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>

        <input
          type="text"
          className="flex-1 rounded-lg border border-white/[0.06] bg-[#0c1120] px-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400/30 focus:bg-[#0e1324]"
          placeholder={image ? "Describe your requested changes for this attached image..." : "Type request or paste image with Ctrl+V..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isRouting}
          aria-label="Refinement prompt"
        />

        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30 disabled:opacity-40 disabled:shadow-none"
          onClick={submit}
          disabled={!canSubmit}
          aria-label="Send refinement"
        >
          {isRouting ? <SpinnerIcon /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}
