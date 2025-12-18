import React, { useState, useRef, useEffect } from 'react';
import { chatWithDocument } from '../services/gemini';
import { extractPageText } from '../services/pdfHelper';
import { PDFDocumentProxy, ChatMessage, GeminiModel } from '../types';

interface GeminiAssistantProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  isOpen: boolean;
  onClose: () => void;
  initialMessage: string | null;
  initialType?: 'summarize' | 'explain';
  onInitialMessageHandled: () => void;
  selectedModel: GeminiModel;
  history: ChatMessage[];
  onUpdateHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({
  pdfDoc, 
  pageNumber, 
  isOpen, 
  onClose, 
  initialMessage, 
  initialType = 'summarize',
  onInitialMessageHandled, 
  selectedModel,
  history,
  onUpdateHistory
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isOpen]);

  useEffect(() => {
    if (isOpen && initialMessage && !loading) {
      const prompt = initialType === 'explain' 
        ? `Explain this concept or passage in simple terms:\n\n"${initialMessage}"`
        : `Summarize the following selection:\n\n"${initialMessage}"`;
        
      const userDisplay = initialType === 'explain' ? "Explain this selection..." : "Summarize this selection...";
      
      onUpdateHistory(prev => [...prev, { role: 'user', text: userDisplay }]);
      
      (async () => {
        setLoading(true);
        try {
          if (!pdfDoc) return;
          const page = await pdfDoc.getPage(pageNumber);
          const pageText = await extractPageText(page);
          const response = await chatWithDocument(pageText || "", history, prompt, selectedModel);
          onUpdateHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
           onUpdateHistory(prev => [...prev, { role: 'model', text: "Sorry, I couldn't process that selection." }]);
        } finally { 
          setLoading(false); 
          onInitialMessageHandled(); 
        }
      })();
    }
  }, [isOpen, initialMessage, initialType]);

  const handleSend = async () => {
    if (!input.trim() || !pdfDoc) return;
    const userMsg = input; 
    setInput('');
    onUpdateHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const text = await extractPageText(page);
      const response = await chatWithDocument(text || "", history, userMsg, selectedModel);
      onUpdateHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      onUpdateHistory(prev => [...prev, { role: 'model', text: "I encountered an error. Please try again." }]);
    } finally { 
      setLoading(false); 
    }
  };

  const clearChat = () => {
    if (window.confirm("Clear conversation history for this PDF?")) {
      onUpdateHistory([{ role: 'model', text: 'Hi! I can help you summarize this page or answer questions about it.' }]);
    }
  };

  if (!isOpen) return null;

  const containerClasses = isFullscreen 
    ? "fixed inset-0 z-[100] bg-white/95 dark:bg-black/95 backdrop-blur-3xl flex flex-col transition-all duration-300"
    : "fixed bottom-24 right-4 w-80 h-[450px] bg-white/95 dark:bg-black/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border dark:border-gold/30 flex flex-col overflow-hidden z-[60] animate-in slide-in-from-right-10";

  return (
    <div className={containerClasses}>
      <div className="bg-mblue dark:bg-gold p-4 flex justify-between items-center text-white dark:text-black shrink-0 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 animate-shine shimmer"></div>
        <div className="flex items-center gap-3 relative z-10">
          <i className="fa-solid fa-sparkles text-sm"></i>
          <span className="font-black text-xs uppercase tracking-widest italic">Neural Link</span>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <button onClick={clearChat} className="hover:bg-black/20 rounded-xl w-9 h-9 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-trash-can text-xs"></i>
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="hover:bg-black/20 rounded-xl w-9 h-9 flex items-center justify-center transition-colors">
            <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs`}></i>
          </button>
          <button onClick={onClose} className="hover:bg-black/20 rounded-xl w-9 h-9 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-transparent scrollbar-hide">
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-mblue dark:bg-gold text-white dark:text-black font-bold rounded-br-none shadow-mblue/20 dark:shadow-gold/20' 
                : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gold/90 border dark:border-gold/20 rounded-bl-none shadow-xl'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-mblue dark:text-gold/60 text-[10px] font-black uppercase tracking-widest ml-2 animate-pulse">
            <i className="fa-solid fa-atom fa-spin"></i>
            Neural link processing...
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      <div className="p-4 bg-white/50 dark:bg-black/50 border-t dark:border-gold/20 flex gap-3 shrink-0 backdrop-blur-md">
        <input 
          type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
          placeholder="Sync thought..." className="flex-1 bg-gray-100 dark:bg-gray-900 border dark:border-gold/10 text-sm rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-mblue dark:focus:ring-gold transition-all dark:text-white font-bold"
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="w-12 h-12 metallic-blue-bg dark:metallic-gold-bg text-white dark:text-black rounded-2xl flex items-center justify-center disabled:opacity-30 hover:shadow-xl transition-all active:scale-90">
          <i className="fa-solid fa-paper-plane text-sm"></i>
        </button>
      </div>
    </div>
  );
};