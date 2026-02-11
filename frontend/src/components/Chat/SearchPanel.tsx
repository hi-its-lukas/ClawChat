import React, { useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import type { SearchResult } from '../../types';
import { renderContent } from '../../utils/markdown';

interface SearchPanelProps {
  onClose: () => void;
  onNavigate?: (channelId: string, messageId: string) => void;
}

export function SearchPanel({ onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q, limit: 20 } });
      setResults(data.results);
      setTotal(data.total);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
        <h3 className="font-semibold text-white">Search</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-slate-700">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search messages..."
          className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
          autoFocus
        />
        {total > 0 && (
          <p className="text-xs text-slate-400 mt-1">{total} result{total !== 1 ? 's' : ''} found</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}

        {!loading && results.length === 0 && query.length >= 2 && (
          <div className="text-center py-8 text-slate-500 text-sm">No results found</div>
        )}

        {results.map((result) => (
          <div key={result.id} className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{result.author?.username}</span>
              <span className="text-xs text-slate-500">in #{result.channel_name}</span>
              <span className="text-xs text-slate-500">
                {new Date(result.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="text-sm text-slate-300 break-words whitespace-pre-wrap line-clamp-3">
              {renderContent(result.content)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
