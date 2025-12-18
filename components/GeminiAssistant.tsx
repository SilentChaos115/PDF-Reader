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
      const prompt = `Please summarize the following selection:\n\n"${initialMessage}"`;
      onUpdateHistory(prev => [...prev, { role: 'user', text: "Summarize this selection..." }]);
      (async () => {
        setLoading(true);
        try {
          if (!pdfDoc) return;
          const page = await pdfDoc.getPage(pageNumber);
          const pageText = await extractPageText(page);
          const response = await chatWithDocument(pageText || "", history, prompt, selectedModel);
          onUpdateHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
           onUpdateHistory(prev => [...prev, { role: 'model', text: "Sorry, I couldn't summarize that selection." }]);
        } finally { 
          setLoading(false); 
          onInitialMessageHandled(); 
        }
      })();
    }
  }, [isOpen, initialMessage, pdfDoc, pageNumber, selectedModel]);

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
    ? "fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col transition-all duration-300"
    : "fixed bottom-24 right-4 w-80 h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border dark:border-gray-700 flex flex-col overflow-hidden z-40 animate-in slide-in-from-right-10";

  return (
    <div className={containerClasses}>
      <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-3 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-spa"></i>
          <span className="font-bold text-sm">Zen Assistant</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-tighter">{selectedModel.split('-')[2] || 'Flash'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} className="hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center" title="Clear Chat">
            <i className="fa-solid fa-trash-can text-xs"></i>
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
            <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs`}></i>
          </button>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border dark:border-gray-700 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-xs italic ml-2">
            <i className="fa-solid fa-circle-notch fa-spin"></i>
            Gemini is thinking...
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2 shrink-0">
        <input 
          type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
          placeholder="Ask anything..." className="flex-1 bg-gray-100 dark:bg-gray-700 text-sm rounded-full px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-teal-700 transition-colors">
          <i className="fa-solid fa-paper-plane text-xs"></i>
        </button>
      </div>
    </div>
  );
};