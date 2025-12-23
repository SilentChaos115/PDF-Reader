import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChatMessage, GeminiModel, BookMetadata, CategoryResult } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Advanced Categorization ---

export const categorizeBook = async (metadata: BookMetadata): Promise<CategoryResult> => {
  const ai = getAIClient();

  // Predefined Folder Hierarchy
  const hierarchy = [
    "Technical/Coding",
    "Technical/Hardware", 
    "Technical/DataScience",
    "Technical/Engineering",
    "Education/Guides",
    "Education/Textbooks",
    "Education/Research",
    "Fiction/Thriller",
    "Fiction/SciFi",
    "Fiction/Fantasy", 
    "Fiction/General",
    "History/Modern",
    "History/Ancient",
    "Business/Finance",
    "Business/Management",
    "Personal/Health",
    "Personal/Finance",
    "Comics/Manga",
    "Comics/Western",
    "Unsorted"
  ];

  // Compact instruction to save tokens
  const systemInstruction = `
    Categorize books into: ${hierarchy.join(', ')}.
    Rule: No generic labels (e.g. "Book"). Use "Unsorted" if unclear.
  `;

  // Reduced snippet length (600) to save tokens
  const prompt = `
    File: ${metadata.filename}
    Title: ${metadata.title || 'Unknown'}
    Author: ${metadata.author || 'Unknown'}
    Subjects: ${metadata.openLibrarySubjects?.slice(0, 3).join(', ') || 'N/A'}
    Snippet: "${metadata.extractedText.substring(0, 600)}"
  `;

  let attempts = 0;
  const maxAttempts = 3; // Reduced internal retries as the Queue handles long waits

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.OBJECT,
             properties: {
               title: { type: Type.STRING },
               category: { type: Type.STRING },
               reason: { type: Type.STRING },
               confidence: { type: Type.NUMBER }
             },
             required: ["title", "category", "reason", "confidence"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      let finalCategory = result.category;
      if (!hierarchy.includes(finalCategory)) {
          const partialMatch = hierarchy.find(h => finalCategory.includes(h) || h.includes(finalCategory));
          finalCategory = partialMatch || "Unsorted";
      }

      return {
        title: result.title || metadata.filename,
        category: finalCategory,
        reason: result.reason || "AI processing",
        confidence: result.confidence || 0.5
      };

    } catch (e: any) {
      let isRateLimit = false;

      if (e.status === 429) isRateLimit = true;
      if (e.response?.status === 429) isRateLimit = true;
      if (e.error?.code === 429) isRateLimit = true;
      if (e.error?.status === 'RESOURCE_EXHAUSTED') isRateLimit = true;
      
      const msg = e.message || (e.error?.message) || '';
      if (typeof msg === 'string' && (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED'))) {
         isRateLimit = true;
      }

      // If Rate limit, propagate it up to the Queue manager immediately after 1 quick internal retry
      if (isRateLimit) {
          if (attempts < 1) {
              attempts++;
              await delay(2000); 
              continue;
          }
          console.warn("Gemini Rate Limit Hit - propagating to queue manager.");
          return {
            title: metadata.filename,
            category: "Unsorted",
            reason: "Quota Exceeded", // Key string used by LibraryModal to trigger 60s pause
            confidence: 0
          };
      }

      console.error("AI Categorization Error", e);
      // For other errors (hallucination/format), just fail safely
      return {
        title: metadata.filename,
        category: "Unsorted",
        reason: "Error in AI processing",
        confidence: 0
      };
    }
  }

  return {
      title: metadata.filename,
      category: "Unsorted",
      reason: "Failed after max retries",
      confidence: 0
  };
};

export const batchCategorizeFiles = async (
  items: Array<{filename: string, snippet?: string}>
): Promise<Record<string, string>> => {
    const map: Record<string, string> = {};
    for (const item of items) {
        map[item.filename] = "Unsorted";
    }
    return map;
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