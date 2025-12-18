import React, { useEffect, useState } from 'react';
import { GeminiModel } from '../types';
import { clearTextCache, resetAppDatabase } from '../services/db';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  enableGemini: boolean;
  setEnableGemini: (enabled: boolean) => void;
  doubleTapEnabled: boolean;
  setDoubleTapEnabled: (enabled: boolean) => void;
  swipeEnabled: boolean;
  setSwipeEnabled: (enabled: boolean) => void;
  selectedModel: GeminiModel;
  setSelectedModel: (model: GeminiModel) => void;
  audioSettings: { speed: number; voice: string };
  setAudioSettings: (settings: { speed: number; voice: string }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, darkMode,
  enableGemini, setEnableGemini, doubleTapEnabled, setDoubleTapEnabled,
  swipeEnabled, setSwipeEnabled, selectedModel, setSelectedModel,
  audioSettings, setAudioSettings
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter for English only and prioritize higher quality "natural" sounding voices
      const filteredVoices = allVoices
        .filter(v => v.lang.startsWith('en'))
        .sort((a, b) => {
          const aLower = a.name.toLowerCase();
          const bLower = b.name.toLowerCase();
          const priorities = ['neural', 'google', 'premium', 'natural', 'enhanced'];
          
          const aPriority = priorities.findIndex(p => aLower.includes(p));
          const bPriority = priorities.findIndex(p => bLower.includes(p));
          
          if (aPriority !== bPriority) {
            // Found a priority word, lower index is better
            if (aPriority === -1) return 1;
            if (bPriority === -1) return -1;
            return aPriority - bPriority;
          }
          
          return a.name.localeCompare(b.name);
        });
      setVoices(filteredVoices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleClearCache = async () => {
    if (window.confirm("Clear all cached reading text? It will re-extract on next play.")) {
      await clearTextCache();
      alert("Cache cleared.");
    }
  };

  const handleResetApp = async () => {
    if (window.confirm("RESET ENTIRE APP? This will wipe your library, notes, and settings FOREVER.")) {
      if (window.confirm("ARE YOU ABSOLUTELY SURE?")) {
        await resetAppDatabase();
        window.location.reload();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-black rounded-[2.5rem] shadow-[0_0_80px_rgba(212,175,55,0.2)] w-full max-w-md overflow-hidden border-2 dark:border-gold/30 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b dark:border-gold/20 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
          <h2 className="text-xl font-black dark:metallic-gold uppercase tracking-[0.2em] italic">System Core</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gold/40 hover:dark:text-gold transition-all p-2">
            <i className="fa-solid fa-times text-lg"></i>
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Audiobook Settings */}
          <section>
            <h3 className="text-[10px] font-black dark:text-gold uppercase mb-4 tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-headphones-simple"></i> Audiobook Audio
            </h3>
            <div className="space-y-5">
              <div>
                <label className="text-[9px] font-bold text-gray-500 dark:text-gold/40 uppercase mb-2 block">Premium English Voices</label>
                <select 
                  value={audioSettings.voice}
                  onChange={(e) => setAudioSettings({ ...audioSettings, voice: e.target.value })}
                  className="w-full p-3 rounded-xl border-2 dark:border-gold/10 bg-gray-50 dark:bg-black text-sm dark:text-gold outline-none focus:border-mblue dark:focus:border-gold transition-all"
                >
                  <option value="">Neural System Default</option>
                  {voices.map(voice => (
                    <option key={voice.name} value={voice.name}>{voice.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-[9px] dark:text-gold/30 italic">Priority given to High-Definition & Natural voices.</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[9px] font-bold text-gray-500 dark:text-gold/40 uppercase">Playback Speed</label>
                  <span className="text-xs font-black dark:metallic-gold">{audioSettings.speed}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="2.0" step="0.1" 
                  value={audioSettings.speed} 
                  onChange={(e) => setAudioSettings({ ...audioSettings, speed: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-mblue dark:accent-gold"
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-gray-100 dark:bg-gold/10"></div>

          {/* AI Features */}
          <section>
            <h3 className="text-[10px] font-black text-gray-500 dark:text-gold uppercase mb-4 tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles"></i> AI Cognitive Core
            </h3>
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-bold dark:text-gold/80">Gemini Neural Link</span>
              <button 
                onClick={() => setEnableGemini(!enableGemini)} 
                className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${enableGemini ? 'metallic-blue-bg dark:metallic-gold-bg' : 'bg-gray-300 dark:bg-gray-800'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transform transition-transform duration-300 shadow-lg ${enableGemini ? 'translate-x-7' : 'translate-x-0'}`} />
              </button>
            </div>
            
            {enableGemini && (
              <div className="animate-in slide-in-from-top-2">
                <label className="text-[9px] font-bold text-gray-500 dark:text-gold/40 uppercase mb-2 block">Neural Model</label>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                  className="w-full p-3 rounded-xl border-2 dark:border-gold/10 bg-gray-50 dark:bg-black text-sm dark:text-gold outline-none focus:border-mblue dark:focus:border-gold transition-all font-bold"
                >
                  <option value="gemini-3-flash-preview">Flash (Efficient)</option>
                  <option value="gemini-3-pro-preview">Pro (Advanced Reasoning)</option>
                  <option value="gemini-flash-lite-latest">Lite (Minimalist)</option>
                </select>
              </div>
            )}
          </section>

          <div className="h-px bg-gray-100 dark:bg-gold/10"></div>

          {/* Maintenance */}
          <section className="space-y-4">
             <h3 className="text-[10px] font-black text-gray-500 dark:text-gold uppercase tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-screwdriver-wrench"></i> Maintenance
             </h3>
             <button 
               onClick={handleClearCache}
               className="w-full py-3 rounded-xl border-2 border-mblue/30 dark:border-gold/30 text-[10px] font-black uppercase tracking-widest text-mblue dark:text-gold hover:bg-mblue/5 dark:hover:bg-gold/5 transition-all"
             >
               Clear Reading Cache
             </button>
             <button 
               onClick={handleResetApp}
               className="w-full py-3 rounded-xl bg-red-600/10 border-2 border-red-600/30 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-600 hover:text-white transition-all"
             >
               FACTORY RESET APP
             </button>
          </section>
        </div>
      </div>
    </div>
  );
};