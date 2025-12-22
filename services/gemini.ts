import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChatMessage, GeminiModel, BookMetadata, CategoryResult } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

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

  const systemInstruction = `
    You are a Professional Library Metadata Specialist. Your task is to categorize books into specific, high-value folders.

    CRITICAL RULE: Never use generic labels like "Book," "File," "Document," or "Reading Material." If a book is too hard to categorize, place it in "Unsorted" instead of a generic noun.

    Available Folder Hierarchy:
    ${hierarchy.map(h => `- ${h}`).join('\n')}

    Instructions:
    1. Analyze the filename, text snippet, and external subjects.
    2. Use Chain-of-Thought reasoning to identify the specific subject matter.
    3. Select the best matching folder from the hierarchy above.
    4. If the input is ambiguous (e.g. "Python"), use the text snippet to differentiate (e.g. coding vs zoology).
  `;

  const prompt = `
    Categorize this document:
    
    Filename: ${metadata.filename}
    Inferred Title: ${metadata.title || 'Unknown'}
    Author: ${metadata.author || 'Unknown'}
    External Subjects (Open Library): ${metadata.openLibrarySubjects?.join(', ') || 'N/A'}
    
    Extracted Text Snippet (First 800 chars): 
    "${metadata.extractedText.substring(0, 800)}"
  `;

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
             title: { type: Type.STRING, description: "The clean, formatted title of the book." },
             category: { type: Type.STRING, description: "The selected folder path from the hierarchy." },
             reason: { type: Type.STRING, description: "One sentence explaining the reasoning." },
             confidence: { type: Type.NUMBER, description: "Confidence score between 0 and 1." }
           },
           required: ["title", "category", "reason", "confidence"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // Fallback if AI hallucinates a category outside hierarchy
    let finalCategory = result.category;
    if (!hierarchy.includes(finalCategory)) {
        // Try to fuzzy match or default to Unsorted
        const partialMatch = hierarchy.find(h => finalCategory.includes(h) || h.includes(finalCategory));
        finalCategory = partialMatch || "Unsorted";
    }

    return {
      title: result.title || metadata.filename,
      category: finalCategory,
      reason: result.reason || "AI processing",
      confidence: result.confidence || 0.5
    };

  } catch (e) {
    console.error("AI Categorization Error", e);
    return {
      title: metadata.filename,
      category: "Unsorted",
      reason: "Error in AI processing",
      confidence: 0
    };
  }
};

// --- Legacy / Batch (kept for fallback but updated to use new types if needed) ---

export const batchCategorizeFiles = async (
  items: Array<{filename: string, snippet?: string}>
): Promise<Record<string, string>> => {
    // This function is kept for backward compatibility if needed, 
    // but the app should prefer categorizeBook for high accuracy.
    // For now, we will just map simple file-only categorization for bulk.
    // In a real refactor, we would loop categorizeBook.
    const map: Record<string, string> = {};
    for (const item of items) {
        map[item.filename] = "Unsorted"; // Placeholder if not implementing bulk logic here
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