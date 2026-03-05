import { GoogleGenAI } from "@google/genai";

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        },
        {
          text: "Transcribe this audio file accurately. Return only the transcribed text."
        }
      ]
    }
  });

  return response.text || "";
};
