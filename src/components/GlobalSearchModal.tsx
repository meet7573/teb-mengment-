import React, { useState, useMemo } from 'react';
import { Search, X, Users, Tablet, Boxes, FileCheck, ArrowRight } from 'lucide-react';
import { getStudents, getTablets, getTabletBoxes, getAssignments } from '../utils/storage';
import { GlobalSearchResult } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, itemId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  const students = useMemo(() => getStudents(), [isOpen]);
  const tablets = useMemo(() => getTablets(), [isOpen]);
  const boxes = useMemo(() => getTabletBoxes(), [isOpen]);
  const assignments = useMemo(() => getAssignments(), [isOpen]);

  const searchResults: GlobalSearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query?.toLowerCase().trim();
    const results: GlobalSearchResult[] = [];

    // Search Students
    students.forEach(s => {
      if (
        s.name?.toLowerCase()?.includes(q) ||
        s.pinNumber?.toLowerCase()?.includes(q) ||
        s.pinNumber?.toLowerCase().replace(/^pin-?/, '').includes(q) ||
        s.standard?.toLowerCase()?.includes(q)
      ) {
        results.push({
          id: s.id,
          type: 'Student',
          title: `${s.pinNumber} – ${s.name}`,
          subtitle: `Std ${s.standard} ${s.isCoachingStudent ? '• Coaching' : ''}`,
          tag: s.status,
          data: s,
        });
      }
    });

    // Search Tablets
    tablets.forEach(t => {
      if (
        t.tabletName?.toLowerCase()?.includes(q) ||
        t.tabletNumber?.toLowerCase()?.includes(q) ||
        t.brand?.toLowerCase()?.includes(q) ||
        t.model?.toLowerCase()?.includes(q)
      ) {
        results.push({
          id: t.id,
          type: 'Tablet',
          title: `${t.tabletNumber} (${t.tabletName})`,
          subtitle: `${t.brand} ${t.model} • Box: ${t.boxNumber || 'Unboxed'}`,
          tag: t.status,
          data: t,
        });
      }
    });

    // Search Boxes
    boxes.forEach(b => {
      if (
        b.boxNumber?.toLowerCase()?.includes(q) ||
        b.boxName?.toLowerCase()?.includes(q) ||
        b.location?.toLowerCase()?.includes(q)
      ) {
        results.push({
          id: b.id,
          type: 'Box',
          title: `${b.boxNumber} - ${b.boxName}`,
          subtitle: `${b.location} • ${b.tablets.length}/7 Tablets`,
          tag: `${b.tablets.length}/7 Filled`,
          data: b,
        });
      }
    });

    return results.slice(0, 15); // max 15
  }, [query, students, tablets, boxes, assignments]);

  if (!isOpen) return null;

  const getIcon = (type: GlobalSearchResult['type']) => {
    switch (type) {
      case 'Student': return <Users className="w-4 h-4 text-emerald-500" />;
      case 'Tablet': return <Tablet className="w-4 h-4 text-blue-500" />;
      case 'Box': return <Boxes className="w-4 h-4 text-amber-500" />;
      case 'Assignment': return <FileCheck className="w-4 h-4 text-purple-500" />;
    }
  };

  const handleSelect = (result: GlobalSearchResult) => {
    onClose();
    switch (result.type) {
      case 'Student': onNavigate('students', result.id); break;
      case 'Tablet': onNavigate('tablets', result.id); break;
      case 'Box': onNavigate('boxes', result.id); break;
      case 'Assignment': onNavigate('assignments', result.id); break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Global search student, PIN number, tablet ID, box..."
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none text-base font-medium"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() && searchResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">No matches found for "{query}"</p>
              <p className="text-xs text-slate-500 mt-1">Try searching by PIN number (e.g., PIN-1001), Tablet ID (TBL-8001), or Box (BOX-01)</p>
            </div>
          ) : !query.trim() ? (
            <div className="p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-500 dark:text-slate-400 mb-2">QUICK SEARCH SUGGESTIONS</p>
              <div className="flex flex-wrap gap-2">
                {['PIN-1001', 'Std 8', 'TBL-8001', 'BOX-01', 'Coaching', 'Samsung'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 text-xs font-medium transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((res) => (
                <button
                  key={`${res.type}-${res.id}`}
                  onClick={() => handleSelect(res)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm">
                      {getIcon(res.type)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {res.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {res.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {res.type}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Search across students, tablets, 7-tablet capacity boxes, & attendance registers</span>
          <span>Esc to close</span>
        </div>

      </div>
    </div>
  );
};
