import React from 'react';

interface TopBarProps {
  fileName: string | null;
  pageNumber: number;
  numPages: number;
  onOpenLibrary: () => void;
  isBookmarked: boolean;
  toggleBookmark: () => void;
  onOpenSettings: () => void;
  onOpenDrive: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  fileName,
  pageNumber,
  numPages,
  onOpenLibrary,
  isBookmarked,
  toggleBookmark,
  onOpenSettings,
  onOpenDrive
}) => {
  return (
    <header className="bg-white dark:bg-gray-850 shadow-sm px-4 py-3 flex items-center justify-between z-10 shrink-0 border-b dark:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 overflow-hidden">
        {/* File Actions Dropdown (Simulated with hover group for simplicity or just separate buttons) */}
        <div className="flex gap-2">
            <button 
              onClick={onOpenLibrary}
              className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm" 
              title="Library / Open File"
            >
              <i className="fa-solid fa-book"></i>
            </button>
            <button 
              onClick={onOpenDrive}
              className="bg-green-600 hover:bg-green-700 text-white w-9 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm" 
              title="Open from Google Drive"
            >
              <i className="fa-brands fa-google-drive"></i>
            </button>
        </div>
        
        {fileName ? (
           <div className="flex flex-col overflow-hidden ml-2">
             <h1 className="text-sm font-semibold truncate dark:text-white max-w-[150px] sm:max-w-xs">{fileName}</h1>
             <span className="text-xs text-gray-500 dark:text-gray-400">Page {pageNumber} / {numPages}</span>
           </div>
        ) : (
          <h1 className="text-sm font-semibold text-gray-400 dark:text-gray-500 italic ml-2">No file loaded</h1>
        )}
      </div>

      <div className="flex items-center gap-4">
         {fileName && (
            <button 
              onClick={toggleBookmark}
              className={`text-lg transition-transform active:scale-95 ${isBookmarked ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'}`}
              title="Bookmark Page"
            >
              <i className={`${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
            </button>
         )}

        <button 
          onClick={onOpenSettings} 
          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Settings"
        >
          <i className="fa-solid fa-gear"></i>
        </button>
      </div>
    </header>
  );
};