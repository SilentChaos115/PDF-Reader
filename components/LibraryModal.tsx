import React, { useEffect, useState, useRef } from 'react';
import { getRecentFiles, removeFileFromLibrary, getSections, saveSection, deleteSection, updateFileSection } from '../services/db';
import { RecentFile, Section } from '../types';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File) => Promise<void> | void;
  onImportNew: (e: React.ChangeEvent<HTMLInputElement>, sectionId?: string) => Promise<void>;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  onImportNew
}) => {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['uncategorized', 'recently_opened']));
  const [isManagingSections, setIsManagingSections] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Context Menu State
  const [fileMenu, setFileMenu] = useState<{ id: string, x: number, y: number } | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ id: string, x: number, y: number } | null>(null);
  const [isAssigningFolder, setIsAssigningFolder] = useState(false);
  const longPressTimer = useRef<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recents, storedSections] = await Promise.all([getRecentFiles(), getSections()]);
      setFiles(recents);
      setSections(storedSections);
      
      const newExpanded = new Set(expandedSections);
      recents.forEach(f => {
        if (f.sectionId) newExpanded.add(f.sectionId);
      });
      setExpandedSections(newExpanded);
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
    const handleGlobalClick = () => {
      setFileMenu(null);
      setFolderMenu(null);
      setIsAssigningFolder(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isOpen]);

  const handleDeleteFile = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm("Remove document permanently from your Imperial Vault?")) {
      await removeFileFromLibrary(id);
      loadData();
    }
  };

  const toggleSection = (id: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSections(newSet);
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    const section = { id: Date.now().toString(), name: newSectionName.trim() };
    await saveSection(section);
    setNewSectionName('');
    loadData();
  };

  const handleDeleteSection = async (id: string) => {
    if (window.confirm("Delete this folder? Documents will return to Unclassified archives.")) {
      await deleteSection(id);
      loadData();
    }
  };

  const moveFile = async (fileId: string, sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await updateFileSection(fileId, sectionId);
    setFileMenu(null);
    setIsAssigningFolder(false);
    loadData();
  };

  const handleLongPressFile = (e: React.TouchEvent | React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Adjust context menu position to avoid clipping
    const menuWidth = 240;
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 20);
    
    setFileMenu({ id, x: adjustedX, y });
    setIsAssigningFolder(false);
  };

  const handleLongPressFolder = (e: React.TouchEvent | React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setFolderMenu({ id, x, y });
  };

  const handleFileTouchStart = (e: React.TouchEvent, id: string) => {
    longPressTimer.current = setTimeout(() => handleLongPressFile(e, id), 600);
  };

  const handleFolderTouchStart = (e: React.TouchEvent, id: string) => {
    longPressTimer.current = setTimeout(() => handleLongPressFolder(e, id), 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  if (!isOpen) return null;

  const groupedFiles = {
    uncategorized: files.filter(f => !f.sectionId || f.sectionId === 'uncategorized')
  };
  
  sections.forEach(s => {
    groupedFiles[s.id] = files.filter(f => f.sectionId === s.id);
  });

  const recentlyOpened = files.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-black rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.2)] w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border dark:border-gold/30 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b dark:border-gold/20 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
          <div>
            <h2 className="text-2xl font-black dark:metallic-gold flex items-center gap-3 uppercase tracking-tighter italic">
              <i className="fa-solid fa-gem animate-shine"></i>
              Imperial Vault
            </h2>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsManagingSections(!isManagingSections)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest flex items-center gap-2 ${isManagingSections ? 'bg-mblue text-white shadow-mblue/40 shadow-lg' : 'bg-gray-200 dark:bg-gray-900 text-gray-600 dark:text-gold/60 hover:dark:text-gold'}`}
            >
              <i className="fa-solid fa-folder-tree"></i>
              Folders
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 dark:text-gold/40 hover:dark:bg-red-500/20 hover:dark:text-red-500 transition-all">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </div>

        {/* Library Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-black space-y-8 pb-32">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <i className="fa-solid fa-atom fa-spin text-mblue dark:text-gold text-4xl"></i>
               <span className="text-xs font-bold dark:text-gold/40 uppercase tracking-widest">Opening Vault...</span>
             </div>
          ) : (
            <>
              {/* Folders Management UI */}
              {isManagingSections && (
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border-2 dark:border-gold/20 animate-in slide-in-from-top-4 shadow-xl">
                  <h3 className="text-sm font-black dark:text-gold mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <i className="fa-solid fa-plus-circle text-mblue dark:text-gold"></i> Forge New Folder
                  </h3>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Folder name..."
                      className="flex-1 bg-gray-100 dark:bg-black border-2 dark:border-gold/10 rounded-xl px-4 py-3 text-sm dark:text-white outline-none focus:ring-2 focus:ring-mblue dark:focus:ring-gold transition-all"
                    />
                    <button onClick={handleAddSection} className="bg-mblue dark:metallic-gold-bg text-white dark:text-black px-6 py-3 rounded-xl text-sm font-bold shadow-lg uppercase tracking-widest">Create</button>
                  </div>
                </div>
              )}

              {/* RECENTLY OPENED SECTION */}
              {recentlyOpened.length > 0 && (
                <div className="space-y-4">
                  <div 
                    onClick={() => toggleSection('recently_opened')}
                    className={`flex items-center gap-3 cursor-pointer group transition-all ${expandedSections.has('recently_opened') ? 'dark:metallic-gold opacity-100' : 'opacity-40 hover:opacity-100'}`}
                  >
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] italic">Recently Accessed</h3>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gold/10"></div>
                  </div>
                  
                  {expandedSections.has('recently_opened') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 animate-in slide-in-from-top-2">
                       {recentlyOpened.map(file => (
                         <div 
                            key={`recent-${file.id}`}
                            onClick={() => { onSelectFile(file.data as any); onClose(); }}
                            onContextMenu={(e) => handleLongPressFile(e, file.id)}
                            onTouchStart={(e) => handleFileTouchStart(e, file.id)}
                            onTouchEnd={handleTouchEnd}
                            className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border-2 border-transparent hover:border-mblue dark:hover:border-gold shadow-md hover:shadow-2xl cursor-pointer transition-all h-64"
                         >
                            <div className="flex-1 bg-gray-200 dark:bg-black flex items-center justify-center overflow-hidden relative">
                              {file.thumbnail ? (
                                <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700" />
                              ) : (
                                <i className="fa-solid fa-file-pdf text-4xl text-gray-300 dark:text-gold/10"></i>
                              )}
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-950">
                              <h3 className="text-[11px] font-black dark:text-gold/90 truncate uppercase tracking-tight italic">{file.name}</h3>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}

              {/* USER FOLDERS SECTION */}
              {sections.map((section) => {
                const sectionFiles = groupedFiles[section.id] || [];
                const isExpanded = expandedSections.has(section.id);
                if (sectionFiles.length === 0 && !isManagingSections) return null;

                return (
                  <div key={section.id} className="space-y-4">
                    <button 
                      onClick={() => toggleSection(section.id)}
                      onContextMenu={(e) => handleLongPressFolder(e, section.id)}
                      onTouchStart={(e) => handleFolderTouchStart(e, section.id)}
                      onTouchEnd={handleTouchEnd}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl shadow-lg border transition-all duration-300 ${isExpanded ? 'bg-mblue/5 dark:bg-gold/5 border-mblue dark:border-gold/40' : 'bg-white dark:bg-gray-900 border-transparent'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all ${isExpanded ? 'metallic-blue-bg dark:metallic-gold-bg text-white dark:text-black scale-110' : 'bg-gray-100 dark:bg-black text-gray-400 dark:text-gold/40'}`}>
                          <i className={`fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'}`}></i>
                        </div>
                        <span className={`text-sm font-black uppercase tracking-widest ${isExpanded ? 'text-mblue dark:text-gold' : 'text-gray-600 dark:text-gold/40'}`}>{section.name}</span>
                        <span className="text-[11px] font-black bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-500 dark:text-gold/60">{sectionFiles.length}</span>
                      </div>
                      <i className={`fa-solid fa-chevron-right text-xs transition-transform duration-500 ${isExpanded ? 'rotate-90 text-mblue dark:text-gold' : 'text-gray-300'}`}></i>
                    </button>

                    {isExpanded && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pl-2 animate-in slide-in-from-top-2">
                        {sectionFiles.map((file) => (
                          <div 
                            key={file.id}
                            onClick={() => { onSelectFile(file.data as any); onClose(); }}
                            onContextMenu={(e) => handleLongPressFile(e, file.id)}
                            onTouchStart={(e) => handleFileTouchStart(e, file.id)}
                            onTouchEnd={handleTouchEnd}
                            className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border-2 border-transparent hover:border-mblue dark:hover:border-gold shadow-md hover:shadow-2xl cursor-pointer transition-all h-72 animate-in fade-in zoom-in-95"
                          >
                            <div className="flex-1 bg-gray-200 dark:bg-black flex items-center justify-center overflow-hidden relative">
                              {file.thumbnail ? (
                                 <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                              ) : (
                                 <i className="fa-solid fa-file-pdf text-5xl text-gray-300 dark:text-gold/10"></i>
                              )}
                            </div>
                            <div className="p-4 border-t dark:border-gold/10 bg-white dark:bg-gray-950">
                              <h3 className="text-[12px] font-black dark:text-gold/90 truncate mb-1 uppercase tracking-tight italic">{file.name}</h3>
                              <div className="flex justify-between text-[9px] text-gray-400 dark:text-gold/40 font-black uppercase tracking-[0.2em]">
                                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* UNCLASSIFIED (UNCATEGORIZED) SECTION */}
              <div className="space-y-4">
                  <div 
                    onClick={() => toggleSection('uncategorized')}
                    className={`flex items-center gap-3 cursor-pointer group transition-all ${expandedSections.has('uncategorized') ? 'dark:metallic-gold opacity-100' : 'opacity-40 hover:opacity-100'}`}
                  >
                    <i className="fa-solid fa-box-archive"></i>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] italic">Unclassified Archives</h3>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gold/10"></div>
                  </div>
                  
                  {expandedSections.has('uncategorized') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 animate-in slide-in-from-top-2">
                       {groupedFiles.uncategorized.map(file => (
                         <div 
                            key={`un-${file.id}`}
                            onClick={() => { onSelectFile(file.data as any); onClose(); }}
                            onContextMenu={(e) => handleLongPressFile(e, file.id)}
                            onTouchStart={(e) => handleFileTouchStart(e, file.id)}
                            onTouchEnd={handleTouchEnd}
                            className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border-2 border-transparent hover:border-mblue dark:hover:border-gold shadow-md hover:shadow-2xl cursor-pointer transition-all h-72 animate-in fade-in zoom-in-95"
                         >
                            <div className="flex-1 bg-gray-200 dark:bg-black flex items-center justify-center overflow-hidden relative">
                              {file.thumbnail ? (
                                <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700" />
                              ) : (
                                <i className="fa-solid fa-file-pdf text-5xl text-gray-300 dark:text-gold/10"></i>
                              )}
                            </div>
                            <div className="p-4 bg-white dark:bg-gray-950">
                              <h3 className="text-[12px] font-black dark:text-gold/90 truncate uppercase tracking-tight italic">{file.name}</h3>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
            </>
          )}
        </div>

        {/* Global Action Footer */}
        <div className="absolute bottom-0 inset-x-0 p-6 border-t dark:border-gold/20 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-20">
          <label className="flex items-center justify-center gap-3 w-full py-5 metallic-blue-bg dark:metallic-gold-bg text-white dark:text-black rounded-2xl cursor-pointer transition-all shadow-2xl active:scale-[0.97] group">
             <i className="fa-solid fa-cloud-arrow-up text-xl group-hover:animate-bounce"></i>
             <span className="font-black uppercase tracking-[0.3em] text-sm italic">Unlock New Document</span>
             <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onImportNew(e)} />
          </label>
        </div>

        {/* CUSTOM FILE CONTEXT MENU */}
        {fileMenu && (
          <div 
            style={{ top: fileMenu.y, left: fileMenu.x }}
            className="fixed z-[100] bg-white dark:bg-black border-2 dark:border-gold/40 rounded-2xl shadow-2xl w-60 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="p-3 border-b dark:border-gold/10 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
                <p className="text-[10px] font-black dark:text-gold uppercase truncate tracking-widest">Protocol Delta</p>
                <button onClick={() => setFileMenu(null)}><i className="fa-solid fa-times text-xs dark:text-gold/40"></i></button>
             </div>
             <div className="flex flex-col py-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAssigningFolder(!isAssigningFolder); }}
                  className={`w-full text-left px-4 py-4 text-xs font-black flex items-center justify-between uppercase tracking-tight transition-colors ${isAssigningFolder ? 'bg-mblue/10 dark:bg-gold/20 dark:text-gold' : 'dark:text-gold/90 hover:bg-mblue/10 dark:hover:bg-gold/10'}`}
                >
                  <span className="flex items-center gap-3"><i className="fa-solid fa-folder-tree text-mblue dark:text-gold"></i> Assign Folder</span>
                  <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${isAssigningFolder ? 'rotate-90' : ''}`}></i>
                </button>

                {isAssigningFolder && (
                   <div className="bg-gray-50 dark:bg-gray-900/50 border-y dark:border-gold/10 animate-in slide-in-from-top-2 overflow-y-auto max-h-48">
                      {[...sections, { id: 'uncategorized', name: 'Unclassified Archives' }].map(s => (
                        <button 
                          key={`move-${s.id}`}
                          onClick={(e) => moveFile(fileMenu.id, s.id, e)}
                          className="w-full px-8 py-3 text-[10px] font-black uppercase text-left hover:bg-gold/20 dark:text-gold/80 transition-colors border-b dark:border-gold/5 last:border-0"
                        >
                          {s.name}
                        </button>
                      ))}
                   </div>
                )}

                <button 
                  onClick={() => { handleDeleteFile(fileMenu.id); setFileMenu(null); }}
                  className="w-full text-left px-4 py-4 text-xs font-black text-red-500 hover:bg-red-500/10 flex items-center gap-3 uppercase tracking-tight"
                >
                  <i className="fa-solid fa-trash-can"></i> Expunge Forever
                </button>
             </div>
          </div>
        )}

        {/* CUSTOM FOLDER CONTEXT MENU */}
        {folderMenu && (
          <div 
            style={{ top: folderMenu.y, left: folderMenu.x }}
            className="fixed z-[100] bg-white dark:bg-black border-2 dark:border-gold/40 rounded-2xl shadow-2xl w-60 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="p-3 border-b dark:border-gold/10 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
                <p className="text-[10px] font-black dark:text-gold uppercase truncate tracking-widest">Folder Directive</p>
                <button onClick={() => setFolderMenu(null)}><i className="fa-solid fa-times text-xs dark:text-gold/40"></i></button>
             </div>
             <div className="flex flex-col py-1">
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'application/pdf';
                    input.onchange = (e) => {
                      onImportNew(e as any, folderMenu.id);
                      setFolderMenu(null);
                    };
                    input.click();
                  }}
                  className="w-full text-left px-4 py-4 text-xs font-black dark:text-gold/90 hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 uppercase tracking-tight"
                >
                  <i className="fa-solid fa-file-circle-plus text-mblue dark:text-gold"></i> Import Document Here
                </button>
                <button 
                   onClick={() => {
                     const name = prompt("Enter new Imperial Designation for this folder:");
                     if (name) saveSection({ id: folderMenu.id, name });
                     setFolderMenu(null);
                     loadData();
                   }}
                   className="w-full text-left px-4 py-4 text-xs font-black dark:text-gold/90 hover:bg-mblue/10 dark:hover:bg-gold/10 flex items-center gap-3 uppercase tracking-tight"
                >
                  <i className="fa-solid fa-pen-to-square"></i> Re-designate Folder
                </button>
                <button 
                  onClick={() => { handleDeleteSection(folderMenu.id); setFolderMenu(null); }}
                  className="w-full text-left px-4 py-4 text-xs font-black text-red-500 hover:bg-red-500/10 flex items-center gap-3 uppercase tracking-tight"
                >
                  <i className="fa-solid fa-ban"></i> Decommission Folder
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};