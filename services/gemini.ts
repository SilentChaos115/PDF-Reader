import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, GeminiModel } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Lightweight categorizer that ONLY looks at the filename. 
// This is much faster and more reliable than processing full PDF text.
export const categorizeFileName = async (filename: string): Promise<string> => {
  // Legacy single file support - wraps batch
  const res = await batchCategorizeFiles([{ filename }]);
  return res[filename] || "General";
};

export const batchCategorizeFiles = async (
  items: Array<{filename: string, snippet?: string}>
): Promise<Record<string, string>> => {
  const ai = getAIClient();
  const categories = [
    "Finance", "Medical", "Work", "Education", 
    "Technology", "Travel", "Personal", "Comics", "Books", "General"
  ];

  try {
    // Construct descriptions that include snippets if available
    const filesList = items.map(i => {
       const content = i.snippet ? `, Content Start: "${i.snippet.replace(/"/g, "'").substring(0, 300)}..."` : "";
       return `{ "filename": "${i.filename}"${content} }`;
    }).join(',\n    ');

    const prompt = `Classify the following files into the most appropriate category based on filename and content preview.
    
    Guidelines:
    - Comics: Manga, manhwa, graphic novels, issues, volumes, superhero names (e.g. Batman), webtoons.
    - Books: Novels, non-fiction, biographies, anthologies, literary works.
    - Education: Textbooks, research papers, homework, academic journals, syllabus.
    - Work: Contracts, business docs, resumes, meeting minutes, proposals.
    - Finance: Invoices, receipts, taxes, bank statements, bills.
    - Technology: Manuals, code, specs, data logs, technical diagrams.
    - Medical: Prescriptions, lab results, insurance claims.
    - Travel: Tickets, itineraries, boarding passes.
    
    Input Data:
    [
    ${filesList}
    ]
    
    Return a JSON array of objects with 'filename' and 'category'.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
                filename: { type: Type.STRING },
                category: { type: Type.STRING, enum: categories }
             }
          }
        }
      }
    });

    let jsonStr = response.text || "[]";
    jsonStr = jsonStr.replace(/```json|```/g, '').trim();
    const resultArr = JSON.parse(jsonStr) as Array<{filename: string, category: string}>;
    
    const map: Record<string, string> = {};
    resultArr.forEach(item => {
        map[item.filename] = item.category;
    });
    
    return map;

  } catch (e) {
    console.warn("AI Batch Categorization failed.", e);
    return {};
  }
};

export const summarizeText = async (text: string, model: GeminiModel = 'gemini-3-flash-preview'): Promise<string> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Summarize the following text from a document page concisely:\n\n${text}`,
    });
    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating summary. Ensure your API Key is valid.";
  }
};

export const chatWithDocument = async (
  currentText: string,
  history: ChatMessage[],
  newMessage: string,
  model: GeminiModel = 'gemini-3-flash-preview'
): Promise<string> => {
  const ai = getAIClient();
  try {
    const contextPrompt = `You are a helpful reading assistant. The user is reading a document. 
    Here is the content of the current page they are looking at:
    "${currentText.substring(0, 5000)}"
    
    Answer the user's question based on this context if relevant, or general knowledge. Keep answers concise.`;

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: contextPrompt,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Sorry, I encountered an error processing your request.";
  }
};