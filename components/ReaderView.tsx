import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PDFDocumentProxy, PDFPageProxy, Highlight, HighlightRect, HighlightStyle } from '../types';
import { renderPageTextLayer } from '../services/pdfHelper';
import { ContextMenu } from './ContextMenu';
import { DraggableFab } from './DraggableFab';

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
  onExplainSelection?: (text: string) => void;
  isBookmarked: boolean;
  highlighterColor: string | null;
  setHighlighterColor: (color: string | null) => void;
  highlighterStyle: HighlightStyle;
  setHighlighterStyle: (style: HighlightStyle) => void;
  eraserMode: boolean;
  setEraserMode: (mode: boolean) => void;
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
  onExplainSelection,
  isBookmarked,
  highlighterColor,
  setHighlighterColor,
  highlighterStyle,
  setHighlighterStyle,
  eraserMode,
  setEraserMode,
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
  
  const [loading, setLoading] = useState(false);
  const renderTaskRef = useRef<any>(null);
  const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<any>(null);
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const touchEndRef = useRef<{x: number, y: number} | null>(null);

  const prevPageRef = useRef(pageNumber);
  const [pageDims, setPageDims] = useState<{width: number, height: number} | null>(null);
  const [originalPageWidth, setOriginalPageWidth] = useState<number>(0);

  useEffect(() => {
    if (pdfDoc) setNumPages(pdfDoc.numPages);
  }, [pdfDoc, setNumPages]);

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

  const addHighlightFromSelection = useCallback(() => {
    if (!highlighterColor) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      const rects = Array.from(range.getClientRects());
      const containerRect = textLayerRef.current?.getBoundingClientRect();
      if (containerRect && rects.length > 0) {
        const mappedRects: HighlightRect[] = rects.map(r => ({
          x: ((r.left - containerRect.left) / containerRect.width) * 100,
          y: ((r.top - containerRect.top) / containerRect.height) * 100,
          width: (r.width / containerRect.width) * 100,
          height: (r.height / containerRect.height) * 100
        }));
        onAddHighlight(mappedRects, text, highlighterColor, highlighterStyle, 0.4);
        selection.removeAllRanges();
      }
    }
  }, [highlighterColor, highlighterStyle, onAddHighlight]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (highlighterColor) {
        // Delay slightly to let selection finalize
        setTimeout(addHighlightFromSelection, 50);
      } else {
        const selection = window.getSelection();
        setSelectedText(selection?.toString().trim() || '');
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [highlighterColor, addHighlightFromSelection]);

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
       longPressTimerRef.current = setTimeout(() => {
         const selection = window.getSelection();
         if (!selection || !selection.toString().trim()) {
           setMenuPos({ x: touch.clientX, y: touch.clientY });
         }
       }, 600); 
       touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
     if (e.touches.length === 1) {
        if (longPressTimerRef.current) {
            const touch = e.touches[0];
            const start = touchStartRef.current;
            if (start && (Math.abs(touch.clientX - start.x) > 15 || Math.abs(touch.clientY - start.y) > 15)) {
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
        if (Math.abs(xDiff) > 60 && Math.abs(xDiff) > Math.abs(yDiff)) {
            const container = containerRef.current;
            const isAtLeftEdge = container.scrollLeft <= 5;
            const isAtRightEdge = Math.abs((container.scrollLeft + container.clientWidth) - container.scrollWidth) <= 5;
            if (xDiff > 0 && isAtRightEdge && pdfDoc && pageNumber < pdfDoc.numPages) onPageChange(pageNumber + 1);
            else if (xDiff < 0 && isAtLeftEdge && pageNumber > 1) onPageChange(pageNumber - 1);
        }
    }
    touchStartRef.current = null; touchEndRef.current = null;
  };

  const direction = pageNumber > prevPageRef.current ? 'next' : 'prev';
  const animationClass = direction === 'next' ? 'animate-book-next' : 'animate-book-prev';

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-auto flex justify-center p-4 relative bg-gray-100 dark:bg-black touch-pan-x touch-pan-y transition-colors duration-500 perspective-container" 
      onContextMenu={(e) => { 
        if (!highlighterColor) {
          e.preventDefault(); 
          setMenuPos({x:e.clientX, y:e.clientY});
        }
      }} 
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
        className={`relative shadow-2xl transition-all ease-out origin-top border dark:border-gold/10 rounded-sm overflow-hidden ${animationClass} ${eraserMode ? 'cursor-crosshair' : ''}`} 
        style={{ width: pageDims?.width, height: pageDims?.height }}
      >
        {loading && (
           <div className="absolute inset-0 bg-white/60 dark:bg-black/60 z-10 flex flex-col items-center justify-center backdrop-blur-md">
             <i className="fa-solid fa-atom fa-spin text-4xl text-mblue dark:text-gold animate-pulse"></i>
             <span className="mt-4 text-[10px] font-black dark:text-gold uppercase tracking-[0.3em] opacity-50">Illuminating Page...</span>
           </div>
        )}
        <canvas ref={canvasRef} className="bg-white block rounded-sm pointer-events-none" style={darkMode ? { filter: 'invert(1) hue-rotate(180deg) contrast(0.9) brightness(0.8)' } : {}} />
        <div className="absolute inset-0 z-[5] pointer-events-none">
           {highlights.filter(h => h.page === pageNumber).map(h => h.rects.map((rect, idx) => (
              <div 
                key={`${h.id}-${idx}`} 
                onClick={(e) => { if (eraserMode) { e.stopPropagation(); onRemoveHighlight(h.id); }}} 
                className={eraserMode ? 'cursor-pointer pointer-events-auto ring-2 ring-red-500' : 'pointer-events-none'} 
                style={{ 
                    position: 'absolute', 
                    left: `${rect.x}%`, 
                    top: `${rect.y}%`, 
                    width: `${rect.width}%`, 
                    height: `${rect.height}%`, 
                    backgroundColor: h.style === 'full' ? h.color : 'transparent',
                    borderBottom: h.style === 'underline' ? `2.5px solid ${h.color}` : (h.style === 'strike' ? 'none' : 'none'),
                    display: 'flex',
                    alignItems: 'center',
                    opacity: darkMode ? h.opacity * 1.5 : h.opacity,
                    mixBlendMode: darkMode ? 'lighten' : 'multiply'
                }}
              >
                {h.style === 'strike' && <div style={{ width: '100%', borderBottom: `2px solid ${h.color}` }} />}
              </div>
           )))}
        </div>
        <div ref={textLayerRef} className="textLayer" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: eraserMode ? 'none' : 'auto', zIndex: 10 }} />
      </div>

      {/* Draggable Highlighter Toolbar */}
      {highlighterColor && (
        <DraggableFab 
          onClick={() => {}}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-black/95 backdrop-blur-xl p-3 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_60px_rgba(212,175,55,0.1)] z-[80] flex flex-col items-center gap-3 border dark:border-gold/30 min-w-[240px]"
        >
          <div className="w-10 h-1.5 bg-gray-200 dark:bg-gold/20 rounded-full cursor-grab active:cursor-grabbing hover:bg-gold/40 transition-colors" />
          <div className="flex items-center gap-4 w-full justify-between px-2">
            <div className="flex items-center gap-3">
              <label className="relative w-9 h-9 rounded-xl overflow-hidden cursor-pointer shadow-inner ring-2 ring-gray-100 dark:ring-gold/20 hover:ring-gold transition-all">
                <input type="color" value={highlighterColor} onChange={(e) => setHighlighterColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" />
              </label>
              
              <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1 border dark:border-gold/10">
                <button 
                  onClick={() => setHighlighterStyle('full')} 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${highlighterStyle === 'full' ? 'bg-mblue dark:bg-gold text-white dark:text-black shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gold/60'}`}
                  title="Solid"
                >
                  <i className="fa-solid fa-highlighter text-xs"></i>
                </button>
                <button 
                  onClick={() => setHighlighterStyle('underline')} 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${highlighterStyle === 'underline' ? 'bg-mblue dark:bg-gold text-white dark:text-black shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gold/60'}`}
                  title="Underline"
                >
                  <i className="fa-solid fa-underline text-xs"></i>
                </button>
                <button 
                  onClick={() => setHighlighterStyle('strike')} 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${highlighterStyle === 'strike' ? 'bg-mblue dark:bg-gold text-white dark:text-black shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gold/60'}`}
                  title="Strike"
                >
                  <i className="fa-solid fa-strikethrough text-xs"></i>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 border-l dark:border-gold/10 pl-3">
              <button 
                onClick={() => setEraserMode(!eraserMode)} 
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${eraserMode ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-400' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gold/40 hover:dark:text-red-400'}`}
                title="Eraser"
              >
                <i className="fa-solid fa-eraser text-xs"></i>
              </button>
              <button onClick={() => setHighlighterColor(null)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 dark:text-gold/20 hover:text-red-500 dark:hover:text-red-500 transition-all hover:bg-red-50 dark:hover:bg-red-500/10">
                <i className="fa-solid fa-times text-xs"></i>
              </button>
            </div>
          </div>
        </DraggableFab>
      )}

      {menuPos && (
        <ContextMenu 
          x={menuPos.x} 
          y={menuPos.y} 
          onClose={() => setMenuPos(null)} 
          isBookmarked={isBookmarked} 
          onBookmark={() => { onContextMenuAction('bookmark'); setMenuPos(null); }} 
          onAddNote={() => { onContextMenuAction('note'); setMenuPos(null); }} 
          onOpenHighlighter={() => { onContextMenuAction('highlighter'); setMenuPos(null); }} 
          onSummarize={() => { onSummarizeSelection(selectedText); setMenuPos(null); }} 
          onExplain={() => { if(onExplainSelection) onExplainSelection(selectedText); setMenuPos(null); }}
          hasSelection={!!selectedText} 
        />
      )}
    </div>
  );
}