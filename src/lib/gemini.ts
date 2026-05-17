import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function getGeminiModel(modelName?: string) {
  return client.getGenerativeModel({ model: modelName || DEFAULT_GEMINI_MODEL });
}
