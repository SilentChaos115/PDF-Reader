import React from 'react';
import { GoogleUser } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  googleUser: GoogleUser | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  enableGemini: boolean;
  setEnableGemini: (enabled: boolean) => void;
  doubleTapEnabled: boolean;
  setDoubleTapEnabled: (enabled: boolean) => void;
  swipeEnabled: boolean;
  setSwipeEnabled: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  toggleDarkMode,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  enableGemini,
  setEnableGemini,
  doubleTapEnabled,
  setDoubleTapEnabled,
  swipeEnabled,
  setSwipeEnabled
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-bold dark:text-white">Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Appearance */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Appearance & Control</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Dark Mode</span>
              <button 
                onClick={toggleDarkMode}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 flex items-center justify-center ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                   <i className={`text-xs fa-solid ${darkMode ? 'fa-moon text-blue-600' : 'fa-sun text-yellow-500'}`}></i>
                </div>
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                 <span className="text-gray-700 dark:text-gray-200 font-medium">Double-tap Fullscreen</span>
                 <span className="text-xs text-gray-500">Enable double-tap to toggle fullscreen</span>
              </div>
              <button 
                onClick={() => setDoubleTapEnabled(!doubleTapEnabled)}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${doubleTapEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${doubleTapEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                 <span className="text-gray-700 dark:text-gray-200 font-medium">Swipe to Turn</span>
                 <span className="text-xs text-gray-500">Swipe horizontal to change pages</span>
              </div>
              <button 
                onClick={() => setSwipeEnabled(!swipeEnabled)}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${swipeEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${swipeEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700"></div>

          {/* Account */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Google Account</h3>
            {googleUser ? (
              <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {googleUser.picture ? (
                     <img src={googleUser.picture} alt="Profile" className="w-10 h-10 rounded-full" />
                  ) : (
                     <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
                       {googleUser.name.charAt(0)}
                     </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold dark:text-white truncate">{googleUser.name}</p>
                    <p className="text-xs text-gray-500 truncate">{googleUser.email}</p>
                  </div>
                </div>
                <button onClick={onGoogleSignOut} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full">
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            ) : (
              <button 
                onClick={onGoogleSignIn}
                className="w-full py-2.5 px-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-3 text-sm font-medium dark:text-white"
              >
                <i className="fa-brands fa-google text-red-500"></i>
                Sign in with Google
              </button>
            )}
            
            {/* Drive Access Info */}
            <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
               <i className="fa-brands fa-google-drive mt-0.5"></i>
               <p>Sign in to access PDF files directly from your Google Drive.</p>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700"></div>

          {/* AI Features */}
          <div>
             <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">AI Features</h3>
             <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-200 font-medium">Gemini Assistant</span>
                <span className="text-xs text-gray-500">Chat overlay for summaries & Q&A</span>
              </div>
              <button 
                onClick={() => setEnableGemini(!enableGemini)}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${enableGemini ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${enableGemini ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
            {enableGemini && !process.env.API_KEY && (
               <p className="text-xs text-red-500 mt-2">API Key environment variable required.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};