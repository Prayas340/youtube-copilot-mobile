const https = require('https');

function callGeminiAPI(prompt, apiKey, model = "gemini-3.6-flash") {
    return new Promise((resolve, reject) => {
        if (!model || model.includes("1.5") || model.includes("2.0") || model.includes("2.5")) {
            model = "gemini-3.6-flash";
        }

        const postData = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${model}:generateContent`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
                        const parts = json.candidates[0].content.parts || [];
                        const textPart = parts.find(p => p.text);
                        if (textPart) {
                            resolve(textPart.text);
                        } else {
                            resolve(JSON.stringify(parts));
                        }
                    } else if (json.error) {
                        reject(new Error(json.error.message || 'Gemini API Error'));
                    } else {
                        reject(new Error('Unexpected Gemini API response structure'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.setTimeout(12000, () => {
            req.destroy(new Error('Gemini API request timed out'));
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).send('OK');
    }

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) { body = {}; }
        }

        const DEFAULT_KEY = Buffer.from('QVEuQWI4Uk42S0pqN0Z0aXBHYS1ra09YTzRfM3RLTVF2MGdKNzFXVFVqcTlrbVdjczh3R1E=', 'base64').toString('utf-8');
        const { videoId, metadata, transcriptText, prompt, apiKey, model } = body;
        const keyToUse = apiKey || process.env.GOOGLE_API_KEY || DEFAULT_KEY;

        const metaTitle = metadata ? metadata.title : "YouTube Video";
        const metaChannel = metadata ? (metadata.channel || metadata.uploader) : "Creator";
        const metaDesc = metadata ? metadata.description : "No description provided.";

        const fullPrompt = `You are YouTube Copilot, an elite Google Gemini AI video copilot (built like YouTube's native "Ask Gemini" bar).
Your task is to answer ANY question about this video directly, intelligently, clearly, and comprehensively.

=== VIDEO DETAILS ===
Title: "${metaTitle}"
Channel: "${metaChannel}"
Video ID: "${videoId}"

=== VIDEO METADATA & DESCRIPTION ===
${metaDesc}

=== SPOKEN TRANSCRIPT CAPTIONS ===
${transcriptText || 'No spoken transcript captions available for this video.'}

=== INSTRUCTIONS & RULES ===
1. COMPREHENSIVE ANSWERING: Provide direct, high-intelligence, and detailed answers to the user's question. Explain key points, topics, code, concepts, or details covered in this video.
2. CLICKABLE TIMESTAMPS: Whenever you reference key events, timestamps, topics, or quotes from the transcript/description, include clickable Markdown timestamp links using format: [MM:SS](https://www.youtube.com/watch?v=${videoId}&t=Xs).
3. EXCELLENT FORMATTING: Use clean Markdown with bold headings, bullet points, and code blocks if relevant.

USER QUESTION:
${prompt}`;

        try {
            const aiResponse = await callGeminiAPI(fullPrompt, keyToUse, model || 'gemini-3.6-flash');
            return res.status(200).json({ answer: aiResponse });
        } catch (err) {
            console.error('Gemini API call error:', err.message);
            return res.status(500).json({ error: err.message || 'Gemini API Error' });
        }

    } catch (e) {
        return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
};
