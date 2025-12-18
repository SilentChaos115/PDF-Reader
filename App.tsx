import React, { useEffect, useState, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Controls } from './components/Controls';
import { ReaderView } from './components/ReaderView';
import { NotesPanel } from './components/NotesPanel';
import { BookmarksList } from './components/BookmarksList';
import { SettingsModal } from './components/SettingsModal';
import { GeminiAssistant } from './components/GeminiAssistant';
import { LibraryModal } from './components/LibraryModal';
import { DraggableFab } from './components/DraggableFab';
import { loadPDF, generatePDFThumbnail } from './services/pdfHelper';
import { saveFileToLibrary } from './services/db';
import { PDFDocumentProxy, AppView, StoredFileMeta, Highlight, HighlightStyle, GoogleUser } from './types';
import { chatWithDocument } from './services/gemini';

export default function App() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(AppView.READER);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Settings & Features
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [enableGemini, setEnableGemini] = useState(false);
  const [isGeminiChatOpen, setIsGeminiChatOpen] = useState(false);
  const [doubleTapEnabled, setDoubleTapEnabled] = useState(true);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  
  // Interaction Triggers
  const [fitToScreenTrigger, setFitToScreenTrigger] = useState(0);
  
  // Persistence Data
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Highlighter Tool State
  const [highlighterColor, setHighlighterColor] = useState<string | null>(null);

  // Gemini Initial Message
  const [geminiInitialMessage, setGeminiInitialMessage] = useState<string | null>(null);

  // --- Effects ---

  useEffect(() => {
    if (fileName && fileSize > 0) {
      const storageKey = `zenreader_${fileName}_${fileSize}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data: StoredFileMeta = JSON.parse(saved);
          setBookmarks(data.bookmarks || []);
          setNotes(data.notes || '');
          setHighlights(data.highlights || []);
          if (data.lastPage) setPageNumber(data.lastPage);
        } catch (e) {
          console.error("Failed to load saved data");
        }
      } else {
        setBookmarks([]);
        setNotes('');
        setHighlights([]);
        setPageNumber(1);
      }
    }
  }, [fileName, fileSize]);

  useEffect(() => {
    if (fileName && fileSize > 0) {
      const storageKey = `zenreader_${fileName}_${fileSize}`;
      const data: StoredFileMeta = {
        bookmarks,
        notes,
        lastPage: pageNumber,
        highlights
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
  }, [bookmarks, notes, pageNumber, fileName, fileSize, highlights]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Handlers ---

  const loadFile = async (file: File) => {
    try {
      setFileName(file.name);
      setFileSize(file.size);
      const doc = await loadPDF(file);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setActiveView(AppView.READER);
      setIsFullScreen(false);
      
      // Generate Thumbnail and Save
      const thumb = await generatePDFThumbnail(doc);
      await saveFileToLibrary(file, thumb);
      
    } catch (error) {
      console.error("Error loading PDF:", error);
      alert("Could not load PDF file.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadFile(file);
    }
  };

  const handleLibrarySelect = async (file: File) => {
    await loadFile(file);
  };

  const handleGoogleDriveOpen = () => {
    alert("Google Drive integration placeholder.");
  };

  const handleGoogleSignIn = () => {
    setGoogleUser({
      name: "Demo User",
      email: "user@example.com",
      picture: ""
    });
  };

  const handleGoogleSignOut = () => {
    setGoogleUser(null);
  };

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
    }
  }, [numPages]);

  const toggleBookmark = () => {
    setBookmarks(prev => {
      if (prev.includes(pageNumber)) {
        return prev.filter(p => p !== pageNumber);
      }
      return [...prev, pageNumber];
    });
  };

  const handleGotoPage = (page: number) => {
    handlePageChange(page);
    setActiveView(AppView.READER);
    if(isFullScreen) setIsFullScreen(false);
  };

  const handleContextMenuAction = (action: 'bookmark' | 'note' | 'highlighter') => {
    if (action === 'bookmark') {
      toggleBookmark();
    } else if (action === 'note') {
      setActiveView(AppView.NOTES);
      setIsFullScreen(false);
      setNotes(prev => {
        const timestamp = new Date().toLocaleTimeString();
        const header = `\n\n[Page ${pageNumber} - ${timestamp}]: `;
        return prev ? prev + header : header.trimStart();
      });
    } else if (action === 'highlighter') {
      setHighlighterColor('#fde047');
    }
  };

  const handleSummarizeSelection = (text: string) => {
    setEnableGemini(true);
    setGeminiInitialMessage(text);
    setIsGeminiChatOpen(true);
  };

  const saveHighlight = (rects: {x:number, y:number, width:number, height:number}[], text: string, color: string, style?: HighlightStyle, opacity?: number) => {
     const newHighlight: Highlight = {
       id: Date.now().toString(),
       page: pageNumber,
       rects,
       color,
       text,
       style: style || 'full',
       opacity: opacity || 0.4
     };
     setHighlights(prev => [...prev, newHighlight]);
  };

  const removeHighlight = (id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  return (
    <>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        googleUser={googleUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        enableGemini={enableGemini}
        setEnableGemini={setEnableGemini}
        doubleTapEnabled={doubleTapEnabled}
        setDoubleTapEnabled={setDoubleTapEnabled}
        swipeEnabled={swipeEnabled}
        setSwipeEnabled={setSwipeEnabled}
      />

      <LibraryModal 
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectFile={handleLibrarySelect}
        onImportNew={handleFileUpload}
      />

      {enableGemini && (
        <>
          <GeminiAssistant 
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            isOpen={isGeminiChatOpen}
            onClose={() => setIsGeminiChatOpen(false)}
            initialMessage={geminiInitialMessage}
            onInitialMessageHandled={() => setGeminiInitialMessage(null)}
          />
          {!isGeminiChatOpen && activeView === AppView.READER && (
            <DraggableFab 
              onClick={() => setIsGeminiChatOpen(true)}
              className="fixed bottom-24 right-4 w-12 h-12 bg-gradient-to-tr from-teal-500/80 to-emerald-500/80 backdrop-blur-sm rounded-full text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform animate-in zoom-in ring-1 ring-white/20"
            >
              <i className="fa-solid fa-spa"></i>
            </DraggableFab>
          )}
        </>
      )}

      {!isFullScreen && (
        <TopBar 
          fileName={fileName}
          pageNumber={pageNumber}
          numPages={numPages}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          isBookmarked={bookmarks.includes(pageNumber)}
          toggleBookmark={toggleBookmark}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenDrive={handleGoogleDriveOpen}
        />
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeView === AppView.READER && (
          <ReaderView 
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            scale={scale}
            setNumPages={setNumPages}
            darkMode={darkMode}
            highlights={highlights}
            isBookmarked={bookmarks.includes(pageNumber)}
            highlighterColor={highlighterColor}
            setHighlighterColor={setHighlighterColor}
            onContextMenuAction={handleContextMenuAction}
            onSummarizeSelection={handleSummarizeSelection}
            onAddHighlight={saveHighlight}
            onRemoveHighlight={removeHighlight}
            isFullScreen={isFullScreen}
            toggleFullScreen={() => setIsFullScreen(!isFullScreen)}
            onZoomChange={setScale}
            doubleTapEnabled={doubleTapEnabled}
            fitToScreenTrigger={fitToScreenTrigger}
            swipeEnabled={swipeEnabled}
            onPageChange={handlePageChange}
          />
        )}

        {activeView === AppView.NOTES && (
          <NotesPanel 
            notes={notes}
            updateNotes={setNotes}
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            highlights={highlights}
            goToPage={handleGotoPage}
            deleteHighlight={removeHighlight}
          />
        )}

        {activeView === AppView.BOOKMARKS && (
          <BookmarksList 
            bookmarks={bookmarks}
            goToPage={handleGotoPage}
            removeBookmark={(p) => setBookmarks(prev => prev.filter(b => b !== p))}
          />
        )}
      </main>

      {!isFullScreen && (
        <Controls 
          pageNumber={pageNumber}
          numPages={numPages}
          scale={scale}
          activeView={activeView}
          setActiveView={setActiveView}
          onPageChange={handlePageChange}
          onZoomChange={setScale}
          hasFile={!!pdfDoc}
          doubleTapEnabled={doubleTapEnabled}
          toggleFullScreen={() => setIsFullScreen(!isFullScreen)}
          onFitToScreen={() => setFitToScreenTrigger(prev => prev + 1)}
        />
      )}
    </>
  );
}