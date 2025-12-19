import React from 'react';
import { AppView } from '../types';

interface ControlsProps {
  visible: boolean;
  pageNumber: number;
  numPages: number;
  scale: number;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onPageChange: (newPage: number) => void;
  onZoomChange: (newScale: number) => void;
  hasFile: boolean;
  doubleTapEnabled: boolean;
  toggleFullScreen: () => void;
  onFitToScreen: () => void;
  onOpenAI: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  visible,
  pageNumber,
  numPages,
  scale,
  activeView,
  setActiveView,
  onPageChange,
  onZoomChange,
  hasFile,
  doubleTapEnabled,
  toggleFullScreen,
  onFitToScreen,
  onOpenAI
}) => {
  if (!hasFile) return null;

  const NavButton = ({ active, onClick, icon, label }: { active?: boolean, onClick: () => void, icon: string, label?: string }) => (
    <button 
      onClick={onClick}
      className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${active ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg scale-105' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
    >
      <i className={`${icon} text-lg`}></i>
      {label && (
        <span className="absolute -top-10 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none whitespace-nowrap backdrop-blur-sm">
          {label}
        </span>
      )}
    </button>
  );

  return (
    <div className={`fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}>
      
      <div className="glass-panel px-3 py-2 rounded-[24px] flex items-center gap-1 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] pointer-events-auto scale-100 hover:scale-[1.02] transition-transform duration-300">
        
        {/* View Switcher */}
        <NavButton 
          active={activeView === AppView.READER} 
          onClick={() => setActiveView(AppView.READER)} 
          icon="fa-solid fa-book-open" 
          label="Read"
        />
        <NavButton 
          active={activeView === AppView.BOOKMARKS} 
          onClick={() => setActiveView(AppView.BOOKMARKS)} 
          icon="fa-regular fa-bookmark" 
          label="Bookmarks"
        />
        <NavButton 
          active={activeView === AppView.NOTES} 
          onClick={() => setActiveView(AppView.NOTES)} 
          icon="fa-regular fa-pen-to-square" 
          label="Notes"
        />

        <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-2"></div>

        {/* Reader Controls (Only visible in Reader view) */}
        {activeView === AppView.READER && (
          <>
             <button 
               onClick={() => onPageChange(pageNumber - 1)}
               disabled={pageNumber <= 1}
               className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
             >
               <i className="fa-solid fa-chevron-left text-sm"></i>
             </button>
             
             <div className="flex flex-col items-center w-10">
               <span className="text-[9px] font-black opacity-50 uppercase tracking-widest">Page</span>
               <span className="text-xs font-bold tabular-nums">{pageNumber}</span>
             </div>

             <button 
               onClick={() => onPageChange(pageNumber + 1)}
               disabled={pageNumber >= numPages}
               className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
             >
               <i className="fa-solid fa-chevron-right text-sm"></i>
             </button>

             <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-2"></div>

             <button 
              onClick={onOpenAI}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-mblue to-mblue-dark dark:from-gold dark:to-gold-dark text-white dark:text-black shadow-lg flex items-center justify-center hover:shadow-mblue/50 dark:hover:shadow-gold/50 transition-all hover:-translate-y-1"
             >
               <i className="fa-solid fa-sparkles"></i>
             </button>
          </>
        )}
      </div>
    </div>
  );
};