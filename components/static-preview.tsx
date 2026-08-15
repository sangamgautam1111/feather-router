interface StaticPreviewProps {
  document: string;
}

export function StaticPreview({ document }: StaticPreviewProps) {
  return (
    <div className="min-h-0 flex-1 bg-[#0a0e1a] p-5">
      <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white shadow-lg shadow-black/25">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          <span>Isolated static preview</span>
          <span>HTML · CSS · JavaScript</span>
        </div>
        <iframe className="min-h-0 flex-1 bg-white" sandbox="allow-scripts" srcDoc={document} title="Generated static website preview" />
      </div>
    </div>
  );
}
