const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

async function compareScreenshotsWithAI(figmaPath, actualPath) {
  try {
    console.log("🔍 Reading screenshots...");
    const figmaImageBase64 = fs.readFileSync(figmaPath, { encoding: 'base64' });
    const actualImageBase64 = fs.readFileSync(actualPath, { encoding: 'base64' });

    console.log("📤 Sending payload to Gemini...");
    const payload = {
      contents: [
        {
          parts: [
            {
              text:
                "Compare the following UI screenshots. List all visible differences: layout, color, text, font, spacing, missing elements."
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: figmaImageBase64
              }
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: actualImageBase64
              }
            }
          ]
        }
      ]
    };

    const response = await axios.post(GEMINI_API_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Gemini API success!");
    return response.data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("❌ Gemini API Error:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
    throw error;
  }
}

module.exports = { compareScreenshotsWithAI };