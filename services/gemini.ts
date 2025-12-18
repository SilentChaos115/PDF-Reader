import { GoogleGenAI } from "@google/genai";
import { ChatMessage, GeminiModel } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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