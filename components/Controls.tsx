import React from 'react';
import { AppView } from '../types';

interface ControlsProps {
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
}

export const Controls: React.FC<ControlsProps> = ({
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
  onFitToScreen
}) => {
  const buttonBase = "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium transition-colors";
  const activeClass = "text-blue-600 dark:text-blue-400";
  const inactiveClass = "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200";

  if (!hasFile) return null;

  return (
    <>
      {/* Floating Action Controls for Reader (Zoom/Nav) */}
      {activeView === AppView.READER && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 z-20">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          
          <div className="h-8 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>

           <button 
            onClick={() => onZoomChange(Math.max(0.5, scale - 0.1))}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
             <i className="fa-solid fa-minus text-sm"></i>
          </button>

          <span className="font-mono text-xs w-10 text-center">{Math.round(scale * 100)}%</span>

          <button 
            onClick={() => onZoomChange(Math.min(3.0, scale + 0.1))}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
             <i className="fa-solid fa-plus text-sm"></i>
          </button>

          <button 
            onClick={onFitToScreen}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors ml-1"
            title="Fit to Screen"
          >
             <i className="fa-solid fa-maximize text-sm"></i>
          </button>

          {!doubleTapEnabled && (
             <button 
              onClick={toggleFullScreen}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
              title="Fullscreen"
            >
               <i className="fa-solid fa-expand text-sm"></i>
            </button>
          )}

          <div className="h-8 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>

          <button 
            disabled={pageNumber >= numPages}
            onClick={() => onPageChange(pageNumber + 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Main Tab Bar */}
      <nav className="h-16 bg-white dark:bg-gray-850 border-t dark:border-gray-700 shrink-0 flex items-center justify-around z-30 pb-safe">
        <button 
          onClick={() => setActiveView(AppView.READER)}
          className={`${buttonBase} ${activeView === AppView.READER ? activeClass : inactiveClass}`}
        >
          <i className="fa-solid fa-book-open text-xl"></i>
          <span>Read</span>
        </button>

        <button 
          onClick={() => setActiveView(AppView.BOOKMARKS)}
          className={`${buttonBase} ${activeView === AppView.BOOKMARKS ? activeClass : inactiveClass}`}
        >
          <i className="fa-solid fa-bookmark text-xl"></i>
          <span>Bookmarks</span>
        </button>

        <button 
          onClick={() => setActiveView(AppView.NOTES)}
          className={`${buttonBase} ${activeView === AppView.NOTES ? activeClass : inactiveClass}`}
        >
          <i className="fa-solid fa-pen-to-square text-xl"></i>
          <span>Notes</span>
        </button>
      </nav>
    </>
  );
};