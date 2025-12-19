import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PDFDocumentProxy, AudioCursor } from '../types';
import { extractPageText } from '../services/pdfHelper';
import { saveCachedText, getCachedText } from '../services/db';

interface AudioPlayerProps {
  pdfDoc: PDFDocumentProxy;
  fileId: string;
  pageNumber: number;
  onPageChange: (page: number) => void;
  cursor: AudioCursor | undefined;
  onCursorChange: (cursor: AudioCursor) => void;
  settings: { speed: number; voice: string };
  onSettingsChange: (settings: { speed: number; voice: string }) => void;
  onClose: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  pdfDoc,
  fileId,
  pageNumber,
  onPageChange,
  cursor,
  onCursorChange,
  settings,
  onSettingsChange,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(cursor?.sentenceIndex || 0);
  const [loading, setLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showControls, setShowControls] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync cursor state to parent for persistence with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (cursor?.page !== pageNumber || cursor?.sentenceIndex !== currentIndex) {
        onCursorChange({ page: pageNumber, sentenceIndex: currentIndex });
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [currentIndex, pageNumber]);

  // Initialize Voices
  useEffect(() => {
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      const english = all
        .filter(v => v.lang.toLowerCase().startsWith('en'))
        .sort((a, b) => {
           const priority = ['neural', 'natural', 'google', 'premium', 'enhanced', 'samantha', 'daniel'];
           const aP = priority.findIndex(p => a.name.toLowerCase().includes(p));
           const bP = priority.findIndex(p => b.name.toLowerCase().includes(p));
           
           if (aP !== -1 && bP === -1) return -1;
           if (aP === -1 && bP !== -1) return 1;
           if (aP !== -1 && bP !== -1) return aP - bP;
           return a.name.localeCompare(b.name);
        });
      setAvailableVoices(english);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Initialize Silent Audio once
  useEffect(() => {
    const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
    audio.loop = true;
    audio.volume = 0.01; 
    silentAudioRef.current = audio;

    return () => {
      window.speechSynthesis.cancel();
      if(silentAudioRef.current) {
         silentAudioRef.current.pause();
         silentAudioRef.current.src = "";
      }
    };
  }, []);

  // Navigation Logic Wrappers
  const handleNext = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(curr => curr + 1);
    } else if (pageNumber < pdfDoc.numPages) {
      onPageChange(pageNumber + 1);
      setCurrentIndex(0);
    }
  }, [currentIndex, sentences.length, pageNumber, pdfDoc.numPages, onPageChange]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(curr => curr - 1);
    } else if (pageNumber > 1) {
      onPageChange(pageNumber - 1);
      setCurrentIndex(0); 
    }
  }, [currentIndex, pageNumber, onPageChange]);

  const handlePlayToggle = useCallback(() => {
    const shouldPlay = !isPlaying;
    setIsPlaying(shouldPlay);
    
    if (shouldPlay) {
      // Immediate play interaction for mobile browsers
      silentAudioRef.current?.play().catch(e => console.warn("Background audio start failed", e));
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } else {
      silentAudioRef.current?.pause();
      window.speechSynthesis.pause(); 
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
  }, [isPlaying]);

  // Manage MediaSession (Metadata + Handlers)
  // Re-run whenever navigation state changes to prevent stale closures
  useEffect(() => {
    if ('mediaSession' in navigator) {
       // Update Metadata
       if (sentences.length > 0) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: sentences[currentIndex] ? (sentences[currentIndex].substring(0, 40) + '...') : 'Reading...',
            artist: 'ZenReader',
            album: `Page ${pageNumber} (${currentIndex + 1}/${sentences.length})`,
            artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/337/337946.png', sizes: '512x512', type: 'image/png' }]
          });

          if (navigator.mediaSession.setPositionState) {
             navigator.mediaSession.setPositionState({
                 duration: sentences.length,
                 playbackRate: settings.speed,
                 position: Math.min(currentIndex, sentences.length - 0.01)
             });
          }
       }

       // Update Handlers (Crucial: These capture current state closures)
       navigator.mediaSession.setActionHandler('play', () => { 
          setIsPlaying(true); 
          silentAudioRef.current?.play().catch(() => {});
       });
       navigator.mediaSession.setActionHandler('pause', () => {
          setIsPlaying(false);
          silentAudioRef.current?.pause();
       });
       navigator.mediaSession.setActionHandler('stop', () => { setIsPlaying(false); onClose(); });
       navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && sentences.length > 0) {
              const newIdx = Math.min(Math.max(0, Math.floor(details.seekTime)), sentences.length - 1);
              setCurrentIndex(newIdx);
          }
      });
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
    }
  }, [currentIndex, sentences, pageNumber, settings.speed, handleNext, handlePrev, onClose]);

  // Load Content
  useEffect(() => {
    const loadText = async () => {
      setLoading(true);
      try {
        const cached = await getCachedText(fileId, pageNumber);
        if (cached) {
          setSentences(cached);
          // If we just changed pages, ensure index is safe
          setCurrentIndex(curr => (cursor?.page === pageNumber ? cursor.sentenceIndex : 0));
          setLoading(false);
          return;
        }

        const page = await pdfDoc.getPage(pageNumber);
        const text = await extractPageText(page);
        const splitSentences = text.match(/[^.!?\n]+[.!?\n]+["']?|[^.!?\n]+$/g) || [text];
        const cleaned = splitSentences.map(s => s.trim().replace(/\s+/g, ' ')).filter(s => s.length > 0);
        
        await saveCachedText(fileId, pageNumber, cleaned);
        setSentences(cleaned);
        setCurrentIndex(0);
      } catch (e) {
        console.error("Audio Ready Error", e);
      } finally {
        setLoading(false);
      }
    };
    loadText();
  }, [pageNumber, pdfDoc, fileId]);

  // Reading Logic
  useEffect(() => {
    if (isPlaying && sentences.length > 0 && !loading && !isScrubbing) {
      window.speechSynthesis.cancel();
      playSentence(currentIndex);
    } 
  }, [isPlaying, currentIndex, sentences, loading, settings.speed, settings.voice, isScrubbing]);

  const playSentence = (index: number) => {
    if (index >= sentences.length) {
      if (pageNumber < pdfDoc.numPages) {
        onPageChange(pageNumber + 1);
        setCurrentIndex(0);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    const text = sentences[index];
    if(!text) return; 

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.speed;
    
    if (settings.voice) {
      const voice = availableVoices.find(v => v.name === settings.voice);
      if (voice) utterance.voice = voice;
    } else if (availableVoices.length > 0) {
      utterance.voice = availableVoices[0];
    }

    if(window.speechSynthesis.paused) window.speechSynthesis.resume();

    utterance.onend = () => {
      // Use functional update to ensure we don't race
      setCurrentIndex(curr => curr + 1);
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      
      console.error("Speech Synthesis Error:", e.error);
      if (isPlaying && !isScrubbing) {
        setCurrentIndex(curr => {
            const next = curr + 1;
            return next < sentences.length ? next : curr;
        });
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Scrubber Handlers
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(parseInt(e.target.value));
  };

  const handleSeekStart = () => {
    setIsScrubbing(true);
    window.speechSynthesis.cancel(); 
  };

  const handleSeekEnd = () => {
    setIsScrubbing(false);
  };

  const naturalVoices = availableVoices.filter(v => v.name.match(/neural|natural|premium|enhanced/i));
  const standardVoices = availableVoices.filter(v => !v.name.match(/neural|natural|premium|enhanced/i));

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[92%] max-w-lg bg-white dark:bg-black rounded-[2rem] shadow-[0_10px_50px_rgba(0,0,0,0.5)] dark:shadow-[0_10px_50px_rgba(212,175,55,0.2)] border-2 border-gray-100 dark:border-gold/30 overflow-hidden z-[60] animate-in slide-in-from-bottom-10 transition-all">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-950 px-6 py-4 border-b border-gray-100 dark:border-gold/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full metallic-blue-bg dark:metallic-gold-bg flex items-center justify-center text-white dark:text-black shadow-lg">
             <i className={`fa-solid fa-microphone-lines ${isPlaying ? 'animate-pulse' : ''} text-xs`}></i>
          </div>
          <span className="text-[10px] font-black dark:metallic-gold uppercase tracking-[0.3em] italic">Sector Scan Narrative</span>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowControls(!showControls)} 
             className={`p-2 rounded-lg transition-colors ${showControls ? 'text-mblue dark:text-gold bg-mblue/10 dark:bg-gold/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gold/60'}`}
           >
             <i className="fa-solid fa-sliders text-sm"></i>
           </button>
           <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-all p-2">
             <i className="fa-solid fa-times text-sm"></i>
           </button>
        </div>
      </div>
      
      {/* Advanced Controls Drawer */}
      {showControls && (
        <div className="bg-gray-100 dark:bg-gray-900 border-b dark:border-gold/10 p-5 space-y-4 animate-in slide-in-from-top-2">
           <div>
             <label className="text-[9px] font-bold text-gray-500 dark:text-gold/40 uppercase mb-2 block tracking-widest">Neural Voice Identity</label>
             <div className="relative">
                <select 
                  value={settings.voice}
                  onChange={(e) => onSettingsChange({ ...settings, voice: e.target.value })}
                  className="w-full p-3 rounded-xl border dark:border-gold/10 bg-white dark:bg-black text-xs font-bold dark:text-gold outline-none focus:border-mblue dark:focus:border-gold transition-all appearance-none"
                >
                  <option value="">System Default</option>
                  {naturalVoices.length > 0 && (
                    <optgroup label="High Quality / Neural">
                      {naturalVoices.map(v => (
                        <option key={v.name} value={v.name}>{v.name.replace(/Google|Microsoft|English/g, '').replace(/[()]/g, '').trim()} ✨</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Standard Voices">
                    {standardVoices.map(v => (
                      <option key={v.name} value={v.name}>{v.name.replace(/Google|Microsoft|English/g, '').replace(/[()]/g, '').trim()}</option>
                    ))}
                  </optgroup>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gold/50">
                    <i className="fa-solid fa-chevron-down text-xs"></i>
                </div>
             </div>
           </div>
           <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[9px] font-bold text-gray-500 dark:text-gold/40 uppercase tracking-widest">Transmission Rate</label>
                <span className="text-[10px] font-black dark:text-gold bg-black/5 dark:bg-white/5 px-2 py-1 rounded">{settings.speed}x</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={settings.speed} 
                onChange={(e) => onSettingsChange({ ...settings, speed: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-mblue dark:accent-gold"
              />
              <div className="flex justify-between text-[8px] text-gray-400 font-mono mt-1">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
           </div>
        </div>
      )}
      
      {/* Player Content */}
      <div className="p-6 flex flex-col items-center gap-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-4">
             <i className="fa-solid fa-atom fa-spin text-mblue dark:text-gold text-2xl"></i>
             <span className="text-[9px] font-bold dark:text-gold/40 uppercase tracking-widest">Parsing Neural Script...</span>
          </div>
        ) : (
          <div className="w-full">
             <div className="min-h-[4rem] flex items-center justify-center mb-6">
                <p className="text-sm font-bold text-center text-gray-800 dark:text-gold/80 line-clamp-3 italic leading-relaxed transition-all">
                  {sentences[currentIndex] || "Awaiting sequence start..."}
                </p>
             </div>
             
             {/* Progress Scrubber */}
             <div className="mb-2">
                 <input
                    type="range"
                    min="0"
                    max={Math.max(0, sentences.length - 1)}
                    value={currentIndex}
                    onChange={handleSeekChange}
                    onMouseDown={handleSeekStart}
                    onMouseUp={handleSeekEnd}
                    onTouchStart={handleSeekStart}
                    onTouchEnd={handleSeekEnd}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-mblue dark:accent-gold"
                    disabled={loading || sentences.length === 0}
                 />
                 <div className="flex justify-between mt-1">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400 dark:text-gold/30">Start</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400 dark:text-gold/30">{currentIndex + 1} / {sentences.length}</span>
                 </div>
             </div>
          </div>
        )}

        <div className="flex items-center gap-8">
           <button onClick={handlePrev} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gold/60 hover:dark:text-gold transition-all active:scale-90 border dark:border-gold/10 shadow-sm">
             <i className="fa-solid fa-backward-step text-lg"></i>
           </button>

           <button 
             onClick={handlePlayToggle}
             className="w-20 h-20 flex items-center justify-center metallic-blue-bg dark:metallic-gold-bg text-white dark:text-black rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_30px_rgba(212,175,55,0.3)] transition-all active:scale-95 group relative overflow-hidden"
           >
             <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-[2rem]"></div>
             <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-3xl relative z-10`}></i>
           </button>

           <button onClick={handleNext} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gold/60 hover:dark:text-gold transition-all active:scale-90 border dark:border-gold/10 shadow-sm">
             <i className="fa-solid fa-forward-step text-lg"></i>
           </button>
        </div>

        <div className="w-full flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] border-t dark:border-gold/10 pt-4">
           <span className="text-gray-400 dark:text-gold/30">Sector {pageNumber}</span>
           <span className="text-gray-400 dark:text-gold/30">Auto-Scroll Active</span>
        </div>
      </div>
    </div>
  );
};