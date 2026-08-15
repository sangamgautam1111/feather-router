import type { AgentArtifact, RouteResponse } from "@/lib/types";

export interface CanvasFile {
  name: string;
  language: string;
  content: string;
  source: "implementation" | "architecture" | "review";
}

interface CodeBlock {
  language: string;
  content: string;
  fileName?: string;
}

interface FileMarker {
  contentStart: number;
  fileName: string;
  index: number;
}

const extensions: Record<string, string> = {
  bash: "sh",
  css: "css",
  html: "html",
  javascript: "js",
  js: "js",
  json: "json",
  jsx: "jsx",
  markdown: "md",
  md: "md",
  python: "py",
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
};

/**
 * Strips any trailing conversational English prose or markdown notes
 * accidentally appended inside code blocks by LLMs.
 */
function cleanCodeContent(content: string, fileName?: string): string {
  let cleaned = content.trim();
  const ext = fileName?.split(".").at(-1)?.toLowerCase();

  // Remove trailing markdown code fence backticks if present inside block
  cleaned = cleaned.replace(/```\s*$/g, "").trim();

  if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx" || ext === "css" || ext === "html" || ext === "py") {
    const lines = cleaned.split("\n");
    let cutoffIndex = lines.length;

    const prosePatterns = [
      /^(this|note|make sure|here is|the above|this file|this update|this script|in this|as you can see|the code below|you can now|make sure to|remember to)/i,
      /^```/
    ];

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      if (prosePatterns.some((pattern) => pattern.test(line))) {
        cutoffIndex = i;
      } else {
        break;
      }
    }

    if (cutoffIndex < lines.length) {
      cleaned = lines.slice(0, cutoffIndex).join("\n").trim();
    }
  }

  // Strip any remaining trailing blank lines (prevents empty space at end of editor)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");

  // Deduplicate exact repeating blocks (e.g. if LLM outputted full file content twice)
  const lines = cleaned.split("\n");
  if (lines.length > 8) {
    const header = lines.slice(0, 4).join("\n");
    const repeatIndex = cleaned.indexOf(header, header.length + 10);
    if (repeatIndex !== -1) {
      cleaned = cleaned.slice(0, repeatIndex).trim();
    }
  }

  return cleaned;
}

function artifactFor(result: RouteResponse, stage: AgentArtifact["stage"]) {
  return result.artifacts.find((artifact) => artifact.stage === stage && artifact.status === "complete");
}

function codeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match = fence.exec(content);

  while (match) {
    const language = match[1].trim().split(/\s+/)[0].toLowerCase() || "text";
    const fileMarker = fileMarkerFrom(match[2]);
    const cleanedContent = cleanCodeContent(fileMarker.content, fileMarker.fileName);
    if (cleanedContent) blocks.push({ language, content: cleanedContent, fileName: fileMarker.fileName });
    match = fence.exec(content);
  }

  return blocks.length > 0 ? blocks : markedCodeBlocks(content);
}

function safeFileName(value: string) {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !/^[a-zA-Z0-9_./-]+$/.test(normalized)) return undefined;
  return normalized;
}

function languageForFileName(fileName: string) {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (extension === "html" || extension === "htm") return "html";
  if (extension === "css") return "css";
  if (extension === "tsx") return "tsx";
  if (extension === "jsx") return "jsx";
  if (extension === "ts") return "typescript";
  if (extension === "js" || extension === "mjs") return "javascript";
  if (extension === "json") return "json";
  if (extension === "md") return "markdown";
  if (extension === "py") return "python";
  return "text";
}

function fileMarkers(content: string): FileMarker[] {
  const patterns = [
    /^[ \t]*\/\/\s*file:\s*([^\r\n]+)/gim,
    /^[ \t]*#\s*file:\s*([^\r\n]+)/gim,
    /^[ \t]*\/\*\s*file:\s*([^*]+?)\s*\*\//gim,
    /^[ \t]*<!--\s*file:\s*([^>]+?)\s*-->/gim,
  ];
  const markers: FileMarker[] = [];

  for (const pattern of patterns) {
    let match = pattern.exec(content);
    while (match) {
      const fileName = safeFileName(match[1]);
      if (fileName) markers.push({ index: match.index, contentStart: match.index + match[0].length, fileName });
      match = pattern.exec(content);
    }
  }

  return markers.sort((left, right) => left.index - right.index);
}

function markedCodeBlocks(content: string): CodeBlock[] {
  const markers = fileMarkers(content);

  return markers.flatMap((marker, index) => {
    const nextMarker = markers[index + 1];
    const rawContent = content.slice(marker.contentStart, nextMarker?.index).trim();
    const blockContent = cleanCodeContent(rawContent, marker.fileName);
    if (!blockContent) return [];

    return [{ language: languageForFileName(marker.fileName), content: blockContent, fileName: marker.fileName }];
  });
}

