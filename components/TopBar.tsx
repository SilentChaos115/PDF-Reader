import React from 'react';

interface TopBarProps {
  fileName: string | null;
  pageNumber: number;
  numPages: number;
  onOpenLibrary: () => void;
  isBookmarked: boolean;
  toggleBookmark: () => void;
  onOpenSettings: () => void;
  isAudioActive: boolean;
  onToggleAudio: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  fileName,
  pageNumber,
  numPages,
  onOpenLibrary,
  isBookmarked,
  toggleBookmark,
  onOpenSettings,
  isAudioActive,
  onToggleAudio
}) => {
  return (
    <header className="bg-white dark:bg-black shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_15px_rgba(212,175,55,0.15)] px-4 py-3 flex items-center justify-between z-10 shrink-0 border-b dark:border-gold/30 transition-colors">
      <div className="flex items-center gap-2 overflow-hidden">
        <button 
          onClick={onOpenLibrary}
          className="bg-mblue hover:metallic-blue-bg dark:bg-gold dark:metallic-gold-bg text-white dark:text-black w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-95 group" 
          title="Library / Folders"
        >
          <i className="fa-solid fa-folder-tree group-hover:scale-110 transition-transform"></i>
        </button>
        
        {fileName ? (
           <div className="flex flex-col overflow-hidden ml-2">
             <h1 className="text-sm font-bold truncate dark:metallic-gold max-w-[150px] sm:max-w-xs uppercase tracking-tight">{fileName}</h1>
             <span className="text-[10px] font-bold text-gray-500 dark:text-gold/60 uppercase tracking-widest">Page {pageNumber} / {numPages}</span>
           </div>
        ) : (
          <h1 className="text-sm font-bold text-gray-400 dark:text-gold/30 italic ml-2 uppercase tracking-tighter">ZenReader</h1>
        )}
      </div>

      <div className="flex items-center gap-4">
         {fileName && (
            <>
              <button 
                onClick={onToggleAudio}
                className={`text-xl transition-all active:scale-95 ${isAudioActive ? 'text-mblue-shiny dark:text-gold-shiny animate-pulse drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]' : 'text-gray-400 dark:text-gold/40 hover:text-mblue dark:hover:text-gold'}`}
                title="Listen Mode"
              >
                <i className="fa-solid fa-headphones"></i>
              </button>
              
              <button 
                onClick={toggleBookmark}
                className={`text-xl transition-all active:scale-95 ${isBookmarked ? 'text-mblue-shiny dark:text-gold-shiny drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]' : 'text-gray-300 dark:text-gold/20 hover:text-mblue dark:hover:text-gold'}`}
                title="Bookmark"
              >
                <i className={`${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
              </button>
            </>
         )}

        <button 
          onClick={onOpenSettings} 
          className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-600 dark:text-gold/80 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all border dark:border-gold/20"
          title="App Settings"
        >
          <i className="fa-solid fa-sliders"></i>
        </button>
      </div>
    </header>
  );
};