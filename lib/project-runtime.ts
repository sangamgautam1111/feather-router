export interface ProjectFile {
  name: string;
  content: string;
}

export type RuntimeKind = "static" | "nextjs" | "react" | "node" | "source";

export interface RuntimeTarget {
  kind: RuntimeKind;
  label: string;
  detail: string;
  setupCommand?: string;
  startCommand?: string;
  staticPreview?: string;
}

function injectBeforeClosingTag(document: string, closingTag: string, content: string) {
  const expression = new RegExp(`</${closingTag}\\s*>`, "i");
  return expression.test(document) ? document.replace(expression, `${content}</${closingTag}>`) : `${document}${content}`;
}

function staticPreviewDocument(files: ProjectFile[]) {
  const entryFile = files.find((file) => /(^|\/)index\.html?$/i.test(file.name)) ?? files.find((file) => /\.html?$/i.test(file.name));
  if (!entryFile) return undefined;

  const styles = files.filter((file) => /\.css$/i.test(file.name)).map((file) => file.content).join("\n\n");
  const scripts = files.filter((file) => /\.js$/i.test(file.name)).map((file) => file.content).join("\n\n");
  const contentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https:; font-src data: https:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  let document = entryFile.content;

  document = injectBeforeClosingTag(document, "head", `<meta http-equiv=\"Content-Security-Policy\" content=\"${contentSecurityPolicy}\"><style>${styles}</style>`);
  document = injectBeforeClosingTag(document, "body", `<script>${scripts}</script>`);
  return document;
}

export function resolveRuntimeTarget(task: string, files: ProjectFile[]): RuntimeTarget {
  const signal = `${task}\n${files.map((file) => file.name).join("\n")}`.toLowerCase();
  const preview = staticPreviewDocument(files);

  if (/\bnext(?:\.js|js)?\b|app router|pages router/.test(signal)) {
    const hasPackageManifest = files.some((file) => /(^|\/)package\.json$/i.test(file.name));
    return {
      kind: "nextjs",
      label: "Next.js target",
      detail: "These are Next.js source artifacts. Middleware, route handlers, and server components must run in a real Next.js process, so the canvas does not pretend an iframe is a framework runtime.",
      setupCommand: hasPackageManifest ? "npm install" : "npx create-next-app@latest feather-router-demo --ts --tailwind --app",
      startCommand: "npm run dev",
    };
  }

  if (/\breact\b|\bvite\b|\.tsx\b|\.jsx\b/.test(signal)) {
    return {
      kind: "react",
      label: "React target",
      detail: "These artifacts target a React project. Run them in a project runtime to resolve imports, bundling, and package dependencies.",
      setupCommand: "npm create vite@latest feather-router-demo -- --template react-ts",
      startCommand: "npm run dev",
    };
  }

  if (/\bexpress\b|\bnode(?:\.js)?\b|\bapi\b|server\.|\.py\b/.test(signal)) {
    return {
      kind: "node",
      label: "Server runtime target",
      detail: "Server code needs its requested runtime, environment variables, and dependencies. The canvas preserves the generated source instead of running it in the browser.",
      setupCommand: "npm install",
      startCommand: "npm run dev",
    };
  }

  if (preview) {
    return {
      kind: "static",
      label: "Static web preview",
      detail: "This HTML/CSS/JavaScript output runs in an isolated browser iframe. External network calls are blocked during preview.",
      staticPreview: preview,
    };
  }

  return {
    kind: "source",
    label: "Source artifacts",
    detail: "The router produced source files. Ask for a specific framework or a static HTML page when you need a runnable browser preview.",
  };
}
