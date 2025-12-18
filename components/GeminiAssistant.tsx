import React, { useState, useRef, useEffect } from 'react';
import { chatWithDocument } from '../services/gemini';
import { extractPageText } from '../services/pdfHelper';
import { PDFDocumentProxy, ChatMessage } from '../types';

interface GeminiAssistantProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  isOpen: boolean;
  onClose: () => void;
  initialMessage: string | null;
  onInitialMessageHandled: () => void;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({
  pdfDoc,
  pageNumber,
  isOpen,
  onClose,
  initialMessage,
  onInitialMessageHandled
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hi! I can help you summarize this page or answer questions about it.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasHandledInitialRef = useRef(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle Initial Message (Selection Summarization)
  useEffect(() => {
    const processInitialMessage = async () => {
      if (isOpen && initialMessage && !loading && !hasHandledInitialRef.current) {
        hasHandledInitialRef.current = true;
        const prompt = `Please summarize the following text:\n\n"${initialMessage}"`;
        
        // Add user message to UI immediately
        setMessages(prev => [...prev, { role: 'user', text: "Summarize this selection..." }]);
        setLoading(true);

        try {
          // We pass the selection as the context for this specific query if possible, 
          // or just ask the model to process the prompt provided.
          // Since chatWithDocument builds context from the PAGE, we'll append this specific request.
          
          if (!pdfDoc) {
             setMessages(prev => [...prev, { role: 'model', text: "Document not loaded." }]);
             setLoading(false);
             onInitialMessageHandled();
             return;
          }

          const page = await pdfDoc.getPage(pageNumber);
          const pageText = await extractPageText(page);
          
          const response = await chatWithDocument(
            pageText || "No page text.", 
            messages, 
            prompt
          );
          
          setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
          setMessages(prev => [...prev, { role: 'model', text: 'Error connecting to Gemini.' }]);
        } finally {
          setLoading(false);
          onInitialMessageHandled();
          // Reset ref if the modal closes? No, keep it true for this session lifecycle or depend on initialMessage change
        }
      }
    };

    processInitialMessage();
  }, [isOpen, initialMessage, pdfDoc, pageNumber]); // Remove onInitialMessageHandled from dep to avoid loop

  // Reset handled flag when initialMessage changes (new selection)
  useEffect(() => {
    if (initialMessage) {
        hasHandledInitialRef.current = false;
    }
  }, [initialMessage]);

  const handleSend = async () => {
    if (!input.trim() || !pdfDoc) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const text = await extractPageText(page);
      
      const response = await chatWithDocument(
        text || "No text on this page (might be an image).", 
        messages, 
        userMsg
      );
      
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Error connecting to Gemini.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 w-80 h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden z-40 animate-in slide-in-from-right-10 duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-3 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-spa"></i>
          <span className="font-bold text-sm tracking-wide">Zen Assistant</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-times text-xs"></i>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-900">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-teal-600 text-white rounded-br-none' 
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-2 shadow-sm">
               <div className="flex gap-1">
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div>
               </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button 
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="w-9 h-9 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-colors"
        >
          <i className="fa-solid fa-paper-plane text-xs"></i>
        </button>
      </div>
    </div>
  );
};