import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onBookmark: () => void;
  onAddNote: () => void;
  onOpenHighlighter: () => void;
  onSummarize: () => void;
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

  // Ensure menu stays within viewport
  const style = {
    top: Math.min(y, window.innerHeight - (hasSelection ? 250 : 200)),
    left: Math.min(x, window.innerWidth - 200),
  };

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-52 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left"
    >
      <div className="flex flex-col py-1">
        {hasSelection && (
          <button onClick={onSummarize} className="px-4 py-3 text-left text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-3 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700">
             <i className="fa-solid fa-sparkles text-purple-500 w-4"></i>
             <span className="font-semibold text-purple-600 dark:text-purple-400">Gemini Summarize</span>
          </button>
        )}
        <button onClick={onBookmark} className="px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-gray-200">
          <i className={`${isBookmarked ? 'fa-solid text-yellow-500' : 'fa-regular text-gray-400'} fa-bookmark w-4`}></i>
          {isBookmarked ? 'Remove Bookmark' : 'Bookmark Page'}
        </button>
        <button onClick={onAddNote} className="px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-gray-200">
          <i className="fa-solid fa-pen-to-square text-gray-400 w-4"></i>
          Add Note
        </button>
        <button onClick={onOpenHighlighter} className="px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-gray-200 border-t dark:border-gray-700">
          <i className="fa-solid fa-highlighter text-blue-500 w-4"></i>
          Highlighter
        </button>
      </div>
    </div>
  );
};