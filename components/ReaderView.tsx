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
  
  const [loading, setLoading] = useState(false);
  const renderTaskRef = useRef<any>(null);
  
  // Highlighter Tools State
  const [eraserMode, setEraserMode] = useState(false);
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle>('full');
  const [highlightBrightness, setHighlightBrightness] = useState(2); 
  
  // Context Menu State
  const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  
  // Interaction State
  const lastTapRef = useRef<number>(0);
  const [showFsControls, setShowFsControls] = useState(false);
  const singleTapTimerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);
  
  // Swipe State
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const touchEndRef = useRef<{x: number, y: number} | null>(null);

  // Animation Direction State
  const prevPageRef = useRef(pageNumber);

  // Page Dimensions
  const [pageDims, setPageDims] = useState<{width: number, height: number} | null>(null);
  const [originalPageWidth, setOriginalPageWidth] = useState<number>(0);

  useEffect(() => {
    if (pdfDoc) {
      setNumPages(pdfDoc.numPages);
    }
  }, [pdfDoc, setNumPages]);

  useEffect(() => {
    if (!highlighterColor) {
      setEraserMode(false);
    }
  }, [highlighterColor]);

  // Track Previous Page for Animation Direction
  useEffect(() => {
    prevPageRef.current = pageNumber;
  }, [pageNumber]);

  // Render Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current || !textLayerRef.current) return;

    const renderPage = async () => {
      setLoading(true);
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

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

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        await renderPageTextLayer(page, textLayerDiv, scale);

      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error('Render error:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale, darkMode]);

  // Handle Selection Change for Context Menu
  useEffect(() => {
    const handleSelectionChange = () => {
      if (highlighterColor) return; // Don't track if in highlighter mode
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        setSelectedText(selection.toString().trim());
      } else {
        setSelectedText('');
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [highlighterColor]);

  // Fit to Screen Logic
  const calculateFitToScreen = () => {
    if (containerRef.current && originalPageWidth > 0) {
      const containerWidth = containerRef.current.clientWidth;
      const availableWidth = containerWidth - 32; 
      const newScale = availableWidth / originalPageWidth;
      const optimalScale = Math.min(Math.max(newScale, 0.2), 5.0);
      onZoomChange(optimalScale);
    }
  };

  // Listen to external trigger
  useEffect(() => {
    if (fitToScreenTrigger > 0) {
      calculateFitToScreen();
    }
  }, [fitToScreenTrigger]);

  const handleFitToScreenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    calculateFitToScreen();
  };

  // Interactions
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
       const touch = e.touches[0];
       // Long press logic
       longPressTimerRef.current = setTimeout(() => {
          setMenuPos({ x: touch.clientX, y: touch.clientY });
       }, 600); 

       // Swipe Logic Init
       touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
     if (e.touches.length === 1) {
        // If moving, cancel long press
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
    
    // Swipe Processing
    if (swipeEnabled && touchStartRef.current && touchEndRef.current && containerRef.current) {
        const xDiff = touchStartRef.current.x - touchEndRef.current.x;
        const yDiff = touchStartRef.current.y - touchEndRef.current.y;
        
        // Threshold for swipe (e.g., 50px) and check if it's more horizontal than vertical
        if (Math.abs(xDiff) > 50 && Math.abs(xDiff) > Math.abs(yDiff)) {
            const container = containerRef.current;
            // Check if user is scrolled to edges before allowing page turn
            // This prevents turning page when trying to pan around a zoomed image
            const isAtLeftEdge = container.scrollLeft <= 5;
            const isAtRightEdge = Math.abs((container.scrollLeft + container.clientWidth) - container.scrollWidth) <= 5;

            if (xDiff > 0) {
                // Left Swipe -> Next Page
                // Only allow if at right edge of current page view
                if (isAtRightEdge && pdfDoc && pageNumber < pdfDoc.numPages) {
                    onPageChange(pageNumber + 1);
                }
            } else {
                // Right Swipe -> Previous Page
                // Only allow if at left edge of current page view
                if (isAtLeftEdge && pageNumber > 1) {
                    onPageChange(pageNumber - 1);
                }
            }
        }
    }
    
    // Reset swipe tracking
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    if (highlighterColor && !eraserMode) return;
    if (menuPos) return; 

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY && doubleTapEnabled) {
      // Double Tap
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      toggleFullScreen();
    } else {
      // Single Tap
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      
      singleTapTimerRef.current = setTimeout(() => {
        if (isFullScreen) {
           setShowFsControls(prev => !prev);
        }
      }, DOUBLE_TAP_DELAY);
    }
    
    lastTapRef.current = now;
  };

  // Highlighting Logic
  useEffect(() => {
    if (!highlighterColor || eraserMode) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      if (textLayerRef.current && wrapperRef.current && textLayerRef.current.contains(selection.anchorNode)) {
         const range = selection.getRangeAt(0);
         const clientRects = range.getClientRects();
         const containerRect = wrapperRef.current.getBoundingClientRect();
         const text = selection.toString();
         
         if (text.trim().length > 0 && containerRect.width > 0 && containerRect.height > 0) {
           const highlightRects: HighlightRect[] = [];
           
           for (let i = 0; i < clientRects.length; i++) {
             const rect = clientRects[i];
             highlightRects.push({
               x: ((rect.left - containerRect.left) / containerRect.width) * 100,
               y: ((rect.top - containerRect.top) / containerRect.height) * 100,
               width: (rect.width / containerRect.width) * 100,
               height: (rect.height / containerRect.height) * 100
             });
           }

           const opacity = highlightBrightness * 0.2; 
           onAddHighlight(highlightRects, text, highlighterColor, highlightStyle, opacity);
           selection.removeAllRanges(); 
         }
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [highlighterColor, eraserMode, highlightStyle, highlightBrightness, onAddHighlight]);


  const canvasStyle = darkMode 
    ? { filter: 'invert(1) hue-rotate(180deg) contrast(0.85)' } 
    : { filter: 'none' };

  const getHighlightStyle = (rect: HighlightRect, color: string, style: HighlightStyle = 'full', opacity: number = 0.4) => {
    const base = {
      position: 'absolute' as const,
      left: `${rect.x}%`,
      width: `${rect.width}%`,
      backgroundColor: color,
    };

    switch (style) {
      case 'underline':
        return {
          ...base,
          top: `${rect.y + rect.height * 0.85}%`,
          height: `${rect.height * 0.15}%`,
          opacity: Math.min(1, opacity + 0.3)
        };
      case 'medium':
        return {
          ...base,
          top: `${rect.y + rect.height * 0.4}%`,
          height: `${rect.height * 0.6}%`,
          opacity: opacity
        };
      case 'full':
      default:
        return {
          ...base,
          top: `${rect.y}%`,
          height: `${rect.height}%`,
          opacity: opacity
        };
    }
  };

  if (!pdfDoc) {
     return (
       <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
         <i className="fa-regular fa-file-pdf text-6xl mb-4 opacity-50"></i>
         <p>Select a PDF file to start reading</p>
       </div>
     );
  }

  // Animation Logic
  // Determine direction based on current page vs previous page
  const direction = pageNumber > prevPageRef.current ? 'next' : 'prev';
  // Only animate if in FullScreen mode
  const animationClass = isFullScreen 
    ? (direction === 'next' ? 'animate-page-next' : 'animate-page-prev')
    : '';

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-auto flex justify-center p-4 relative bg-gray-200 dark:bg-gray-900 touch-pan-x touch-pan-y"
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={handleCanvasClick}
    >
      <div 
        ref={wrapperRef}
        key={pageNumber} // Key ensures remount/animation trigger on page change
        className={`relative shadow-lg transition-all ease-out origin-top ${animationClass} ${eraserMode ? 'cursor-crosshair' : ''}`}
        style={{ width: pageDims?.width, height: pageDims?.height }}
      >
        {loading && (
           <div className="absolute inset-0 bg-white dark:bg-gray-800 z-10 flex items-center justify-center opacity-75">
             <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500"></i>
           </div>
        )}
        
        <canvas 
          ref={canvasRef} 
          className="bg-white block rounded-sm pointer-events-none" 
          style={canvasStyle}
        />

        {pageDims && (
          <div className="absolute inset-0 z-0">
             {highlights.filter(h => h.page === pageNumber).map(h => (
               <React.Fragment key={h.id}>
                 {h.rects.map((rect, idx) => (
                    <div 
                      key={idx}
                      onClick={(e) => {
                        if (eraserMode) {
                          e.stopPropagation();
                          e.preventDefault();
                          onRemoveHighlight(h.id);
                        }
                      }}
                      className={eraserMode ? 'cursor-pointer hover:opacity-75 ring-2 ring-red-500 ring-offset-1 pointer-events-auto' : 'pointer-events-none'}
                      style={getHighlightStyle(rect, h.color, h.style, h.opacity)}
                    />
                 ))}
               </React.Fragment>
             ))}
          </div>
        )}

        <div 
          ref={textLayerRef}
          className="textLayer"
          style={{
             position: 'absolute',
             top: 0, 
             left: 0,
             pointerEvents: eraserMode ? 'none' : 'auto'
          }}
        />
      </div>

      {/* Discrete Arrows for Fullscreen when Swipe is Disabled */}
      {isFullScreen && !swipeEnabled && (
        <>
           <button 
             onClick={(e) => { e.stopPropagation(); if(pageNumber > 1) onPageChange(pageNumber - 1); }}
             disabled={pageNumber <= 1}
             className="fixed bottom-4 left-4 w-12 h-12 bg-black/30 hover:bg-black/50 backdrop-blur text-white rounded-full flex items-center justify-center z-30 transition-all disabled:opacity-0"
           >
             <i className="fa-solid fa-chevron-left"></i>
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); if(pdfDoc && pageNumber < pdfDoc.numPages) onPageChange(pageNumber + 1); }}
             disabled={pdfDoc ? pageNumber >= pdfDoc.numPages : true}
             className="fixed bottom-4 right-4 w-12 h-12 bg-black/30 hover:bg-black/50 backdrop-blur text-white rounded-full flex items-center justify-center z-30 transition-all disabled:opacity-0"
           >
             <i className="fa-solid fa-chevron-right"></i>
           </button>
        </>
      )}

      {isFullScreen && showFsControls && (
         <div 
           className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-40 flex items-center gap-4 animate-in slide-in-from-bottom-5"
           onClick={(e) => e.stopPropagation()} 
         >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400">Zoom</span>
              <button onClick={() => onZoomChange(Math.max(0.5, scale - 0.1))} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <i className="fa-solid fa-minus text-xs"></i>
              </button>
              <span className="font-mono text-sm w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => onZoomChange(Math.min(3.0, scale + 0.1))} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
              <button onClick={handleFitToScreenClick} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-blue-500 transition-colors ml-1" title="Fit to Screen">
                 <i className="fa-solid fa-maximize text-xs"></i>
              </button>
            </div>
            <div className="h-6 w-[1px] bg-white/20"></div>
            <button onClick={toggleFullScreen} className="text-sm font-medium hover:text-gray-300">
               <i className="fa-solid fa-compress mr-2"></i>Exit
            </button>
         </div>
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
          hasSelection={!!selectedText}
        />
      )}

      {highlighterColor && (
         <div 
           className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-4 animate-in slide-in-from-bottom-5 border border-gray-100 dark:border-gray-700 overflow-x-auto max-w-[95vw]"
           onClick={(e) => e.stopPropagation()} 
         >
           
           <div className="flex flex-col items-center gap-1 group shrink-0">
             <label className="relative w-8 h-8 rounded-full overflow-hidden cursor-pointer shadow-sm ring-2 ring-gray-200 dark:ring-gray-600 group-hover:scale-110 transition-transform">
               <input 
                 type="color" 
                 value={highlighterColor} 
                 onChange={(e) => setHighlighterColor(e.target.value)}
                 className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
               />
             </label>
             <span className="text-[10px] text-gray-500 font-medium">Color</span>
           </div>

           <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-700 shrink-0"></div>

           <div className="flex flex-col items-center gap-1 w-24 shrink-0">
             <div className="flex justify-between w-full text-[8px] text-gray-400 font-mono mb-1 px-1">
                <span>1</span><span>5</span>
             </div>
             <input 
               type="range" 
               min="1" 
               max="5" 
               step="1" 
               value={highlightBrightness}
               onChange={(e) => setHighlightBrightness(parseInt(e.target.value))}
               className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
             />
             <span className="text-[10px] text-gray-500 font-medium">Brightness: {highlightBrightness}</span>
           </div>

           <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-700 shrink-0"></div>

           <div className="flex flex-col items-center gap-1 shrink-0">
             <button 
               onClick={() => setEraserMode(!eraserMode)}
               className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${eraserMode ? 'bg-red-500 text-white scale-110' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
             >
               <i className="fa-solid fa-eraser text-sm"></i>
             </button>
             <span className={`text-[10px] font-medium ${eraserMode ? 'text-red-500' : 'text-gray-500'}`}>Eraser</span>
           </div>

           <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-700 shrink-0"></div>

           <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg shrink-0">
              <button 
                onClick={() => setHighlightStyle('full')}
                title="Full Highlight"
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${highlightStyle === 'full' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="w-4 h-4 bg-current opacity-40 rounded-sm"></div>
              </button>
              <button 
                onClick={() => setHighlightStyle('medium')}
                title="Medium Highlight"
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${highlightStyle === 'medium' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="w-4 h-2 bg-current opacity-60 rounded-sm mt-2"></div>
              </button>
              <button 
                onClick={() => setHighlightStyle('underline')}
                title="Underline"
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${highlightStyle === 'underline' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="w-4 h-0.5 bg-current rounded-full mt-3"></div>
              </button>
           </div>

           <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-700 shrink-0"></div>

           <button onClick={() => setHighlighterColor(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
             <i className="fa-solid fa-times"></i>
           </button>
         </div>
      )}
    </div>
  );
}