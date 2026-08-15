import type { CanvasFile } from "@/lib/canvas";

/**
 * Result of checking whether a workspace can be previewed live in the browser.
 */
export interface WebPreviewability {
  canPreview: boolean;
  reason?: string;
  primaryHtmlFile?: string;
}

/**
 * Determines whether the given array of canvas files represents a web application.
 */
export function checkWebPreviewability(files: CanvasFile[]): WebPreviewability {
  if (!files || files.length === 0) {
    return { canPreview: false, reason: "No files present in workspace." };
  }

  const fileNames = files.map((f) => f.name.toLowerCase());

  // Check if workspace consists strictly of non-web files (Python, Shell, C++, Rust, Go, JSON only)
  const isOnlyBackendOrScript = files.every((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return ext === "py" || ext === "sh" || ext === "cpp" || ext === "rs" || ext === "go" || ext === "json" || ext === "md";
  });

  if (isOnlyBackendOrScript) {
    return {
      canPreview: false,
      reason: "Live Web Preview is for web applications (HTML/CSS/JS/React/Vue). Use 'How to Test & Deploy' for CLI execution guidance.",
    };
  }

  // Look for primary HTML file or JS/TSX/Vue/Svelte files
  const htmlFile = files.find((f) => f.name.toLowerCase().endsWith(".html"));
  const hasWebCode = fileNames.some((name) =>
    name.endsWith(".js") ||
    name.endsWith(".jsx") ||
    name.endsWith(".ts") ||
    name.endsWith(".tsx") ||
    name.endsWith(".vue") ||
    name.endsWith(".svelte") ||
    name.endsWith(".css") ||
    name.endsWith(".html")
  );

  if (!hasWebCode && !htmlFile) {
    return {
      canPreview: false,
      reason: "No web interface files found. Use 'How to Test & Deploy' for CLI execution guidance.",
    };
  }

  return {
    canPreview: true,
    primaryHtmlFile: htmlFile?.name,
  };
}

/**
 * Strips module import/export directives so code can run cleanly in browser window context.
 */
