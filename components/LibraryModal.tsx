import React, { useEffect, useState } from 'react';
import { getRecentFiles, removeFileFromLibrary } from '../services/db';
import { RecentFile } from '../types';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File) => void;
  onImportNew: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  onImportNew
}) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const recents = await getRecentFiles();
      setFiles(recents);
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeFileFromLibrary(id);
    loadFiles();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-850 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-book text-blue-600"></i>
              Library
            </h2>
            <p className="text-xs text-gray-500">Your recently read documents</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          {loading ? (
             <div className="flex justify-center py-10">
               <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
             </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
               <i className="fa-solid fa-book-open text-4xl mb-4 opacity-30"></i>
               <p>No recent files.</p>
            </div>
          ) : (
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               {files.map((file) => (
                 <div 
                   key={file.id}
                   onClick={() => { onSelectFile(file.data); onClose(); }}
                   className="group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg cursor-pointer transition-all h-60"
                 >
                   <div className="flex-1 bg-gray-200 dark:bg-gray-950 flex items-center justify-center overflow-hidden relative">
                     {file.thumbnail ? (
                        <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                     ) : (
                        <i className="fa-regular fa-file-pdf text-4xl text-gray-400"></i>
                     )}
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                   </div>
                   
                   <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800 relative z-10">
                     <h3 className="text-sm font-semibold dark:text-gray-100 truncate mb-1">{file.name}</h3>
                     <div className="flex items-center justify-between text-[10px] text-gray-500">
                       <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                       <span>{new Date(file.date).toLocaleDateString()}</span>
                     </div>
                   </div>

                   <button 
                     onClick={(e) => handleDelete(file.id, e)}
                     className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-white transition-all opacity-0 group-hover:opacity-100 z-20 shadow-sm"
                   >
                     <i className="fa-solid fa-trash-can text-xs"></i>
                   </button>
                 </div>
               ))}
             </div>
          )}
        </div>

        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-850">
          <label className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-colors shadow-lg shadow-blue-500/30">
             <i className="fa-solid fa-plus"></i>
             <span className="font-semibold">Open New PDF</span>
             <input type="file" accept="application/pdf" className="hidden" onChange={onImportNew} />
          </label>
        </div>
      </div>
    </div>
  );
};