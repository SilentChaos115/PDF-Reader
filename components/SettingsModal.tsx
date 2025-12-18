import React from 'react';
import { GeminiModel } from '../types';

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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, darkMode,
  enableGemini, setEnableGemini, doubleTapEnabled, setDoubleTapEnabled,
  swipeEnabled, setSwipeEnabled, selectedModel, setSelectedModel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95"
      >
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-bold dark:text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* AI Features */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 tracking-wider">AI Reading Companion</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Gemini Assistant</span>
              <button 
                onClick={() => setEnableGemini(!enableGemini)} 
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${enableGemini ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transform transition-transform duration-200 ${enableGemini ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            
            {enableGemini && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="text-xs text-gray-500 block mb-2">Selected Intelligence</label>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                  className="w-full p-2.5 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash (Fastest)</option>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro (Complex Reasoning)</option>
                  <option value="gemini-flash-lite-latest">Gemini Lite (Lightweight)</option>
                </select>
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700"></div>

          {/* Preferences */}
          <div className="space-y-4">
             <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Interface</h3>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-200 font-medium">Auto Dark Mode</span>
                <span className="text-[10px] text-gray-400">Synced with device settings</span>
              </div>
              <i className="fa-solid fa-circle-check text-blue-500"></i>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Swipe to Turn Pages</span>
              <button onClick={() => setSwipeEnabled(!swipeEnabled)} className="text-xl text-gray-400 transition-colors">
                <i className={`fa-solid ${swipeEnabled ? 'fa-toggle-on text-blue-500' : 'fa-toggle-off'}`}></i>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Double-Tap Fullscreen</span>
              <button onClick={() => setDoubleTapEnabled(!doubleTapEnabled)} className="text-xl text-gray-400 transition-colors">
                <i className={`fa-solid ${doubleTapEnabled ? 'fa-toggle-on text-blue-500' : 'fa-toggle-off'}`}></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};