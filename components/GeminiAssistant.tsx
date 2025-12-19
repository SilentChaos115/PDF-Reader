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
  pdfDoc, pageNumber, isOpen, onClose, initialMessage, initialType = 'summarize',
  onInitialMessageHandled, selectedModel, history, onUpdateHistory
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, isOpen]);

  useEffect(() => {
    if (isOpen && initialMessage && !loading) {
      const prompt = initialType === 'explain' ? `Explain this simply:\n\n"${initialMessage}"` : `Summarize:\n\n"${initialMessage}"`;
      onUpdateHistory(prev => [...prev, { role: 'user', text: initialType === 'explain' ? "Explain this..." : "Summarize this..." }]);
      (async () => {
        setLoading(true);
        try {
          if (!pdfDoc) return;
          const page = await pdfDoc.getPage(pageNumber);
          const pageText = await extractPageText(page);
          const response = await chatWithDocument(pageText || "", history, prompt, selectedModel);
          onUpdateHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) { onUpdateHistory(prev => [...prev, { role: 'model', text: "Error processing." }]); } 
        finally { setLoading(false); onInitialMessageHandled(); }
      })();
    }
  }, [isOpen, initialMessage, initialType]);

  const handleSend = async () => {
    if (!input.trim() || !pdfDoc) return;
    const userMsg = input; setInput('');
    onUpdateHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const text = await extractPageText(page);
      const response = await chatWithDocument(text || "", history, userMsg, selectedModel);
      onUpdateHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) { onUpdateHistory(prev => [...prev, { role: 'model', text: "Error." }]); }
    finally { setLoading(false); }
  };

  return (
    <div className={`fixed inset-y-0 right-0 z-[60] w-full sm:w-[400px] flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="absolute inset-0 bg-white/95 dark:bg-black/95 backdrop-blur-2xl border-l border-white/20 dark:border-white/5 shadow-[-20px_0_40px_rgba(0,0,0,0.1)]"></div>
      
      {/* Header */}
      <div className="relative z-10 p-5 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mblue to-mblue-dark dark:from-gold dark:to-gold-dark flex items-center justify-center text-white dark:text-black shadow-lg animate-pulse">
            <i className="fa-solid fa-sparkles text-xs"></i>
          </div>
          <div>
            <h3 className="font-bold text-sm dark:text-gray-100">AI Assistant</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Context: Page {pageNumber}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-times text-gray-500"></i>
        </button>
      </div>

      {/* Chat Area */}
      <div className="relative z-10 flex-1 overflow-y-auto p-5 space-y-6">
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-black dark:bg-white text-white dark:text-black rounded-br-sm' : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-bl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-gray-100 dark:bg-white/10 px-4 py-3 rounded-2xl rounded-bl-sm"><i className="fa-solid fa-circle-notch fa-spin text-gray-400"></i></div></div>}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input Area */}
      <div className="relative z-10 p-4 border-t border-gray-100 dark:border-white/5 bg-white/50 dark:bg-black/50 backdrop-blur-md">
        <div className="relative flex items-center">
           <input 
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about this page..."
              className="w-full bg-gray-100 dark:bg-white/10 border-none rounded-2xl pl-4 pr-12 py-3.5 text-sm outline-none focus:ring-1 focus:ring-mblue dark:focus:ring-gold transition-all"
           />
           <button onClick={handleSend} disabled={loading || !input.trim()} className="absolute right-2 w-9 h-9 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100">
             <i className="fa-solid fa-arrow-up text-xs"></i>
           </button>
        </div>
      </div>
    </div>
  );
};