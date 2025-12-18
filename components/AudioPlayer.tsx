import React, { useState, useEffect, useRef } from 'react';
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
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(cursor?.sentenceIndex || 0);
  const [loading, setLoading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'ZenReader Gold Reader',
        artist: 'ZenReader AI',
        album: 'Document Audio',
      });
      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
    }
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  useEffect(() => {
    const loadText = async () => {
      setLoading(true);
      try {
        // Check cache first
        const cached = await getCachedText(fileId, pageNumber);
        if (cached) {
          setSentences(cached);
          if (cursor?.page === pageNumber) setCurrentIndex(cursor.sentenceIndex);
          else setCurrentIndex(0);
          setLoading(false);
          return;
        }

        const page = await pdfDoc.getPage(pageNumber);
        const text = await extractPageText(page);
        const splitSentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
        const cleaned = splitSentences.map(s => s.trim()).filter(Boolean);
        
        // Save to cache for next time
        await saveCachedText(fileId, pageNumber, cleaned);
        
        setSentences(cleaned);
        if (cursor?.page === pageNumber) setCurrentIndex(cursor.sentenceIndex);
        else setCurrentIndex(0);
      } catch (e) {
        console.error("Audio Ready Error", e);
      } finally {
        setLoading(false);
      }
    };
    loadText();
  }, [pageNumber, pdfDoc, fileId]);

  useEffect(() => {
    if (isPlaying && sentences.length > 0 && !loading) {
      playSentence(currentIndex);
    } else {
      window.speechSynthesis.cancel();
    }
  }, [isPlaying, currentIndex, sentences, loading]);

  const playSentence = (index: number) => {
    window.speechSynthesis.cancel();
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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.speed;
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === settings.voice);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      const nextIdx = index + 1;
      setCurrentIndex(nextIdx);
      onCursorChange({ page: pageNumber, sentenceIndex: nextIdx });
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) setCurrentIndex(currentIndex + 1);
    else if (pageNumber < pdfDoc.numPages) onPageChange(pageNumber + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    else if (pageNumber > 1) onPageChange(pageNumber - 1);
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[92%] max-w-lg bg-white dark:bg-black rounded-[2rem] shadow-[0_10px_50px_rgba(0,0,0,0.5)] dark:shadow-[0_10px_50px_rgba(212,175,55,0.2)] border-2 border-gray-100 dark:border-gold/30 overflow-hidden z-50 animate-in slide-in-from-bottom-10">
      <div className="bg-gray-50 dark:bg-gray-950 px-6 py-4 border-b border-gray-100 dark:border-gold/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full metallic-blue-bg dark:metallic-gold-bg flex items-center justify-center text-white dark:text-black">
             <i className="fa-solid fa-microphone-lines animate-pulse text-xs"></i>
          </div>
          <span className="text-[10px] font-black dark:metallic-gold uppercase tracking-[0.3em] italic">Audio Narrative</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-all p-2">
          <i className="fa-solid fa-times text-sm"></i>
        </button>
      </div>
      
      <div className="p-6 flex flex-col items-center gap-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-4">
             <i className="fa-solid fa-atom fa-spin text-mblue dark:text-gold text-2xl"></i>
             <span className="text-[9px] font-bold dark:text-gold/40 uppercase tracking-widest">Digitizing Script...</span>
          </div>
        ) : (
          <div className="w-full h-16 flex items-center justify-center">
            <p className="text-sm font-bold text-center text-gray-700 dark:text-gold/80 line-clamp-2 italic leading-relaxed">
              {sentences[currentIndex] || "Awaiting signal..."}
            </p>
          </div>
        )}

        <div className="flex items-center gap-10">
           <button onClick={handlePrev} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gold/60 hover:dark:text-gold transition-all active:scale-90 border dark:border-gold/10">
             <i className="fa-solid fa-backward-step text-lg"></i>
           </button>

           <button 
             onClick={() => setIsPlaying(!isPlaying)}
             className="w-20 h-20 flex items-center justify-center metallic-blue-bg dark:metallic-gold-bg text-white dark:text-black rounded-[2rem] shadow-2xl transition-all active:scale-95 group"
           >
             <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-3xl group-hover:scale-110 transition-transform ${!isPlaying ? 'translate-x-1' : ''}`}></i>
           </button>

           <button onClick={handleNext} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gold/60 hover:dark:text-gold transition-all active:scale-90 border dark:border-gold/10">
             <i className="fa-solid fa-forward-step text-lg"></i>
           </button>
        </div>

        <div className="w-full flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em]">
           <span className="text-gray-400 dark:text-gold/30">Sector {pageNumber}</span>
           <span className="px-3 py-1 rounded-full bg-mblue/10 dark:bg-gold/10 text-mblue dark:text-gold border dark:border-gold/20 animate-shine">{settings.speed}x Frequency</span>
           <span className="text-gray-400 dark:text-gold/30">{currentIndex + 1} / {sentences.length}</span>
        </div>
      </div>
    </div>
  );
};