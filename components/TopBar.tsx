import React from 'react';

interface TopBarProps {
  visible: boolean;
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
  visible,
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
    <header 
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}
    >
      <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-white/20 dark:border-white/5 shadow-sm"></div>
      
      <div className="relative z-10 px-4 h-14 flex items-center justify-between">
        {/* Left: Library & Title */}
        <div className="flex items-center gap-3 overflow-hidden flex-1 mr-2">
          <button 
            onClick={onOpenLibrary}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100/50 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-mblue/10 dark:hover:bg-gold/10 transition-colors" 
          >
            <i className="fa-solid fa-folder-tree text-sm"></i>
          </button>
          
          <div className="flex flex-col overflow-hidden justify-center h-full">
            <h1 className="text-xs font-bold truncate dark:text-gray-200 font-serif tracking-wide opacity-90">{fileName || 'ZenReader'}</h1>
            {fileName && (
               <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 tracking-wider">
                  Page {pageNumber} <span className="mx-1 opacity-50">/</span> {numPages}
               </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
           {fileName && (
              <>
                <button 
                  onClick={onToggleAudio}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isAudioActive ? 'text-mblue dark:text-gold bg-mblue/10 dark:bg-gold/10' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                  <i className={`${isAudioActive ? 'fa-solid animate-pulse' : 'fa-solid'} fa-headphones text-sm`}></i>
                </button>
                
                <button 
                  onClick={toggleBookmark}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isBookmarked ? 'text-gold dark:text-gold bg-gold/10' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                  <i className={`${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark text-sm`}></i>
                </button>
              </>
           )}

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>

          <button 
            onClick={onOpenSettings} 
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <i className="fa-solid fa-sliders text-sm"></i>
          </button>
        </div>
      </div>
    </header>
  );
};