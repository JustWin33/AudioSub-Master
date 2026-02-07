import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleSegment } from "../types";

// Using the recommended model for basic/multimodal tasks as per instructions
const MODEL_NAME = "gemini-3-flash-preview";

export const transcribeAudio = async (
  base64Audio: string, 
  mimeType: string,
  apiKey: string
): Promise<SubtitleSegment[]> => {
  if (!apiKey) {
    throw new Error("缺少 API 密钥。请检查您的环境配置。");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a professional subtitle translator and transcriber. 
    Your task is to analyze the provided audio file.
    1. Accurately transcribe every sentence (Original).
    2. Translate the sentence: 
       - If Original is English -> Translate to Simplified Chinese.
       - If Original is Chinese -> Translate to English.
       - If Mixed, translate to the other language primarily.
    3. Provide precise start and end timestamps in milliseconds.
    4. Ensure the segmentation is logical (by sentence or phrase).
    5. Return the result strictly as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: "Generate subtitles for this audio."
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startMs: { type: Type.INTEGER, description: "Start time in milliseconds" },
              endMs: { type: Type.INTEGER, description: "End time in milliseconds" },
              original: { type: Type.STRING, description: "The transcribed original text" },
              translation: { type: Type.STRING, description: "The translated text" }
            },
            required: ["startMs", "endMs", "original", "translation"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Gemini 没有响应。");
    }

    const parsed = JSON.parse(jsonText);
    
    // Validate and map to ensure we have IDs
    return parsed.map((item: any, index: number) => ({
      id: index + 1,
      startMs: item.startMs,
      endMs: item.endMs,
      original: item.original,
      translation: item.translation
    }));

  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
};
