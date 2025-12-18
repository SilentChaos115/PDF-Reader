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
import { PDFDocumentProxy, AppView, Highlight, GeminiModel, ChatMessage } from './types';

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
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
  const [enableGemini, setEnableGemini] = useState(false);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-3-flash-preview');
  const [isGeminiChatOpen, setIsGeminiChatOpen] = useState(false);
  const [doubleTapEnabled, setDoubleTapEnabled] = useState(true);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [fitToScreenTrigger, setFitToScreenTrigger] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [highlighterColor, setHighlighterColor] = useState<string | null>(null);
  const [geminiInitialMessage, setGeminiInitialMessage] = useState<string | null>(null);

  // Automatic Theme Detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Load global settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('zen_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.enableGemini !== undefined) setEnableGemini(settings.enableGemini);
        if (settings.selectedModel !== undefined) setSelectedModel(settings.selectedModel);
        if (settings.doubleTapEnabled !== undefined) setDoubleTapEnabled(settings.doubleTapEnabled);
        if (settings.swipeEnabled !== undefined) setSwipeEnabled(settings.swipeEnabled);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  // Save global settings
  useEffect(() => {
    const settings = { enableGemini, selectedModel, doubleTapEnabled, swipeEnabled };
    localStorage.setItem('zen_settings', JSON.stringify(settings));
  }, [enableGemini, selectedModel, doubleTapEnabled, swipeEnabled]);

  // Load file data including chat history
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
          if (data.lastPage) setPageNumber(data.lastPage);
        } catch (e) {}
      } else {
        setBookmarks([]); 
        setNotes(''); 
        setHighlights([]); 
        setChatHistory([{ role: 'model', text: 'Hi! I can help you summarize this page or answer questions about it.' }]);
        setPageNumber(1);
      }
    }
  }, [fileName, fileSize]);

  // Save file data
  useEffect(() => {
    if (fileName && fileSize > 0) {
      const storageKey = `zenreader_${fileName}_${fileSize}`;
      localStorage.setItem(storageKey, JSON.stringify({ 
        bookmarks, 
        notes, 
        lastPage: pageNumber, 
        highlights,
        chatHistory 
      }));
    }
  }, [bookmarks, notes, pageNumber, fileName, fileSize, highlights, chatHistory]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const loadFile = async (file: File) => {
    try {
      setFileName(file.name); setFileSize(file.size);
      const doc = await loadPDF(file);
      setPdfDoc(doc); setNumPages(doc.numPages);
      setActiveView(AppView.READER); setIsFullScreen(false);
      const thumb = await generatePDFThumbnail(doc);
      await saveFileToLibrary(file, thumb);
    } catch (error) { alert("Could not load PDF."); }
  };

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) setPageNumber(newPage);
  }, [numPages]);

  const toggleBookmark = () => setBookmarks(prev => prev.includes(pageNumber) ? prev.filter(p => p !== pageNumber) : [...prev, pageNumber]);

  return (
    <>
      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
        darkMode={darkMode}
        enableGemini={enableGemini} setEnableGemini={setEnableGemini}
        doubleTapEnabled={doubleTapEnabled} setDoubleTapEnabled={setDoubleTapEnabled}
        swipeEnabled={swipeEnabled} setSwipeEnabled={setSwipeEnabled}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
      />

      <LibraryModal 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)} 
        onSelectFile={loadFile} 
        onImportNew={async (e) => {
          if (e.target.files?.[0]) await loadFile(e.target.files[0]);
        }} 
      />

      {enableGemini && (
        <>
          <GeminiAssistant 
            pdfDoc={pdfDoc} pageNumber={pageNumber} isOpen={isGeminiChatOpen} onClose={() => setIsGeminiChatOpen(false)}
            initialMessage={geminiInitialMessage} onInitialMessageHandled={() => setGeminiInitialMessage(null)}
            selectedModel={selectedModel}
            history={chatHistory}
            onUpdateHistory={setChatHistory}
          />
          {!isGeminiChatOpen && activeView === AppView.READER && (
            <DraggableFab onClick={() => setIsGeminiChatOpen(true)} className="fixed bottom-24 right-4 w-12 h-12 bg-gradient-to-tr from-teal-500/80 to-emerald-500/80 backdrop-blur-sm rounded-full text-white shadow-lg flex items-center justify-center ring-1 ring-white/20">
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
        />
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeView === AppView.READER && (
          <ReaderView 
            pdfDoc={pdfDoc} pageNumber={pageNumber} scale={scale} setNumPages={setNumPages} darkMode={darkMode}
            highlights={highlights} isBookmarked={bookmarks.includes(pageNumber)} highlighterColor={highlighterColor} setHighlighterColor={setHighlighterColor}
            onContextMenuAction={(a) => { if(a === 'bookmark') toggleBookmark(); else if(a === 'note') setActiveView(AppView.NOTES); else setHighlighterColor('#fde047'); }}
            onSummarizeSelection={(t) => { setEnableGemini(true); setGeminiInitialMessage(t); setIsGeminiChatOpen(true); }}
            onAddHighlight={(r,t,c,s,o) => setHighlights(prev => [...prev, { id: Date.now().toString(), page: pageNumber, rects: r, color: c, text: t, style: s, opacity: o }])}
            onRemoveHighlight={(id) => setHighlights(prev => prev.filter(h => h.id !== id))}
            isFullScreen={isFullScreen} toggleFullScreen={() => setIsFullScreen(!isFullScreen)} onZoomChange={setScale}
            doubleTapEnabled={doubleTapEnabled} fitToScreenTrigger={fitToScreenTrigger} swipeEnabled={swipeEnabled} onPageChange={handlePageChange}
          />
        )}
        {activeView === AppView.NOTES && <NotesPanel notes={notes} updateNotes={setNotes} pdfDoc={pdfDoc} pageNumber={pageNumber} highlights={highlights} goToPage={(p) => { handlePageChange(p); setActiveView(AppView.READER); }} deleteHighlight={(id) => setHighlights(prev => prev.filter(h => h.id !== id))} />}
        {activeView === AppView.BOOKMARKS && <BookmarksList bookmarks={bookmarks} goToPage={(p) => { handlePageChange(p); setActiveView(AppView.READER); }} removeBookmark={(p) => setBookmarks(prev => prev.filter(b => b !== p))} />}
      </main>

      {!isFullScreen && <Controls pageNumber={pageNumber} numPages={numPages} scale={scale} activeView={activeView} setActiveView={setActiveView} onPageChange={handlePageChange} onZoomChange={setScale} hasFile={!!pdfDoc} doubleTapEnabled={doubleTapEnabled} toggleFullScreen={() => setIsFullScreen(!isFullScreen)} onFitToScreen={() => setFitToScreenTrigger(prev => prev + 1)} />}
    </>
  );
}