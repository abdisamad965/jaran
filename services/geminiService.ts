import { GoogleGenAI } from "@google/genai";

// Always use the process.env.API_KEY string directly for initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getBusinessInsights = async (data: {
  sales: any[];
  expenses: any[];
  lowStock: any[];
}) => {
  try {
    const prompt = `
      As a business consultant, analyze the following recent data and provide 3-4 concise, actionable insights for the store owner.
      
      Sales Data Summary: ${JSON.stringify(data.sales.slice(0, 5))}
      Recent Expenses: ${JSON.stringify(data.expenses.slice(0, 5))}
      Low Stock Items: ${data.lowStock.map(p => p.name).join(', ')}

      Format your response as a bulleted list of short tips.
    `;

    // Use ai.models.generateContent with model name and prompt string
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Directly access the .text property to get the generated text content
    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at this time. Focus on maintaining stock levels and monitoring daily sales.";
  }
};