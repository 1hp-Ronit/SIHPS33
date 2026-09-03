const axios = require('axios');
require('dotenv').config();

async function checkModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.get(url);
        
        console.log("✅ Models supporting text generation:");
        response.data.models.forEach(model => {
            // We only care about models that support standard text generation
            if (model.supportedGenerationMethods.includes("generateContent")) {
                // Stripping the "models/" prefix so you can copy the exact name
                console.log(model.name.replace('models/', '')); 
            }
        });
    } catch (error) {
        console.error("❌ Error fetching models:", error.message);
    }
}

checkModels();