import React, { useEffect, useState } from 'react';
import { getRecentFiles, removeFileFromLibrary, getSections, saveSection, deleteSection, updateFileSection, deleteFiles } from '../services/db';
import { loadPDF, extractTextFromDocument, getFirstPageText, getPDFMetadata } from '../services/pdfHelper';
import { categorizeBook } from '../services/gemini';
import { getBookSubjects } from '../services/metadata';
import { RecentFile, Section } from '../types';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File) => Promise<void> | void;
  onImportNew: (e: React.ChangeEvent<HTMLInputElement>, sectionId?: string) => Promise<void>;
}

type SortOption = 'date' | 'name' | 'size';

// Optimization: Local keyword mapping to save API calls
const KEYWORD_CATEGORIES: Record<string, string[]> = {
    "Technical/Coding": ["python", "javascript", "typescript", "rust", "golang", "c++", "programming", "code", "react", "vue", "angular", "node", "web dev", "developer", "software"],
    "Technical/Hardware": ["arduino", "raspberry pi", "circuit", "pcb", "hardware", "robotics", "electronics"],
    "Technical/DataScience": ["data science", "machine learning", "neural network", "ai", "artificial intelligence", "statistics", "analytics"],
    "Fiction/SciFi": ["sci-fi", "science fiction", "space opera", "alien", "star wars", "trek", "dune", "galaxy"],
    "Fiction/Fantasy": ["fantasy", "dragon", "magic", "wizard", "tolkien", "sword", "dungeons"],
    "Fiction/Thriller": ["thriller", "mystery", "crime", "detective", "murder", "suspense"],
    "Business/Finance": ["finance", "investing", "stock", "market", "economics", "business", "money", "wealth", "entrepreneur", "marketing"],
    "Personal/Health": ["health", "diet", "fitness", "workout", "yoga", "meditation", "medical", "anatomy", "nutrition", "cookbook"],
    "History/Ancient": ["ancient", "rome", "greece", "egypt", "mythology", "bc"],
    "History/Modern": ["wwii", "world war", "cold war", "history", "modern"],
    "Education/Textbooks": ["textbook", "handbook", "manual", "guide", "introduction to", "primer"],
    "Comics/Manga": ["manga", "comic", "volume", "vol.", "chapter"]
};

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  onImportNew
}) => {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recently_opened']));
  const [activeTab, setActiveTab] = useState<'all' | 'folders'>('all');
  const [showCreateFolderInput, setShowCreateFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name'); // Default to 'name' for natural sort priority
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection & Batch Operations
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [newFolderInBatch, setNewFolderInBatch] = useState('');

  // Auto Organization State
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizeProgress, setOrganizeProgress] = useState({ current: 0, total: 0, status: '' });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recents, storedSections] = await Promise.all([getRecentFiles(), getSections()]);
      setFiles(recents);
      setSections(storedSections);
      
      const newExpanded = new Set(expandedSections);
      storedSections.forEach(s => newExpanded.add(s.id));
      newExpanded.add('uncategorized');
      setExpandedSections(newExpanded);
    } catch (e) { console.error("Failed to load library", e); } finally { setLoading(false); }
  };

  useEffect(() => { 
    if (isOpen) { 
      loadData(); 
      setIsSelectionMode(false); 
      setSelectedIds(new Set()); 
      setShowBatchMove(false);
      setShowCreateFolderInput(false);
      setSearchQuery(''); 
    } 
  }, [isOpen]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, sectionId?: string) => {
    if (e.target.files?.length) { setLoading(true); await onImportNew(e, sectionId); await loadData(); }
  };

  const toggleSection = (id: string) => {
    const newSet = new Set(expandedSections);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedSections(newSet);
  };
  
  const handleCreateFolder = async (name: string) => {
    if (name.trim()) { 
      const newSection = { id: Date.now().toString(), name: name.trim() };
      await saveSection(newSection); 
      await loadData();
      return newSection.id;
    }
    return null;
  };
  
  const handleManualCreateFolder = async () => {
    if (newFolderName.trim()) {
        await handleCreateFolder(newFolderName);
        setNewFolderName('');
        setShowCreateFolderInput(false);
        setActiveTab('folders'); 
    }
  };

  const handleDeleteSection = async (id: string) => {
     if (window.confirm("Dissolve this folder? Documents will be returned to Uncategorized.")) { await deleteSection(id); loadData(); }
  };

  const handleDeleteSingleFile = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("Delete this document?")) {
          await removeFileFromLibrary(id);
          await loadData();
      }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size && window.confirm(`Permanently expunge ${selectedIds.size} documents?`)) {
       setLoading(true); 
       try {
         await deleteFiles(Array.from(selectedIds) as string[]);
       } catch (e) {
         console.error("Batch delete failed", e);
       }
       await loadData(); 
       setIsSelectionMode(false); 
       setSelectedIds(new Set());
    }
  };

  const handleBatchMove = async (targetSectionId: string) => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    for (const id of Array.from(selectedIds) as string[]) {
        await updateFileSection(id, targetSectionId);
    }
    await loadData();
    setShowBatchMove(false);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleCreateAndMove = async () => {
    if(!newFolderInBatch.trim()) return;
    const newId = await handleCreateFolder(newFolderInBatch);
    if(newId) {
      await handleBatchMove(newId);
      setNewFolderInBatch('');
    }
  };

  // Helper to get/create section ID
  const getTargetSectionId = async (catName: string, sectionMap: Map<string, string>): Promise<string> => {
    const key = catName.toLowerCase();
    if (sectionMap.has(key)) return sectionMap.get(key)!;
    
    // Check if hierarchical (e.g., Technical/Coding -> make just "Coding" folder or "Technical")
    const displayName = catName.includes('/') ? catName.split('/').pop()! : catName;
    
    // Check again with leaf name
    if (sectionMap.has(displayName.toLowerCase())) return sectionMap.get(displayName.toLowerCase())!;

    const newId = Date.now().toString() + Math.floor(Math.random() * 1000);
    const newSection = { id: newId, name: displayName };
    await saveSection(newSection);
    
    // Update local state to reflect new section immediately
    setSections(prev => [...prev, newSection]);
    sectionMap.set(displayName.toLowerCase(), newId);
    
    return newId;
  };

  // --- SMART SORT PIPELINE ---
  const handleAutoOrganize = async () => {
    const latestFiles = await getRecentFiles();
    const uncategorized = latestFiles.filter(f => !f.sectionId || f.sectionId === 'uncategorized' || f.sectionId === '');
    
    const filesToProcess = uncategorized.length === 0 ? latestFiles : uncategorized;
    if (filesToProcess.length === 0) {
        alert("Library is empty.");
        return;
    }

    if (uncategorized.length === 0) {
      if (!window.confirm("All files sorted! Re-scan entire library using Smart Sort?")) return;
    }

    // Abort Controller for stopping the process
    const controller = new AbortController();
    setAbortController(controller);

    setIsOrganizing(true);
    setActiveTab('folders');
    setOrganizeProgress({ current: 0, total: filesToProcess.length, status: 'Initializing Smart Sort...' });
    
    const latestSections = await getSections();
    const sectionMap = new Map<string, string>(); 
    latestSections.forEach(s => sectionMap.set(s.name.toLowerCase(), s.id));

    // Queue Processing
    const queue = [...filesToProcess];
    let consecutiveErrors = 0;

    // Process One by One
    while (queue.length > 0) {
        if (controller.signal.aborted) break;

        const file = queue.shift();
        if (!file) break;

        setOrganizeProgress(prev => ({ 
            ...prev, 
            current: filesToProcess.length - queue.length, 
            status: `Analyzing: ${file.name}` 
        }));

        try {
            // 1. Check Local Keywords FIRST (Zero API Cost)
            let category: string | null = null;
            const searchStr = file.name.toLowerCase();
            
            for (const [cat, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
                if (keywords.some(k => searchStr.includes(k))) {
                    category = cat;
                    console.log(`[Optimization] Local match for ${file.name}: ${cat}`);
                    break;
                }
            }

            // 2. If no local match, proceed with Heavy Lifting
            if (!category) {
                 // Extract Info
                 const [extractedText, pdfMeta] = await Promise.all([
                     getFirstPageText(file.data),
                     getPDFMetadata(file.data)
                 ]);

                 // Double check keywords with PDF Title if available
                 if (pdfMeta.title) {
                     const titleLower = pdfMeta.title.toLowerCase();
                     for (const [cat, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
                        if (keywords.some(k => titleLower.includes(k))) {
                            category = cat;
                            break;
                        }
                    }
                 }

                 // Still no category? Call AI.
                 if (!category) {
                     // Fetch subjects
                     let subjects: string[] = [];
                     const searchTitle = pdfMeta.title || file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
                     if (searchTitle.length > 3) {
                         subjects = await getBookSubjects(searchTitle);
                     }

                     const aiResult = await categorizeBook({
                         filename: file.name,
                         extractedText: extractedText,
                         title: pdfMeta.title,
                         author: pdfMeta.author,
                         openLibrarySubjects: subjects
                     });

                     if (aiResult.reason.includes("Quota Exceeded")) {
                         // QUOTA HIT: Push back to queue, wait, and continue
                         if (consecutiveErrors < 3) {
                             setOrganizeProgress(prev => ({ ...prev, status: "API Quota Limit. Pausing for 60s..." }));
                             console.warn("Quota Hit. Pausing queue...");
                             queue.unshift(file); // Put it back
                             await new Promise(r => setTimeout(r, 60000)); // 60s cooldown
                             consecutiveErrors++;
                             continue;
                         } else {
                             // Too many errors, skip this file or stop
                             setOrganizeProgress(prev => ({ ...prev, status: "Skipping file due to API limits." }));
                             consecutiveErrors = 0; // Reset for next file
                             category = "Unsorted";
                         }
                     } else {
                         category = aiResult.category;
                         consecutiveErrors = 0;
                     }
                 }
            }

            // 3. Move File
            if (category && category !== 'Unsorted') {
                 const targetId = await getTargetSectionId(category, sectionMap);
                 if (file.sectionId !== targetId) {
                     await updateFileSection(file.id, targetId);
                 }
            }

            // Standard Rate Limit Delay (only if we did an API call, but safe to do always)
            // If we did a local match, we can go faster, but let's keep it visually pleasant
            await new Promise(r => setTimeout(r, category ? 800 : 4000));

        } catch (e) {
            console.error("Processing failed for", file.name, e);
        }
    }

    // Cleanup
    await loadData();
    const allSectionIds = new Set(expandedSections);
    sectionMap.forEach(id => allSectionIds.add(id));
    setExpandedSections(allSectionIds);

    setOrganizeProgress(prev => ({ ...prev, status: "Complete!" }));
    setTimeout(() => {
        setIsOrganizing(false);
        setAbortController(null);
    }, 1500);
  };

  const cancelOrganization = () => {
    if (abortController) {
        abortController.abort();
        setIsOrganizing(false);
        setAbortController(null);
        loadData();
    }
  };
  // ------------------------------

  const getFilteredFiles = () => {
    if (!searchQuery) return files;
    const lowerQuery = searchQuery.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(lowerQuery));
  };

  const getSortedFiles = (fileList: RecentFile[]) => {
    return [...fileList].sort((a, b) => {
      if (sortBy === 'name') {
          // Natural Sort using Intl.Collator: Correctly handles "Book 2" before "Book 10"
          const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
          return collator.compare(a.name, b.name);
      }
      if (sortBy === 'size') return b.size - a.size;
      // Use dateAdded if available for stable import order, fallback to regular date
      return ((b as any).dateAdded || b.date) - ((a as any).dateAdded || a.date);
    });
  };

  const renderFileCard = (file: RecentFile) => {
    const isSelected = selectedIds.has(file.id);
    return (
      <div 
        key={file.id}
        onClick={() => isSelectionMode ? (selectedIds.has(file.id) ? selectedIds.delete(file.id) : selectedIds.add(file.id)) && setSelectedIds(new Set(selectedIds)) : (onSelectFile(file.data as any), onClose())}
        className={`group relative flex flex-col aspect-[3/4] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ring-1 ring-black/5 dark:ring-white/10 ${isSelected ? 'ring-4 ring-mblue dark:ring-gold scale-95' : ''}`}
      >
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
          {file.thumbnail ? (
            <img src={file.thumbnail} className={`w-full h-full object-cover transition-all duration-700 ${isSelected ? 'opacity-50 grayscale' : 'group-hover:scale-110 opacity-90 group-hover:opacity-100'}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-file-pdf text-4xl text-gray-300 dark:text-gray-700"></i></div>
          )}
          
          {isSelectionMode && (
             <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg ${isSelected ? 'bg-mblue dark:bg-gold text-white dark:text-black scale-110' : 'bg-black/40 border-2 border-white/50'}`}>
                {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
             </div>
          )}

          {!isSelectionMode && (
             <button 
                onClick={(e) => handleDeleteSingleFile(e, file.id)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-md hover:scale-110"
                title="Delete File"
             >
                <i className="fa-solid fa-trash-can text-xs"></i>
             </button>
          )}

        </div>
        <div className="p-4 bg-white dark:bg-gray-850 backdrop-blur-xl border-t dark:border-white/5">
          <h3 className="text-xs font-serif font-bold dark:text-gray-100 truncate">{file.name}</h3>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-sans">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            {file.sectionId && file.sectionId !== 'uncategorized' && (
               <i className="fa-solid fa-folder text-[9px] text-mblue dark:text-gold opacity-70"></i>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const currentFiles = getFilteredFiles();
  const sortedAllFiles = getSortedFiles(currentFiles);
  
  const groupedFiles: Record<string, RecentFile[]> = { 
    uncategorized: getSortedFiles(currentFiles.filter(f => !f.sectionId || f.sectionId === 'uncategorized')) 
  };
  sections.forEach(s => groupedFiles[s.id] = getSortedFiles(currentFiles.filter(f => f.sectionId === s.id)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="bg-paper dark:bg-darkbg w-full h-full md:h-[90vh] md:w-[90vw] md:max-w-6xl md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative border border-white/10 dark:border-white/5">
        
        {/* Header */}
        <div className="px-6 py-5 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/50 dark:bg-black/50 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 sticky top-0 z-10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h2 className="text-2xl font-serif font-bold dark:text-gold tracking-tight whitespace-nowrap">Archives</h2>
            
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
               <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
               <input 
                  type="text" 
                  placeholder="Search documents..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100/50 dark:bg-white/5 border border-transparent focus:border-mblue dark:focus:border-gold rounded-xl py-2 pl-9 pr-3 text-xs outline-none transition-all"
               />
               {searchQuery && (
                 <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                    <i className="fa-solid fa-times text-xs"></i>
                 </button>
               )}
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar">
             {!isSelectionMode && !isOrganizing && (
               <>
                 <button 
                   onClick={handleAutoOrganize}
                   className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-gradient-to-r from-purple-500/20 to-mblue/20 dark:from-purple-500/20 dark:to-gold/20 text-purple-600 dark:text-gold border border-purple-500/30 dark:border-gold/30 hover:scale-105 flex items-center gap-2 whitespace-nowrap"
                 >
                   <i className="fa-solid fa-wand-magic-sparkles"></i>
                   <span className="hidden sm:inline">Smart Sort</span>
                 </button>
                <button 
                  onClick={() => setShowCreateFolderInput(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20 flex items-center gap-2 whitespace-nowrap"
                >
                  <i className="fa-solid fa-folder-plus"></i>
                  <span className="hidden sm:inline">New Folder</span>
                </button>
               </>
             )}
             <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${isSelectionMode ? 'bg-mblue dark:bg-gold text-white dark:text-black border-transparent shadow-lg' : 'bg-transparent border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-300'}`}>
               {isSelectionMode ? 'Cancel' : 'Select'}
             </button>
             <button onClick={onClose} className="w-9 h-9 flex-shrink-0 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><i className="fa-solid fa-times text-xs"></i></button>
          </div>
        </div>

        {/* Folder Creation Input */}
        {showCreateFolderInput && (
          <div className="absolute top-20 left-0 right-0 z-30 flex justify-center animate-slide-down">
             <div className="bg-white dark:bg-black border border-gray-200 dark:border-gold/30 p-4 rounded-2xl shadow-xl flex gap-2 w-full max-w-md mx-4">
                <input 
                  autoFocus
                  placeholder="Enter Folder Name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualCreateFolder()}
                  className="flex-1 bg-gray-50 dark:bg-white/10 rounded-xl px-4 py-2 text-sm outline-none border border-transparent focus:border-mblue dark:focus:border-gold"
                />
                <button onClick={handleManualCreateFolder} className="bg-black dark:bg-white text-white dark:text-black px-4 rounded-xl text-xs font-bold uppercase">Create</button>
                <button onClick={() => setShowCreateFolderInput(false)} className="text-gray-400 hover:text-red-500 px-2"><i className="fa-solid fa-times"></i></button>
             </div>
          </div>
        )}

        {/* Tabs */}
        {!isSelectionMode && !searchQuery && (
          <div className="px-6 py-2 flex gap-6 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-black/30">
             <button onClick={() => setActiveTab('all')} className={`text-xs font-bold uppercase tracking-widest py-2 border-b-2 transition-all ${activeTab === 'all' ? 'border-mblue dark:border-gold text-mblue dark:text-gold' : 'border-transparent text-gray-400'}`}>Recents</button>
             <button onClick={() => setActiveTab('folders')} className={`text-xs font-bold uppercase tracking-widest py-2 border-b-2 transition-all ${activeTab === 'folders' ? 'border-mblue dark:border-gold text-mblue dark:text-gold' : 'border-transparent text-gray-400'}`}>Folders</button>
          </div>
        )}
        
        {/* Search Results Label */}
        {searchQuery && (
          <div className="px-6 py-3 bg-mblue/5 dark:bg-gold/5 border-b border-mblue/10 dark:border-gold/10">
             <p className="text-xs font-bold uppercase tracking-widest text-mblue dark:text-gold">
               Found {currentFiles.length} matches
             </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-10 scrollbar-hide relative">
           
           {/* Non-blocking Progress Toast */}
           {isOrganizing && (
             <div className="absolute bottom-4 right-4 z-20 bg-white dark:bg-black border border-mblue dark:border-gold shadow-2xl p-4 rounded-xl flex items-center gap-4 animate-slide-up max-w-xs ring-1 ring-black/5">
                 <div className="w-8 h-8 relative flex-shrink-0">
                    <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-800"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 dark:border-t-gold animate-spin"></div>
                 </div>
                 <div className="flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold dark:text-gold">Organizing Library...</h4>
                      <button onClick={cancelOrganization} className="text-[9px] text-red-500 hover:text-red-600 uppercase font-bold">Stop</button>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate w-48">{organizeProgress.status}</p>
                    <div className="w-full bg-gray-200 dark:bg-white/10 h-1 mt-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 dark:bg-gold transition-all duration-300"
                          style={{ width: `${(organizeProgress.current / organizeProgress.total) * 100}%` }}
                        ></div>
                    </div>
                 </div>
             </div>
           )}

           {loading ? (
             <div className="flex justify-center py-20"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-mblue dark:text-gold"></i></div>
           ) : (
             <>
                {/* Recent View / Search Results */}
                {(activeTab === 'all' || !!searchQuery) && !isSelectionMode && (
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5 animate-fade-in">
                      {sortedAllFiles.map(renderFileCard)}
                      {sortedAllFiles.length === 0 && <p className="col-span-full text-center py-10 text-gray-400">No documents found.</p>}
                   </div>
                )}

                {/* Folder View (or Selection Mode Force View) - Hidden if searching unless filtered */}
                {((activeTab === 'folders' && !searchQuery) || isSelectionMode) && (
                  <div className="space-y-8 animate-slide-up">
                    {/* Folders */}
                    {sections.sort((a,b) => a.name.localeCompare(b.name)).map(section => {
                        const sFiles = groupedFiles[section.id] || [];
                        if (!sFiles.length && !isSelectionMode) return null;
                        return (
                          <div key={section.id} className="bg-gray-50/50 dark:bg-white/5 rounded-3xl p-5 border border-transparent dark:border-white/5 transition-all">
                            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection(section.id)}>
                               <div className="flex items-center gap-3">
                                  <i className={`fa-solid ${expandedSections.has(section.id) ? 'fa-folder-open' : 'fa-folder'} text-mblue dark:text-gold text-lg`}></i>
                                  <h3 className="text-sm font-black uppercase tracking-wider dark:text-gray-200">{section.name}</h3>
                                  <span className="text-[10px] bg-white dark:bg-black px-2 py-0.5 rounded-full shadow-sm text-gray-500">{sFiles.length}</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  {!isSelectionMode && <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }} className="text-gray-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>}
                                  <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-180' : ''}`}></i>
                               </div>
                            </div>
                            {expandedSections.has(section.id) && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 animate-fade-in">
                                  {sFiles.map(renderFileCard)}
                                  {sFiles.length === 0 && <p className="col-span-full text-center py-4 text-xs text-gray-400 italic">Folder Empty</p>}
                              </div>
                            )}
                          </div>
                        );
                    })}

                    {/* Uncategorized */}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => toggleSection('uncategorized')}>
                         <i className="fa-solid fa-box-archive text-gray-400"></i>
                         <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Uncategorized</h3>
                         <div className="h-px flex-1 bg-gray-200 dark:bg-white/10"></div>
                         <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${expandedSections.has('uncategorized') ? 'rotate-180' : ''}`}></i>
                      </div>
                      {expandedSections.has('uncategorized') && (
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                            {groupedFiles.uncategorized.map(renderFileCard)}
                         </div>
                      )}
                    </div>
                  </div>
                )}
             </>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-white/80 dark:bg-black/90 backdrop-blur-xl border-t border-gray-100 dark:border-white/10 flex justify-between items-center absolute bottom-0 w-full z-20">
           {!isSelectionMode ? (
             <label className="flex items-center justify-center w-full gap-3 cursor-pointer group py-2">
                <div className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                   <i className="fa-solid fa-plus"></i>
                </div>
                <span className="font-bold text-xs uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity">Add Documents</span>
                <input type="file" multiple accept="application/pdf" className="hidden" onChange={(e) => handleImport(e)} />
             </label>
           ) : (
             <div className="flex gap-3 w-full animate-slide-up">
                <div className="flex-1 flex items-center justify-center font-bold text-xs uppercase tracking-widest dark:text-gold">
                   {selectedIds.size} Selected
                </div>
                <button onClick={() => setShowBatchMove(true)} disabled={!selectedIds.size} className="flex-1 py-3 bg-mblue dark:bg-gold text-white dark:text-black rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg disabled:opacity-50 disabled:shadow-none hover:scale-[1.02] transition-all">
                   Move to Folder
                </button>
                <button onClick={() => handleBatchDelete()} disabled={!selectedIds.size} className="flex-1 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold uppercase tracking-wider text-xs border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
                   Delete
                </button>
             </div>
           )}
        </div>

        {/* Batch Move Overlay */}
        {showBatchMove && (
          <div className="absolute inset-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in">
             <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-widest dark:text-gold">Select Destination</h3>
                <button onClick={() => setShowBatchMove(false)} className="text-gray-400 hover:text-red-500"><i className="fa-solid fa-times"></i></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-2">
                <button 
                  onClick={() => handleBatchMove('uncategorized')}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group text-left"
                >
                   <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center"><i className="fa-solid fa-box-archive text-gray-500"></i></div>
                   <span className="font-bold text-sm dark:text-gray-200 group-hover:text-mblue dark:group-hover:text-gold">Uncategorized Archive</span>
                </button>

                {sections.map(s => (
                   <button 
                    key={s.id}
                    onClick={() => handleBatchMove(s.id)}
                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group text-left"
                  >
                     <div className="w-10 h-10 rounded-full bg-mblue/10 dark:bg-gold/10 flex items-center justify-center"><i className="fa-solid fa-folder text-mblue dark:text-gold"></i></div>
                     <span className="font-bold text-sm dark:text-gray-200 group-hover:text-mblue dark:group-hover:text-gold">{s.name}</span>
                  </button>
                ))}
             </div>

             <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Or Create New Folder</label>
                <div className="flex gap-2">
                   <input 
                      value={newFolderInBatch}
                      onChange={(e) => setNewFolderInBatch(e.target.value)}
                      placeholder="Folder Name..."
                      className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 text-sm outline-none focus:border-mblue dark:focus:border-gold"
                   />
                   <button 
                      onClick={handleCreateAndMove}
                      disabled={!newFolderInBatch.trim()}
                      className="px-6 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold uppercase text-xs tracking-wider disabled:opacity-50"
                   >
                      Move Here
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};