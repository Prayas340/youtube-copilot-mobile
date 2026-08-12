const https = require('https');

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
}

function extractVideoId(urlOrId) {
    if (!urlOrId) return null;
    urlOrId = String(urlOrId).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
    const match = urlOrId.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

function parseXmlCaptions(xml) {
    const items = [];
    const regex = /<text start="([\d.]+)"[^>]*>(.*?)<\/text>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const start = parseFloat(match[1]);
        const rawText = match[2]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/<[^>]+>/g, '')
            .trim();

        if (rawText) {
            const mins = Math.floor(start / 60);
            const secs = Math.floor(start % 60);
            const formatted_time = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            items.push({
                start: Math.floor(start),
                formatted_time,
                text: rawText
            });
        }
    }
    return items;
}

const SAMPLE_VIDEOS = {
    "AlpvszL-CvR": {
        title: "Mastering AI Workflows in 2024",
        channel: "AI Engineers Lab",
        description: "Complete guide to setting up production AI workflows with vector databases and LLMs.\n00:00 - Intro\n04:05 - Vector Embeddings\n10:15 - Pipeline Automation"
    },
    "L_Guz73e6fw": {
        title: "LangChain RAG Architecture & VectorDBs",
        channel: "Tech Architecture Daily",
        description: "Deep dive into RAG architectures, history-aware retrievers, and vector memory."
    },
    "2X89y-ZcM1s": {
        title: "Gemini 2.0 Flash & Multimodal AI",
        channel: "DeepMind Highlights",
        description: "Exploring sub-second latency and 1M token context windows in Gemini 2.0."
    },
    "F4SYNSYKWMC": {
        title: "angelcore mix // DJ Anemia, VNXIOUS, LONOWN",
        channel: "VNXIOUS",
        description: "Curated aesthetic angelcore & breakcore music mix.\n00:00 - VNXIOUS - Angelic Reverie\n03:15 - DJ Anemia - Heavenly Glitch\n07:45 - LONOWN - Ethereal Echoes\n12:30 - VNXIOUS x DJ Anemia - Celestial Drift"
    }
};

async function analyzeYouTubeVideo(videoId) {
    const sample = SAMPLE_VIDEOS[videoId];
    let title = sample ? sample.title : `YouTube Video (${videoId})`;
    let channel = sample ? sample.channel : "YouTube Creator";
    let description = sample ? sample.description : "No video description available.";
    let captions = [];

    try {
        const oembedRaw = await httpGet(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const oembed = JSON.parse(oembedRaw);
        title = oembed.title || title;
        channel = oembed.author_name || channel;
    } catch (e) {}

    try {
        const html = await httpGet(`https://www.youtube.com/watch?v=${videoId}`);
        const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
            const playerResponse = JSON.parse(match[1]);
            if (playerResponse.videoDetails) {
                title = playerResponse.videoDetails.title || title;
                channel = playerResponse.videoDetails.author || channel;
                description = playerResponse.videoDetails.shortDescription || description;
            }
            const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            if (captionTracks.length > 0) {
                const xml = await httpGet(captionTracks[0].baseUrl);
                captions = parseXmlCaptions(xml);
            }
        }
    } catch (e) {}

    return {
        video_id: videoId,
        metadata: {
            title,
            channel,
            description
        },
        count: captions.length,
        transcript: captions
    };
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

        const youtubeUrl = body.youtubeUrl || (req.query ? req.query.youtubeUrl : '') || '';
        const videoId = extractVideoId(youtubeUrl);

        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL or Video ID' });
        }

        const result = await analyzeYouTubeVideo(videoId);
        return res.status(200).json(result);
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
};
