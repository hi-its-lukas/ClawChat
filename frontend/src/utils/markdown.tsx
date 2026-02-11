import React from 'react';
import hljs from 'highlight.js/lib/common';

export function renderContent(content: string): React.ReactNode {
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*|>[^\n]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/^```(\w+)?\n?([\s\S]*?)```$/);
      const lang = match?.[1];
      const code = match?.[2] || part.slice(3, -3);
      let highlighted: string;
      try {
        highlighted = lang
          ? hljs.highlight(code.trim(), { language: lang }).value
          : hljs.highlightAuto(code.trim()).value;
      } catch {
        highlighted = hljs.highlightAuto(code.trim()).value;
      }
      return (
        <pre key={i} className="bg-slate-950 rounded-lg p-3 my-2 text-sm overflow-x-auto">
          {lang && <div className="text-xs text-slate-500 mb-2 font-mono">{lang}</div>}
          <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-slate-950 px-1.5 py-0.5 rounded text-sm text-pink-400">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('>')) {
      return (
        <blockquote key={i} className="border-l-4 border-slate-600 pl-3 my-1 text-slate-400">
          {part.slice(1).trim()}
        </blockquote>
      );
    }
    return part.split(/(@\w+)/g).map((seg, j) =>
      seg.startsWith('@') ? (
        <span key={`${i}-${j}`} className="bg-indigo-900/50 text-indigo-300 px-1 rounded">
          {seg}
        </span>
      ) : (
        seg
      )
    );
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
