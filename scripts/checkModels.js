require("dotenv").config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.TOKEN; // Adjust based on your .env key name
    
    // In your config, it seems you use LLM_SUMMARY_API_KEY_GEMINI
    const actualKey = process.env.LLM_SUMMARY_API_KEY_GEMINI || apiKey;

    if (!actualKey) {
        console.error("❌ No API Key found. Please check your .env file.");
        process.exit(1);
    }

    console.log("🔍 Fetching available Gemini models...");
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${actualKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return;
        }

        console.log("✅ Available Models:");
        console.log("--------------------------------------------------");
        
        data.models.forEach(model => {
            const support = model.supportedGenerationMethods.join(", ");
            console.log(`- ${model.name.replace('models/', '')}`);
            console.log(`  DisplayName: ${model.displayName}`);
            console.log(`  Methods: ${support}`);
            console.log("--------------------------------------------------");
        });

    } catch (error) {
        console.error("❌ Request failed:", error.message);
    }
}

listModels();
