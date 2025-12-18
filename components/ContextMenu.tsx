import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onBookmark: () => void;
  onAddNote: () => void;
  onOpenHighlighter: () => void;
  onSummarize: () => void;
  onExplain?: () => void;
  isBookmarked: boolean;
  hasSelection: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onBookmark,
  onAddNote,
  onOpenHighlighter,
  onSummarize,
  onExplain,
  isBookmarked,
  hasSelection
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [onClose]);

  const style = {
    top: Math.min(y, window.innerHeight - 300),
    left: Math.min(x, window.innerWidth - 220),
  };

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl rounded-2xl shadow-2xl border dark:border-gold/30 w-56 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-left"
    >
      <div className="flex flex-col py-2">
        {hasSelection && (
          <>
            <button onClick={onSummarize} className="px-5 py-3 text-left text-sm hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 dark:text-gold/90 transition-colors">
               <i className="fa-solid fa-sparkles text-mblue dark:text-gold w-4"></i>
               <span className="font-bold uppercase tracking-tight">AI Summarize</span>
            </button>
            <button onClick={onExplain} className="px-5 py-3 text-left text-sm hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 dark:text-gold/90 transition-colors">
               <i className="fa-solid fa-brain text-mblue dark:text-gold w-4"></i>
               <span className="font-bold uppercase tracking-tight">AI Explain</span>
            </button>
            <div className="h-px bg-gray-100 dark:bg-gold/10 mx-2 my-1"></div>
          </>
        )}
        <button onClick={onBookmark} className="px-5 py-3 text-left text-sm hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 dark:text-gold/90 transition-colors">
          <i className={`${isBookmarked ? 'fa-solid text-gold-shiny' : 'fa-regular text-gray-400'} fa-bookmark w-4`}></i>
          <span className="font-bold uppercase tracking-tight">{isBookmarked ? 'Unmark Page' : 'Mark Page'}</span>
        </button>
        <button onClick={onAddNote} className="px-5 py-3 text-left text-sm hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 dark:text-gold/90 transition-colors">
          <i className="fa-solid fa-pen-nib text-gray-400 dark:text-gold/40 w-4"></i>
          <span className="font-bold uppercase tracking-tight">Create Note</span>
        </button>
        <button onClick={onOpenHighlighter} className="px-5 py-3 text-left text-sm hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 dark:text-gold/90 transition-colors border-t dark:border-gold/10 mt-1">
          <i className="fa-solid fa-marker text-mblue dark:text-gold-shiny w-4"></i>
          <span className="font-bold uppercase tracking-tight">Highlighter</span>
        </button>
      </div>
    </div>
  );
};