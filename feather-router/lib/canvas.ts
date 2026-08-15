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
    const blockContent = fileMarker.content.trim();
    if (blockContent) blocks.push({ language, content: blockContent, fileName: fileMarker.fileName });
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
    const blockContent = content.slice(marker.contentStart, nextMarker?.index).trim();
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

function implementationFiles(artifact: AgentArtifact | undefined): CanvasFile[] {
  if (!artifact) return [];

  const blocks = codeBlocks(artifact.content);
  if (blocks.length === 0) {
    return [{ name: "implementation.md", language: "markdown", content: artifact.content, source: "implementation" }];
  }

  const usedNames = new Set<string>();
  return blocks.slice(0, 8).map((block, index) => {
    const extension = extensions[block.language] ?? "txt";
    const suffix = blocks.length === 1 ? "" : `-${index + 1}`;
    return {
      name: uniqueFileName(block.fileName ?? `implementation${suffix}.${extension}`, usedNames),
      language: block.language,
      content: block.content,
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