function sanitizeCode(code: string): string {
  let cleaned = code;

  // Strip ES module imports (import ... from '...')
  cleaned = cleaned.replace(/^\s*import\s+.*?;?\s*$/gm, "");
  cleaned = cleaned.replace(/^\s*import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, "");

  // Strip framework directives
  cleaned = cleaned.replace(/["']use client["'];?/g, "");
  cleaned = cleaned.replace(/["']use server["'];?/g, "");

  // Convert export default / named exports to global functions / variables
  cleaned = cleaned.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, "function $1");
  cleaned = cleaned.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, "function $1");
  cleaned = cleaned.replace(/export\s+default\s+/g, "window.DefaultExport = ");
  cleaned = cleaned.replace(/export\s+const\s+/g, "const ");
  cleaned = cleaned.replace(/export\s+let\s+/g, "let ");

  return cleaned;
}

/**
 * Detects third-party web libraries in workspace code and returns CDN script tags for auto-injection.
 */
function resolveLibraryCdns(allCodeText: string): string[] {
  const cdns: string[] = [];
  const text = allCodeText.toLowerCase();

  // Vue.js
  if (text.includes("vue") || text.includes("createapp")) {
    cdns.push(`<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>`);
  }

  // Chart.js
  if (text.includes("chart.js") || text.includes("new chart")) {
    cdns.push(`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`);
  }

  // Three.js (3D Graphics)
  if (text.includes("three") || text.includes("three.scene")) {
    cdns.push(`<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`);
  }

  // Lucide Icons
  if (text.includes("lucide") || text.includes("lucide-react")) {
    cdns.push(`<script src="https://unpkg.com/lucide@latest"></script>`);
  }

  // FontAwesome Icons
  if (text.includes("fontawesome") || text.includes("fa-")) {
    cdns.push(`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">`);
  }

  // Bootstrap
  if (text.includes("bootstrap")) {
    cdns.push(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">`);
    cdns.push(`<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>`);
  }

  // jQuery
  if (text.includes("jquery") || text.includes("$(")) {
    cdns.push(`<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>`);
  }

  // D3.js (Data Visualization)
  if (text.includes("d3") || text.includes("d3.select")) {
    cdns.push(`<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>`);
  }

  // GSAP (Animations)
  if (text.includes("gsap")) {
    cdns.push(`<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>`);
  }

  return cdns;
}

/**
 * Universal Web Workspace Bundler:
 * Automatically packages HTML, CSS, JavaScript, React/TSX, Vue, Tailwind, and third-party libraries
 * into a single, self-contained HTML document ready for live browser preview.
 */
export function bundleWebWorkspace(files: CanvasFile[]): string {
  const htmlFiles = files.filter((f) => f.name.toLowerCase().endsWith(".html"));
  const cssFiles = files.filter((f) => f.name.toLowerCase().endsWith(".css"));
  const codeFiles = files.filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx" || ext === "vue" || ext === "svelte";
  });

  const allCodeCombined = files.map((f) => f.content).join("\n\n");
  const autoCdns = resolveLibraryCdns(allCodeCombined);

  const hasReactOrTsx = codeFiles.some(
    (f) => f.name.endsWith(".jsx") || f.name.endsWith(".tsx") || f.content.includes("React") || f.content.includes("className")
  );

  const hasVue = codeFiles.some((f) => f.name.endsWith(".vue") || f.content.includes("createApp") || f.content.includes("Vue."));

  // Find primary HTML or build default skeleton
  const primaryHtml = htmlFiles.find((f) => f.name.toLowerCase().endsWith("index.html")) ?? htmlFiles[0];

  let mainHtmlContent = primaryHtml ? primaryHtml.content : `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Web App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #030712; color: #f9fafb; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; }
    #root { min-height: 100vh; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div id="root"></div>
  <div id="app"></div>
</body>
</html>`;

  // Inject Tailwind CDN if missing
  if (!mainHtmlContent.includes("cdn.tailwindcss.com")) {
    autoCdns.unshift(`<script src="https://cdn.tailwindcss.com"></script>`);
  }

  // Inject detected library CDNs into head
  if (autoCdns.length > 0) {
    const cdnBlock = autoCdns.join("\n");
    mainHtmlContent = mainHtmlContent.includes("</head>")
      ? mainHtmlContent.replace("</head>", `${cdnBlock}\n</head>`)
      : cdnBlock + "\n" + mainHtmlContent;
  }

  // Combine CSS styles
  const combinedCss = cssFiles.map((f) => `/* File: ${f.name} */\n${f.content}`).join("\n\n");
  if (combinedCss.trim()) {
    const styleTag = `<style>\n${combinedCss}\n</style>`;
    mainHtmlContent = mainHtmlContent.includes("</head>")
      ? mainHtmlContent.replace("</head>", `${styleTag}\n</head>`)
      : styleTag + "\n" + mainHtmlContent;
  }

  // Process code files
  if (codeFiles.length > 0) {
    // Sort code files: utilities & subcomponents first, page/app last
    const sortedCodeFiles = [...codeFiles].sort((a, b) => {
      const aIsMain = /page|app|index|main|landing/i.test(a.name);
      const bIsMain = /page|app|index|main|landing/i.test(b.name);
      if (aIsMain && !bIsMain) return 1;
      if (!aIsMain && bIsMain) return -1;
      return a.name.localeCompare(b.name);
    });

    const processedCodeBlocks = sortedCodeFiles
      .filter((f) => !f.name.endsWith(".d.ts"))
      .map((f) => {
        const sanitized = sanitizeCode(f.content);
        return `// ── File: ${f.name} ──\ntry {\n${sanitized}\n} catch(err) { console.warn('Warning in ${f.name}:', err); }`;
      })
      .join("\n\n");

    if (hasReactOrTsx) {
      // Inject React 18, ReactDOM 18, Babel standalone, Framer-Motion polyfill, Lucide proxy, and Next.js polyfills
      const reactHeader = `
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  // Mock Next.js & React hooks/components in browser global scope
  const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

  // Mock next/image
  const Image = ({ src, alt, width, height, className, style, ...props }) => (
    React.createElement('img', { src: src || 'https://via.placeholder.com/150', alt: alt || '', className, style, width, height, ...props })
  );

  // Mock next/link
  const Link = ({ href, children, className, style, ...props }) => (
    React.createElement('a', { href: href || '#', className, style, ...props }, children)
  );

  // Mock next/navigation & router
  const useRouter = () => ({ push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} });
  const usePathname = () => '/';
  const useSearchParams = () => new URLSearchParams();

  // Mock framer-motion (motion.div, motion.span, motion.button, etc.)
  const createMotionTag = (tag) => React.forwardRef(({ children, whileHover, whileTap, initial, animate, transition, exit, ...props }, ref) => (
    React.createElement(tag, { ...props, ref }, children)
  ));
  const motion = new Proxy({}, { get: (target, prop) => createMotionTag(prop || 'div') });
  const AnimatePresence = ({ children }) => children;

  // Universal Lucide React Icons Proxy: Fallback SVG for any missing icon component
  const createDefaultIcon = (iconName) => ({ className, size = 24, color = 'currentColor', ...props }) => (
    React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: className || '',
      ...props
    }, React.createElement('path', { d: 'M12 2v20M2 12h20M5 5l14 14' }))
  );

  // Attach icon fallbacks to global scope so undefined icons never crash rendering
  window.LucideIconProxy = new Proxy({}, {
    get: (target, prop) => typeof window[prop] !== 'undefined' ? window[prop] : createDefaultIcon(prop)
  });
</script>`;

      mainHtmlContent = mainHtmlContent.includes("</head>")
        ? mainHtmlContent.replace("</head>", `${reactHeader}\n</head>`)
        : reactHeader + "\n" + mainHtmlContent;

      // Smart Auto-mount React components into #root with ErrorBoundary diagnostic
      const autoMountScript = `
<script type="text/babel">
  // Error Boundary component to prevent blank screens on runtime JS errors
  class DiagnosticErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
      console.error('Preview Error Boundary Caught:', error, errorInfo);
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: '2rem', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', borderRadius: '1rem', margin: '1rem', border: '1px solid #334155' }}>
            <h2 style={{ color: '#f43f5e', fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Live Preview Error</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>{this.state.error?.message || 'An error occurred while rendering the component.'}</p>
            <pre style={{ backgroundColor: '#020617', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.75rem', color: '#fb7185', overflowX: 'auto', marginTop: '1rem' }}>
              {this.state.error?.stack || String(this.state.error)}
            </pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      ${processedCodeBlocks}

      const target = document.getElementById('root') || document.getElementById('app') || document.body;

      // Smart Component Resolution: Find best component to render
      let ComponentToRender = null;

      if (typeof Home !== 'undefined') ComponentToRender = Home;
      else if (typeof App !== 'undefined') ComponentToRender = App;
      else if (typeof Page !== 'undefined') ComponentToRender = Page;
      else if (typeof LandingPage !== 'undefined') ComponentToRender = LandingPage;
      else if (typeof NextLandingPage !== 'undefined') ComponentToRender = NextLandingPage;
      else if (typeof DefaultExport !== 'undefined') ComponentToRender = DefaultExport;
      else {
        // Find any capital-cased function defined in window scope
        const globals = Object.keys(window).filter(k => /^[A-Z][A-Za-z0-9_]*$/.test(k) && typeof window[k] === 'function');
        const candidateName = globals.find(g => /page|app|home|landing|main/i.test(g)) || globals[globals.length - 1];
        if (candidateName) ComponentToRender = window[candidateName];
      }

      if (ComponentToRender && target) {
        const root = ReactDOM.createRoot(target);
        root.render(
          React.createElement(DiagnosticErrorBoundary, null, React.createElement(ComponentToRender))
        );
      } else {
        console.warn('No renderable React component found in scope.');
      }
    } catch(err) {
      console.error('React execution error:', err);
      const target = document.getElementById('root') || document.body;
      if (target) {
        target.innerHTML = \`<div style="padding:2rem;color:#f43f5e;font-family:sans-serif;"><h3>Render Error</h3><p>\${err.message}</p></div>\`;
      }
    }
  });
</script>`;

      mainHtmlContent = mainHtmlContent.includes("</body>")
        ? mainHtmlContent.replace("</body>", `${autoMountScript}\n</body>`)
        : mainHtmlContent + "\n" + autoMountScript;
    } else if (hasVue) {
      // Auto-mount Vue components
      const vueMountScript = `
<script>
  document.addEventListener('DOMContentLoaded', () => {
    try {
      ${processedCodeBlocks}
      if (typeof Vue !== 'undefined' && typeof App !== 'undefined') {
        Vue.createApp(App).mount('#app');
      }
    } catch(err) {
      console.error('Vue mounting error:', err);
    }
  });
</script>`;
      mainHtmlContent = mainHtmlContent.includes("</body>")
        ? mainHtmlContent.replace("</body>", `${vueMountScript}\n</body>`)
        : mainHtmlContent + "\n" + vueMountScript;
    } else {
      // Universal Vanilla JS execution
      const jsScript = `
<script>
  document.addEventListener('DOMContentLoaded', () => {
    ${processedCodeBlocks}
  });
</script>`;
      mainHtmlContent = mainHtmlContent.includes("</body>")
        ? mainHtmlContent.replace("</body>", `${jsScript}\n</body>`)
        : mainHtmlContent + "\n" + jsScript;
    }
  }

  return mainHtmlContent;
}