function fileMarkerFrom(content: string) {
  const markers = [
    /^[ \t]*\/\/\s*file:\s*([^\r\n]+)\r?\n/i,
    /^[ \t]*#\s*file:\s*([^\r\n]+)\r?\n/i,
    /^[ \t]*\/\*\s*file:\s*([^*]+?)\s*\*\/\s*\r?\n/i,
    /^[ \t]*<!--\s*file:\s*([^>]+?)\s*-->\s*\r?\n/i,
  ];

  for (const marker of markers) {
    const match = content.match(marker);
    if (match) return { content: content.slice(match[0].length), fileName: safeFileName(match[1]) };
  }

  return { content, fileName: undefined };
}

function uniqueFileName(name: string, usedNames: Set<string>) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const extensionIndex = name.lastIndexOf(".");
  const stem = extensionIndex > -1 ? name.slice(0, extensionIndex) : name;
  const extension = extensionIndex > -1 ? name.slice(extensionIndex) : "";
  let index = 2;
  let candidate = `${stem}-${index}${extension}`;

  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${extension}`;
  }

  usedNames.add(candidate);
  return candidate;
}

/**
 * Smart Core Structure & Path Auto-Inference:
 * If a code block lacks an explicit file marker, inspect its content to assign
 * clean, production-grade Next.js / Web file paths (app/page.tsx, components/Hero.tsx, etc.).
 */
function inferFileName(block: CodeBlock, index: number, totalBlocks: number): string {
  if (block.fileName) return block.fileName;

  const text = block.content;
  const lang = block.language.toLowerCase();

  // HTML file
  if (lang === "html" || text.includes("<!DOCTYPE html>") || text.includes("<html")) {
    return "index.html";
  }

  // CSS file
  if (lang === "css" || text.includes("@tailwind") || text.includes("body {")) {
    return "styles/globals.css";
  }

  // Next.js / React TSX / JSX files
  if (lang === "tsx" || lang === "jsx" || lang === "ts" || lang === "js" || text.includes("React") || text.includes("className")) {
    if (text.includes("export default function Page") || text.includes("export default function Home") || text.includes("usePathname")) {
      return "app/page.tsx";
    }
    if (text.includes("function Hero") || text.includes("id=\"hero\"") || text.includes("HeroSection")) {
      return "components/Hero.tsx";
    }
    if (text.includes("function Header") || text.includes("function Navbar") || text.includes("<nav")) {
      return "components/Navbar.tsx";
    }
    if (text.includes("function Features") || text.includes("feature-card")) {
      return "components/Features.tsx";
    }
    if (text.includes("function Footer") || text.includes("<footer")) {
      return "components/Footer.tsx";
    }
    if (totalBlocks === 1) {
      return "app/page.tsx";
    }
    return `components/Component-${index + 1}.${lang === "jsx" || lang === "js" ? "jsx" : "tsx"}`;
  }

  const ext = extensions[lang] ?? "txt";
  return `src/file-${index + 1}.${ext}`;
}

function implementationFiles(artifact: AgentArtifact | undefined): CanvasFile[] {
  if (!artifact) return [];

  const blocks = codeBlocks(artifact.content);
  if (blocks.length === 0) {
    return [{ name: "implementation.md", language: "markdown", content: artifact.content, source: "implementation" }];
  }

  // Deduplicate code blocks by filename (keep longest complete version)
  const fileMap = new Map<string, { block: CodeBlock; index: number }>();
  
  blocks.slice(0, 8).forEach((block, index) => {
    const rawFileName = inferFileName(block, index, blocks.length);
    const existing = fileMap.get(rawFileName);
    if (!existing || block.content.length > existing.block.content.length) {
      fileMap.set(rawFileName, { block, index });
    }
  });

  const usedNames = new Set<string>();
  return Array.from(fileMap.values()).map(({ block, index }) => {
    const rawFileName = inferFileName(block, index, blocks.length);
    const finalContent = cleanCodeContent(block.content, rawFileName);
    return {
      name: uniqueFileName(rawFileName, usedNames),
      language: block.language,
      content: finalContent,
      source: "implementation",
    };
  });
}

function documentFile(artifact: AgentArtifact | undefined, name: string, source: CanvasFile["source"]): CanvasFile[] {
  if (!artifact) return [];
  return [{ name, language: "markdown", content: artifact.content, source }];
}

export function filesForCanvas(result: RouteResponse | null): CanvasFile[] {
  if (!result) return [];

  return [
    ...implementationFiles(artifactFor(result, "build")),
    ...documentFile(artifactFor(result, "plan"), "architecture.md", "architecture"),
    ...documentFile(artifactFor(result, "review"), "review.md", "review"),
  ];
}
