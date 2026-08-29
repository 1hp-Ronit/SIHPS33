const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash'});



/**
 * Analyzes a crop image to determine quality grading.
 */
async function gradeCropImage(base64Image, mimeType = 'image/jpeg') {
    const prompt = `
You are an expert agricultural quality inspector for an open marketplace.
Look at this image of the crop and grade its quality based on visual appearance (color, freshness, defects).
Return ONLY valid JSON matching this exact schema:
{
  "quality_grade": string,  // e.g., "Grade A (Premium)", "Grade B (Standard)", "Grade C (Processing)"
  "visual_notes": string    // A short 1-sentence description of what you see (e.g., "Bright red, no visible blemishes")
}
Do not include markdown code block backticks. Output pure JSON only.`;

    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType
        }
    };

    try {
        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text().trim();
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('Error in AI image grading:', error);
        return { quality_grade: "Unverified", visual_notes: "Could not analyze image." };
    }
}
/**
 * Extracts structured crop details from unstructured farmer message.
 */
async function parseFarmerMessage(userMessage) {
    const prompt = `
You are an AI assistant for an agricultural marketplace on the Beckn protocol.
Extract crop listing details from the following farmer message.
Support any language (Hindi, English, Hinglish, etc.).

Farmer message: "${userMessage}"

Return ONLY valid JSON matching this exact schema:
{
  "is_listing": boolean,       // true if farmer is offering crops/produce to sell, false otherwise
  "item_name": string | null,  // normalized crop name in English (e.g., "Tomato", "Wheat", "Onion")
  "quantity": number | null,   // numeric quantity
  "unit": string | null,       // e.g. "kg", "quintal", "ton", "crate"
  "price_per_unit": number | null, // numeric price in INR
  "currency": "INR",
  "location": string | null    // city or village if specified
}

Do not include markdown code block backticks (\`\`\`json). Output pure JSON only.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        
        // Sanitize output in case backticks are returned
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('Error in AI parsing:', error);
        return { is_listing: false };
    }
}



/**
 * Extracts structured details directly from a voice note using Gemini's native audio support.
 */
async function parseFarmerAudio(base64Audio, mimeType = 'audio/ogg') {
    const prompt = `
You are an AI assistant for an agricultural marketplace.
Listen to this voice message from a farmer (it may be in Hindi, English, or Hinglish).
Extract the crop listing details and return ONLY valid JSON matching this exact schema:
{
  "is_listing": boolean,
  "item_name": string | null,
  "quantity": number | null,
  "unit": string | null,
  "price_per_unit": number | null,
  "currency": "INR",
  "location": string | null
}
Do not include markdown code block backticks. Output pure JSON only.`;

    const audioPart = {
        inlineData: {
            data: base64Audio,
            mimeType: mimeType
        }
    };

    try {
        const result = await model.generateContent([prompt, audioPart]);
        const text = result.response.text().trim();
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('Error in AI audio parsing:', error);
        return { is_listing: false };
    }
}


module.exports = { parseFarmerMessage, parseFarmerAudio, gradeCropImage };