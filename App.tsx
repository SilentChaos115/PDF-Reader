import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { Controls } from './components/Controls';
import { ReaderView } from './components/ReaderView';
import { NotesPanel } from './components/NotesPanel';
import { BookmarksList } from './components/BookmarksList';
import { SettingsModal } from './components/SettingsModal';
import { GeminiAssistant } from './components/GeminiAssistant';
import { LibraryModal } from './components/LibraryModal';
import { AudioPlayer } from './components/AudioPlayer';
import { DraggableFab } from './components/DraggableFab';
import { loadPDF, generatePDFThumbnail } from './services/pdfHelper';
import { saveFileToLibrary, updateFileDate, updateFileSection, resetAppDatabase } from './services/db';
import { PDFDocumentProxy, AppView, Highlight, GeminiModel, ChatMessage, AudioCursor, HighlightStyle } from './types';

export default function App() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [darkMode, setDarkMode] = useState(true);
  const [activeView, setActiveView] = useState<AppView>(AppView.READER);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // UI Visibility State (for immersive reading)
  const [uiVisible, setUiVisible] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true); // Open library by default if no file
  
  const [enableGemini, setEnableGemini] = useState(true);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-3-flash-preview');
  const [isGeminiChatOpen, setIsGeminiChatOpen] = useState(false);
  const [doubleTapEnabled, setDoubleTapEnabled] = useState(true);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [fitToScreenTrigger, setFitToScreenTrigger] = useState(0);
  
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [audioCursor, setAudioCursor] = useState<AudioCursor | undefined>();
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(false);
  const [audioSettings, setAudioSettings] = useState({ speed: 1.0, voice: '' });
  
  const [highlighterColor, setHighlighterColor] = useState<string | null>(null);
  const [highlighterStyle, setHighlighterStyle] = useState<HighlightStyle>('full');
  const [eraserMode, setEraserMode] = useState(false);
  
  const [geminiInitialMessage, setGeminiInitialMessage] = useState<{text: string, type: 'summarize' | 'explain'} | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const savedSettings = localStorage.getItem('zen_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.enableGemini !== undefined) setEnableGemini(settings.enableGemini);
        if (settings.selectedModel !== undefined) setSelectedModel(settings.selectedModel);
        if (settings.doubleTapEnabled !== undefined) setDoubleTapEnabled(settings.doubleTapEnabled);
        if (settings.swipeEnabled !== undefined) setSwipeEnabled(settings.swipeEnabled);
        if (settings.audioSettings !== undefined) setAudioSettings(settings.audioSettings);
        if (settings.highlighterColor !== undefined) setHighlighterColor(settings.highlighterColor);
        if (settings.highlighterStyle !== undefined) setHighlighterStyle(settings.highlighterStyle);
        if (settings.eraserMode !== undefined) setEraserMode(settings.eraserMode);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const settings = { 
      enableGemini, selectedModel, doubleTapEnabled, swipeEnabled, 
      audioSettings, highlighterColor, highlighterStyle, eraserMode 
    };
    localStorage.setItem('zen_settings', JSON.stringify(settings));
  }, [enableGemini, selectedModel, doubleTapEnabled, swipeEnabled, audioSettings, highlighterColor, highlighterStyle, eraserMode]);

  useEffect(() => {
    if (fileName && fileSize > 0) {
      const storageKey = `zenreader_${fileName}_${fileSize}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setBookmarks(data.bookmarks || []);
          setNotes(data.notes || '');
          setHighlights(data.highlights || []);
          setChatHistory(data.chatHistory || [{ role: 'model', text: 'Hi! I can help you summarize this page or answer questions about it.' }]);
          setAudioCursor(data.audioCursor);
          if (data.lastPage) setPageNumber(data.lastPage);
        } catch (e) {}
      } else {
        setBookmarks([]); setNotes(''); setHighlights([]); 
        setChatHistory([{ role: 'model', text: 'Hi! I can help you summarize this page or answer questions about it.' }]);
        setAudioCursor(undefined); setPageNumber(1);
      }
    }
  }, [fileName, fileSize]);

  useEffect(() => {
    if (fileName && fileSize > 0) {
      const storageKey = `zenreader_${fileName}_${fileSize}`;
      localStorage.setItem(storageKey, JSON.stringify({ 
        bookmarks, notes, lastPage: pageNumber, highlights, chatHistory, audioCursor 
      }));
    }
  }, [bookmarks, notes, pageNumber, fileName, fileSize, highlights, chatHistory, audioCursor]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const loadFile = async (file: File, sectionId?: string) => {
    try {
      const id = `${file.name}_${file.size}`;
      setFileName(file.name); setFileSize(file.size);
      const doc = await loadPDF(file);
      setPdfDoc(doc); setNumPages(doc.numPages);
      setActiveView(AppView.READER); setIsFullScreen(false);
      const thumb = await generatePDFThumbnail(doc);
      await saveFileToLibrary(file, thumb);
      if (sectionId) {
        await updateFileSection(id, sectionId);
      }
      await updateFileDate(id);
      setIsLibraryOpen(false);
    } catch (error) { alert("Could not load PDF."); }
  };

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) setPageNumber(newPage);
  }, [numPages]);

  const toggleBookmark = () => setBookmarks(prev => prev.includes(pageNumber) ? prev.filter(p => p !== pageNumber) : [...prev, pageNumber]);
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    setUiVisible(!isFullScreen); // Hide UI when entering fullscreen
  };

  const fileId = fileName ? `${fileName}_${fileSize}` : "";

  // Helper to toggle UI visibility on tap
  const toggleUi = () => setUiVisible(!uiVisible);

  // Safe State Reset for Total Vault Reset
  const handleTotalReset = async () => {
    // 1. Unload PDF immediately to release file locks / prevent "file moved" errors
    if (pdfDoc) {
        try {
            pdfDoc.destroy();
        } catch(e) {}
    }
    setPdfDoc(null);
    setFileName(null);
    setFileSize(0);
    setPageNumber(1);
    setIsAudioPlayerVisible(false);
    
    // 2. Perform DB Wipe
    const success = await resetAppDatabase();
    
    // 3. Reset UI State (Safety Fallback)
    setBookmarks([]);
    setNotes('');
    setHighlights([]);
    setChatHistory([]);
    setAudioCursor(undefined);
    
    // 4. Return to "Landing" State
    setIsSettingsOpen(false);
    setIsLibraryOpen(true);
    
    if (!success) {
        // Fallback message if DB wipe had issues, but UI state is still cleared
        alert("Reset completed with warnings. Default settings restored.");
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-paper dark:bg-darkbg text-gray-900 dark:text-white">
      
      {/* Background/Main Content Layer */}
      <main className="absolute inset-0 z-0 flex flex-col">
        {activeView === AppView.READER && (
          <div className="flex-1 w-full h-full relative" onClick={(e) => { 
             // If clicking clearly on the background/canvas, toggle UI
             if ((e.target as HTMLElement).tagName !== 'BUTTON') toggleUi();
          }}>
            <ReaderView 
              pdfDoc={pdfDoc} pageNumber={pageNumber} scale={scale} setNumPages={setNumPages} darkMode={darkMode}
              highlights={highlights} isBookmarked={bookmarks.includes(pageNumber)} 
              highlighterColor={highlighterColor} setHighlighterColor={setHighlighterColor}
              highlighterStyle={highlighterStyle} setHighlighterStyle={setHighlighterStyle}
              eraserMode={eraserMode} setEraserMode={setEraserMode}
              onContextMenuAction={(a) => { 
                if(a === 'bookmark') toggleBookmark(); 
                else if(a === 'note') setActiveView(AppView.NOTES); 
                else setHighlighterColor(darkMode ? '#C5A059' : '#5B7C99'); 
              }}
              onSummarizeSelection={(t) => { setEnableGemini(true); setGeminiInitialMessage({text: t, type: 'summarize'}); setIsGeminiChatOpen(true); }}
              onExplainSelection={(t) => { setEnableGemini(true); setGeminiInitialMessage({text: t, type: 'explain'}); setIsGeminiChatOpen(true); }}
              onAddHighlight={(r,t,c,s,o) => setHighlights(prev => [...prev, { id: Date.now().toString(), page: pageNumber, rects: r, color: c, text: t, style: s, opacity: o }])}
              onRemoveHighlight={(id) => setHighlights(prev => prev.filter(h => h.id !== id))}
              isFullScreen={isFullScreen} toggleFullScreen={toggleFullScreen} onZoomChange={setScale}
              doubleTapEnabled={doubleTapEnabled} fitToScreenTrigger={fitToScreenTrigger} swipeEnabled={swipeEnabled} onPageChange={handlePageChange}
            />
          </div>
        )}
        {activeView === AppView.NOTES && (
          <div className="flex-1 w-full h-full pt-20 pb-24">
             <NotesPanel 
                notes={notes} updateNotes={setNotes} pdfDoc={pdfDoc} pageNumber={pageNumber} highlights={highlights} 
                goToPage={(p) => { handlePageChange(p); setActiveView(AppView.READER); }} 
                deleteHighlight={(id) => setHighlights(prev => prev.filter(h => h.id !== id))} 
            />
          </div>
        )}
        {activeView === AppView.BOOKMARKS && (
          <div className="flex-1 w-full h-full pt-20 pb-24">
            <BookmarksList 
                bookmarks={bookmarks} 
                goToPage={(p) => { handlePageChange(p); setActiveView(AppView.READER); }} 
                removeBookmark={(p) => setBookmarks(prev => prev.filter(b => b !== p))} 
            />
          </div>
        )}
      </main>

      {/* Floating UI Layer */}
      {/* Top Header */}
      <TopBar 
        visible={uiVisible}
        fileName={fileName} pageNumber={pageNumber} numPages={numPages} 
        onOpenLibrary={() => setIsLibraryOpen(true)} 
        isBookmarked={bookmarks.includes(pageNumber)} 
        toggleBookmark={toggleBookmark} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        isAudioActive={isAudioPlayerVisible}
        onToggleAudio={() => setIsAudioPlayerVisible(!isAudioPlayerVisible)}
      />

      {/* Bottom Dock */}
      <Controls 
        visible={uiVisible}
        pageNumber={pageNumber} numPages={numPages} scale={scale} 
        activeView={activeView} setActiveView={setActiveView} 
        onPageChange={handlePageChange} onZoomChange={setScale} 
        hasFile={!!pdfDoc} doubleTapEnabled={doubleTapEnabled} 
        toggleFullScreen={toggleFullScreen} 
        onFitToScreen={() => setFitToScreenTrigger(prev => prev + 1)}
        onOpenAI={() => setIsGeminiChatOpen(true)}
      />

      {/* Gemini Overlay Button (Draggable) */}
      {enableGemini && pdfDoc && !isGeminiChatOpen && (
        <DraggableFab 
          onClick={() => setIsGeminiChatOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full metallic-blue-bg dark:metallic-gold-bg shadow-2xl flex items-center justify-center text-white dark:text-black hover:scale-110 active:scale-95 transition-transform"
        >
           <i className="fa-solid fa-sparkles text-xl animate-pulse"></i>
           <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
        </DraggableFab>
      )}

      {/* Overlays / Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
        darkMode={darkMode}
        enableGemini={enableGemini} setEnableGemini={setEnableGemini}
        doubleTapEnabled={doubleTapEnabled} setDoubleTapEnabled={setDoubleTapEnabled}
        swipeEnabled={swipeEnabled} setSwipeEnabled={setSwipeEnabled}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
        audioSettings={audioSettings} setAudioSettings={setAudioSettings}
        onReset={handleTotalReset}
      />

      <LibraryModal 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)} 
        onSelectFile={loadFile} 
        onImportNew={async (e, sectionId) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          const processFile = async (file: File) => {
             try {
                const doc = await loadPDF(file);
                const thumb = await generatePDFThumbnail(doc);
                const id = `${file.name}_${file.size}`;
                await saveFileToLibrary(file, thumb);
                if (sectionId) await updateFileSection(id, sectionId);
                return { doc, id };
             } catch(err) {
                console.error("Error importing " + file.name, err);
                return null;
             }
          };
          if (files.length === 1) {
             await loadFile(files[0], sectionId);
          } else {
             for (let i = 0; i < files.length; i++) await processFile(files[i]);
          }
        }} 
      />

      {enableGemini && (
        <GeminiAssistant 
          pdfDoc={pdfDoc} pageNumber={pageNumber} isOpen={isGeminiChatOpen} onClose={() => setIsGeminiChatOpen(false)}
          initialMessage={geminiInitialMessage?.text || null} 
          initialType={geminiInitialMessage?.type || 'summarize'}
          onInitialMessageHandled={() => setGeminiInitialMessage(null)}
          selectedModel={selectedModel}
          history={chatHistory}
          onUpdateHistory={setChatHistory}
        />
      )}

      {isAudioPlayerVisible && pdfDoc && (
        <AudioPlayer 
          pdfDoc={pdfDoc} 
          fileName={fileName || "Document"}
          fileId={fileId}
          pageNumber={pageNumber} 
          onPageChange={handlePageChange}
          cursor={audioCursor}
          onCursorChange={setAudioCursor}
          settings={audioSettings}
          onSettingsChange={setAudioSettings}
          onClose={() => setIsAudioPlayerVisible(false)}
        />
      )}
    </div>
  );
}