import React, { useState } from 'react';
import { summarizeText, } from '../services/gemini';
import { extractPageText } from '../services/pdfHelper';
import { PDFDocumentProxy, Highlight } from '../types';

interface NotesPanelProps {
  notes: string;
  updateNotes: (text: string) => void;
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  highlights: Highlight[];
  goToPage: (page: number) => void;
  deleteHighlight: (id: string) => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ 
  notes, 
  updateNotes, 
  pdfDoc, 
  pageNumber, 
  highlights, 
  goToPage, 
  deleteHighlight 
}) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'highlights'>('editor');

  const handleSummarize = async () => {
    if (!pdfDoc) return;
    setAiLoading(true);
    setSummary(null);
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const text = await extractPageText(page);
      
      if (!text.trim()) {
        setSummary("This page appears to be empty or contains only images.");
        return;
      }

      const result = await summarizeText(text);
      setSummary(result);
    } catch (e) {
      setSummary("Failed to analyze page.");
    } finally {
      setAiLoading(false);
    }
  };

  const appendSummary = () => {
    if (summary) {
      const newNotes = notes ? `${notes}\n\n[Page ${pageNumber} Summary]: ${summary}` : `[Page ${pageNumber} Summary]: ${summary}`;
      updateNotes(newNotes);
      setSummary(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-white dark:bg-gray-850 shadow-sm border-b dark:border-gray-700">
        <div className="flex items-center">
           <button 
             onClick={() => setActiveTab('editor')}
             className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'editor' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
           >
             Editor
           </button>
           <button 
             onClick={() => setActiveTab('highlights')}
             className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'highlights' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
           >
             Highlights ({highlights.length})
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'editor' && (
          <div className="absolute inset-0 flex flex-col">
            <div className="p-3 flex justify-between items-center bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
               <span className="text-xs text-gray-500 font-medium">Page {pageNumber}</span>
               {process.env.API_KEY && (
                <button 
                  onClick={handleSummarize}
                  disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                  Summarize Page
                </button>
               )}
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto">
               {summary && (
                <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 rounded-lg">
                   <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300">
                        <i className="fa-solid fa-robot mr-2"></i>AI Summary
                      </h3>
                      <button onClick={() => setSummary(null)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-times"></i></button>
                   </div>
                   <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3">{summary}</p>
                   <button 
                     onClick={appendSummary}
                     className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                   >
                     + Add to notes
                   </button>
                </div>
               )}
               <textarea 
                  value={notes} 
                  onChange={(e) => updateNotes(e.target.value)}
                  className="w-full h-full min-h-[50vh] bg-transparent resize-none outline-none text-base leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400"
                  placeholder="Type your notes here... Notes are automatically saved for this file name."
               />
            </div>
          </div>
        )}

        {activeTab === 'highlights' && (
           <div className="absolute inset-0 overflow-y-auto p-4 space-y-3">
             {highlights.length === 0 ? (
               <div className="text-center text-gray-400 mt-10">
                 <i className="fa-solid fa-highlighter text-3xl mb-2 opacity-30"></i>
                 <p>No highlights yet.</p>
               </div>
             ) : (
               highlights.sort((a,b) => a.page - b.page).map(h => (
                 <div key={h.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 group">
                   <div className="flex justify-between items-start mb-2">
                     <button onClick={() => goToPage(h.page)} className="text-xs font-bold text-blue-500 hover:underline">
                       Page {h.page}
                     </button>
                     <button onClick={() => deleteHighlight(h.id)} className="text-gray-400 hover:text-red-500">
                       <i className="fa-solid fa-trash-can"></i>
                     </button>
                   </div>
                   <div className="pl-2 border-l-4" style={{ borderColor: h.color }}>
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{h.text}"</p>
                   </div>
                 </div>
               ))
             )}
           </div>
        )}
      </div>
    </div>
  );
};
