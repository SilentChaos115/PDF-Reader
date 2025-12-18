import React, { useEffect, useRef, useState } from 'react';
import { PDFDocumentProxy, PDFPageProxy, Highlight, HighlightRect, HighlightStyle } from '../types';
import { renderPageTextLayer } from '../services/pdfHelper';
import { ContextMenu } from './ContextMenu';

interface ReaderViewProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  scale: number;
  setNumPages: (num: number) => void;
  darkMode: boolean;
  highlights: Highlight[];
  onAddHighlight: (rects: HighlightRect[], text: string, color: string, style: HighlightStyle, opacity: number) => void;
  onRemoveHighlight: (id: string) => void;
  onContextMenuAction: (action: 'bookmark' | 'note' | 'highlighter') => void;
  onSummarizeSelection: (text: string) => void;
  isBookmarked: boolean;
  highlighterColor: string | null;
  setHighlighterColor: (color: string | null) => void;
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  onZoomChange: (scale: number) => void;
  doubleTapEnabled: boolean;
  fitToScreenTrigger: number;
  swipeEnabled: boolean;
  onPageChange: (newPage: number) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({ 
  pdfDoc, 
  pageNumber, 
  scale, 
  setNumPages, 
  darkMode,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  onContextMenuAction,
  onSummarizeSelection,
  isBookmarked,
  highlighterColor,
  setHighlighterColor,
  isFullScreen,
  toggleFullScreen,
  onZoomChange,
  doubleTapEnabled,
  fitToScreenTrigger,
  swipeEnabled,
  onPageChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const highlighterRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const renderTaskRef = useRef<any>(null);
  
  const [eraserMode, setEraserMode] = useState(false);
  const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);
  
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const touchEndRef = useRef<{x: number, y: number} | null>(null);
  
  // Highlighter swipe states
  const hlTouchStart = useRef<number | null>(null);
  const [hlTranslateY, setHlTranslateY] = useState(0);

  const prevPageRef = useRef(pageNumber);
  const [pageDims, setPageDims] = useState<{width: number, height: number} | null>(null);
  const [originalPageWidth, setOriginalPageWidth] = useState<number>(0);

  useEffect(() => {
    if (pdfDoc) setNumPages(pdfDoc.numPages);
  }, [pdfDoc, setNumPages]);

  useEffect(() => {
    if (!highlighterColor) {
      setEraserMode(false);
      setHlTranslateY(0);
    }
  }, [highlighterColor]);

  useEffect(() => {
    prevPageRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current || !textLayerRef.current) return;
    const renderPage = async () => {
      setLoading(true);
      try {
        if (renderTaskRef.current) renderTaskRef.current.cancel();
        const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
        const originalViewport = page.getViewport({ scale: 1.0 });
        setOriginalPageWidth(originalViewport.width);
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const textLayerDiv = textLayerRef.current;
        if (!canvas || !context || !textLayerDiv) return;
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 2.0);
        const viewport = page.getViewport({ scale: scale * pixelRatio });
        const cssViewport = page.getViewport({ scale: scale });
        setPageDims({ width: cssViewport.width, height: cssViewport.height });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.height = `${cssViewport.height}px`;
        canvas.style.width = `${cssViewport.width}px`;
        textLayerDiv.style.height = `${cssViewport.height}px`;
        textLayerDiv.style.width = `${cssViewport.width}px`;
        const renderContext = { canvasContext: context, viewport: viewport };
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        await renderPageTextLayer(page, textLayerDiv, scale);
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') console.error('Render error:', error);
      } finally { setLoading(false); }
    };
    renderPage();
    return () => { if (renderTaskRef.current) renderTaskRef.current.cancel(); };
  }, [pdfDoc, pageNumber, scale, darkMode]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (highlighterColor) return;
      const selection = window.getSelection();
      setSelectedText(selection?.toString().trim() || '');
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [highlighterColor]);

  useEffect(() => { 
    if (fitToScreenTrigger > 0 && containerRef.current && originalPageWidth > 0) {
      const containerWidth = containerRef.current.clientWidth;
      const availableWidth = containerWidth - 32; 
      const newScale = availableWidth / originalPageWidth;
      onZoomChange(Math.min(Math.max(newScale, 0.2), 5.0));
    }
  }, [fitToScreenTrigger, originalPageWidth, onZoomChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
       const touch = e.touches[0];
       longPressTimerRef.current = setTimeout(() => setMenuPos({ x: touch.clientX, y: touch.clientY }), 600); 
       touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
     if (e.touches.length === 1) {
        if (longPressTimerRef.current) {
            const touch = e.touches[0];
            const start = touchStartRef.current;
            if (start && (Math.abs(touch.clientX - start.x) > 10 || Math.abs(touch.clientY - start.y) > 10)) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
        touchEndRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
     }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (swipeEnabled && touchStartRef.current && touchEndRef.current && containerRef.current) {
        const xDiff = touchStartRef.current.x - touchEndRef.current.x;
        const yDiff = touchStartRef.current.y - touchEndRef.current.y;
        if (Math.abs(xDiff) > 50 && Math.abs(xDiff) > Math.abs(yDiff)) {
            const container = containerRef.current;
            const isAtLeftEdge = container.scrollLeft <= 5;
            const isAtRightEdge = Math.abs((container.scrollLeft + container.clientWidth) - container.scrollWidth) <= 5;
            if (xDiff > 0 && isAtRightEdge && pdfDoc && pageNumber < pdfDoc.numPages) onPageChange(pageNumber + 1);
            else if (xDiff < 0 && isAtLeftEdge && pageNumber > 1) onPageChange(pageNumber - 1);
        }
    }
    touchStartRef.current = null; touchEndRef.current = null;
  };

  const handleHlTouchStart = (e: React.TouchEvent) => { hlTouchStart.current = e.touches[0].clientY; };
  const handleHlTouchMove = (e: React.TouchEvent) => {
    if (hlTouchStart.current === null) return;
    const delta = e.touches[0].clientY - hlTouchStart.current;
    if (delta > 0) setHlTranslateY(delta);
  };
  const handleHlTouchEnd = () => {
    if (hlTranslateY > 100) setHighlighterColor(null);
    else setHlTranslateY(0);
    hlTouchStart.current = null;
  };

  const direction = pageNumber > prevPageRef.current ? 'next' : 'prev';
  const animationClass = isFullScreen ? (direction === 'next' ? 'animate-page-next' : 'animate-page-prev') : '';

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-auto flex justify-center p-4 relative bg-gray-200 dark:bg-gray-900 touch-pan-x touch-pan-y" 
      onContextMenu={(e) => { e.preventDefault(); setMenuPos({x:e.clientX, y:e.clientY})}} 
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} 
      onClick={(e) => {
        const now = Date.now();
        if (now - lastTapRef.current < 300 && doubleTapEnabled) toggleFullScreen();
        lastTapRef.current = now;
      }}
    >
      <div 
        ref={wrapperRef} 
        key={pageNumber} 
        className={`relative shadow-lg transition-all ease-out origin-top ${animationClass} ${eraserMode ? 'cursor-crosshair' : ''}`} 
        style={{ width: pageDims?.width, height: pageDims?.height }}
      >
        {loading && (
           <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 z-10 flex items-center justify-center backdrop-blur-sm">
             <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500"></i>
           </div>
        )}
        <canvas ref={canvasRef} className="bg-white block rounded-sm pointer-events-none" style={darkMode ? { filter: 'invert(1) hue-rotate(180deg) contrast(0.85)' } : {}} />
        <div className="absolute inset-0 z-0 pointer-events-none">
           {highlights.filter(h => h.page === pageNumber).map(h => h.rects.map((rect, idx) => (
              <div key={`${h.id}-${idx}`} onClick={(e) => { if (eraserMode) { e.stopPropagation(); onRemoveHighlight(h.id); }}} className={eraserMode ? 'cursor-pointer pointer-events-auto ring-2 ring-red-500' : 'pointer-events-none'} style={{ position: 'absolute', left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%`, backgroundColor: h.color, opacity: h.opacity }} />
           )))}
        </div>
        <div ref={textLayerRef} className="textLayer" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: eraserMode ? 'none' : 'auto' }} />
      </div>

      {/* Discrete Fullscreen Arrows when Swipe is Disabled */}
      {isFullScreen && !swipeEnabled && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); onPageChange(pageNumber - 1); }}
            disabled={pageNumber <= 1}
            className="fixed bottom-6 left-6 w-14 h-14 bg-white/10 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/40 text-gray-800 dark:text-white rounded-full flex items-center justify-center transition-all z-[70] backdrop-blur-md disabled:opacity-0 active:scale-90 shadow-lg border border-white/20"
          >
            <i className="fa-solid fa-chevron-left text-lg"></i>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onPageChange(pageNumber + 1); }}
            disabled={!pdfDoc || pageNumber >= pdfDoc.numPages}
            className="fixed bottom-6 right-6 w-14 h-14 bg-white/10 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/40 text-gray-800 dark:text-white rounded-full flex items-center justify-center transition-all z-[70] backdrop-blur-md disabled:opacity-0 active:scale-90 shadow-lg border border-white/20"
          >
            <i className="fa-solid fa-chevron-right text-lg"></i>
          </button>
        </>
      )}

      {highlighterColor && (
         <div 
           ref={highlighterRef}
           onTouchStart={handleHlTouchStart}
           onTouchMove={handleHlTouchMove}
           onTouchEnd={handleHlTouchEnd}
           style={{ transform: `translateX(-50%) translateY(${hlTranslateY}px)` }}
           className="fixed bottom-24 left-1/2 bg-white dark:bg-gray-800 px-4 pt-2 pb-4 rounded-2xl shadow-2xl z-[80] flex flex-col items-center gap-2 border dark:border-gray-700 transition-transform duration-75"
         >
           <div className="swipe-handle" />
           <div className="flex items-center gap-4">
             <label className="relative w-8 h-8 rounded-full overflow-hidden cursor-pointer shadow-sm ring-2 ring-gray-200 dark:ring-gray-600">
               <input type="color" value={highlighterColor} onChange={(e) => setHighlighterColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16" />
             </label>
             <button onClick={() => setEraserMode(!eraserMode)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${eraserMode ? 'bg-red-500 text-white shadow-inner' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}>
               <i className="fa-solid fa-eraser"></i>
             </button>
             <button onClick={() => setHighlighterColor(null)} className="text-gray-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-times"></i></button>
           </div>
         </div>
      )}

      {menuPos && <ContextMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)} isBookmarked={isBookmarked} onBookmark={() => { onContextMenuAction('bookmark'); setMenuPos(null); }} onAddNote={() => { onContextMenuAction('note'); setMenuPos(null); }} onOpenHighlighter={() => { onContextMenuAction('highlighter'); setMenuPos(null); }} onSummarize={() => { onSummarizeSelection(selectedText); setMenuPos(null); }} hasSelection={!!selectedText} />}
    </div>
  );
}