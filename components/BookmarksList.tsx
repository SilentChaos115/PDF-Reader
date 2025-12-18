import React from 'react';

interface BookmarksListProps {
  bookmarks: number[];
  goToPage: (page: number) => void;
  removeBookmark: (page: number) => void;
}

export const BookmarksList: React.FC<BookmarksListProps> = ({ bookmarks, goToPage, removeBookmark }) => {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="p-4 bg-white dark:bg-gray-850 shadow-sm border-b dark:border-gray-700">
        <h2 className="font-bold text-lg dark:text-white">Bookmarks ({bookmarks.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <i className="fa-regular fa-bookmark text-4xl mb-3 opacity-30"></i>
            <p>No bookmarks yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
             {bookmarks.sort((a,b) => a - b).map(page => (
               <div key={page} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                 <button 
                   onClick={() => goToPage(page)}
                   className="flex-1 text-left font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                 >
                   Page {page}
                 </button>
                 <button 
                   onClick={(e) => { e.stopPropagation(); removeBookmark(page); }}
                   className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                 >
                   <i className="fa-solid fa-trash-can"></i>
                 </button>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
