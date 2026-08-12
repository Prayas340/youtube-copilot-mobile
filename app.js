/* ==========================================================================
   UNIVERSAL INTERACTIVE JAVASCRIPT - YOUTUBE COPILOT WEB APP
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
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

    let currentVideoId = null;
    let activeMetadata = null;
    let activeTranscriptData = [];

    // --- DOM ELEMENTS ---
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileSidebarCloseBtn = document.getElementById('mobile-sidebar-close-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const pageViews = document.querySelectorAll('.page-view');
    const pageTitleHeading = document.getElementById('page-title-heading');
    const youtubeUrlInput = document.getElementById('youtube-url-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const sampleChips = document.querySelectorAll('.sample-chip');
    const youtubePlayer = document.getElementById('youtube-player');
    const activeVideoTitle = document.getElementById('active-video-title');
    const videoIdBadge = document.getElementById('video-id-badge');
    const videoPlaceholderCard = document.getElementById('video-placeholder-card');
    const loadedVideoCard = document.getElementById('loaded-video-card');
    const chatContextTitle = document.getElementById('chat-context-title');
    const chatMessagesArea = document.getElementById('chat-messages-area');
    const chatInputField = document.getElementById('chat-input-field');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const micBtn = document.getElementById('mic-btn');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');
    const toastContainer = document.getElementById('toast-container');

    // --- 1. TOAST NOTIFICATIONS ---
    function showToast(message, icon = 'check_circle') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span class="material-symbols-outlined" style="color: var(--primary-cyan);">${icon}</span><span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- MOBILE DRAWER NAVIGATION HANDLERS ---
    function openMobileSidebar() {
        document.body.classList.add('sidebar-mobile-open');
    }

    function closeMobileSidebar() {
        document.body.classList.remove('sidebar-mobile-open');
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', openMobileSidebar);
    }
    if (mobileSidebarCloseBtn) {
        mobileSidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // --- 2. VIEW NAVIGATION ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = link.getAttribute('data-view');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            pageViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === `view-${targetView}`) view.classList.add('active');
            });

            if (targetView === 'dashboard') pageTitleHeading.textContent = 'Universal Video Intelligence';
            if (targetView === 'model-settings') pageTitleHeading.textContent = 'Model & Engine Settings';

            // Close sidebar on mobile after clicking navigation item
            closeMobileSidebar();
        });
    });

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
    }

    let isDark = true;
    themeToggleBtn.addEventListener('click', () => {
        isDark = !isDark;
        document.body.classList.toggle('light-theme', !isDark);
        const icon = themeToggleBtn.querySelector('.material-symbols-outlined');
        icon.textContent = isDark ? 'dark_mode' : 'light_mode';
        showToast(isDark ? 'Dark Obsidian Theme Enabled' : 'Light Theme Enabled', isDark ? 'dark_mode' : 'light_mode');
    });

    function extractVideoId(urlOrId) {
        if (!urlOrId) return null;
        urlOrId = urlOrId.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
        const match = urlOrId.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    }

    async function loadVideoData(videoId) {
        currentVideoId = videoId;
        showToast('Loading Video Metadata & Captions...', 'cloud_download');
        
        youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
        videoPlaceholderCard.style.display = 'none';
        loadedVideoCard.style.display = 'block';

        let videoMeta = { title: `YouTube Video (${videoId})`, channel: "YouTube Creator", description: "" };
        let transcriptList = [];

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: videoId })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.metadata) videoMeta = data.metadata;
                if (data.transcript) transcriptList = data.transcript;
            } else {
                if (SAMPLE_VIDEOS[videoId]) {
                    videoMeta = SAMPLE_VIDEOS[videoId];
                }
            }
        } catch (e) {
            if (SAMPLE_VIDEOS[videoId]) {
                videoMeta = SAMPLE_VIDEOS[videoId];
            }
        }

        activeMetadata = videoMeta;
        activeTranscriptData = transcriptList;

        activeVideoTitle.textContent = videoMeta.title;
        videoIdBadge.textContent = `ID: ${videoId}`;
        chatContextTitle.textContent = videoMeta.title;

        showToast(`Video "${videoMeta.title.substring(0, 24)}..." Ready`, 'smart_display');

        const chatEmptyState = document.getElementById('chat-empty-state');
        if (chatEmptyState) {
            chatEmptyState.style.display = 'flex';
        }
    }

    analyzeBtn.addEventListener('click', () => {
        const val = youtubeUrlInput.value.trim();
        const extractedId = extractVideoId(val);
        if (extractedId) {
            loadVideoData(extractedId);
        } else {
            showToast('Please enter a valid YouTube URL or Video ID', 'error');
        }
    });

    youtubeUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeBtn.click();
    });

    sampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            sampleChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const vId = chip.getAttribute('data-video-id');
            youtubeUrlInput.value = `https://www.youtube.com/watch?v=${vId}`;
            loadVideoData(vId);
        });
    });

    function seekToTimestamp(seconds) {
        if (currentVideoId) {
            youtubePlayer.src = `https://www.youtube.com/embed/${currentVideoId}?autoplay=1&start=${seconds}&enablejsapi=1`;
            showToast(`Seeking Video to ${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`, 'timer');
        }
    }

    function addMessageToUI(sender, text, timestampLinks = []) {
        const emptyState = document.getElementById('chat-empty-state');
        if (emptyState) emptyState.style.display = 'none';

        const row = document.createElement('div');
        row.className = `message-row ${sender}`;

        let parsedHtml = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');

        const timestampRegex = /\[(\d{1,2}:\d{2})\](?::\s*([^\n<]+))?/g;
        parsedHtml = parsedHtml.replace(timestampRegex, (match, timeStr, descStr) => {
            const parts = timeStr.split(':');
            const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            let buttonHtml = `<button class="timestamp-btn" data-time="${seconds}"><span class="material-symbols-outlined" style="font-size:14px;">play_arrow</span> ${timeStr}</button>`;
            if (descStr) {
                buttonHtml += ` <strong>${descStr.trim()}</strong>`;
            }
            return buttonHtml;
        });

        row.innerHTML = `<div class="chat-bubble">${parsedHtml}</div>`;
        chatMessagesArea.appendChild(row);
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

        row.querySelectorAll('.timestamp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const secs = parseInt(btn.getAttribute('data-time'));
                seekToTimestamp(secs);
            });
        });
    }

    function addTypingIndicator() {
        const row = document.createElement('div');
        row.className = 'message-row ai';
        row.id = 'typing-indicator-row';
        row.innerHTML = `
            <div class="chat-bubble typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatMessagesArea.appendChild(row);
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('typing-indicator-row');
        if (el) el.remove();
    }

    async function sendChatMessage() {
        const query = chatInputField.value.trim();
        if (!query) return;

        if (!currentVideoId) {
            showToast('Please load a YouTube video first!', 'warning');
            return;
        }

        addMessageToUI('user', query);
        chatInputField.value = '';
        addTypingIndicator();

        let transcriptSummaryStr = "";
        if (activeTranscriptData && activeTranscriptData.length > 0) {
            transcriptSummaryStr = activeTranscriptData.map(item => `[${item.formatted_time}] ${item.text}`).join('\n');
            if (transcriptSummaryStr.length > 50000) {
                transcriptSummaryStr = transcriptSummaryStr.substring(0, 50000) + "\n...[Transcript Truncated]";
            }
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: currentVideoId,
                    metadata: activeMetadata,
                    transcriptText: transcriptSummaryStr,
                    prompt: query
                })
            });

            removeTypingIndicator();

            if (response.ok) {
                const data = await response.json();
                addMessageToUI('ai', data.answer || 'I have analyzed your request.');
            } else {
                const errData = await response.json();
                addMessageToUI('ai', `⚠️ Error: ${errData.error || 'Failed to connect to Gemini API.'}`);
            }
        } catch (e) {
            removeTypingIndicator();
            addMessageToUI('ai', `⚠️ Connection Error: Could not process request. (${e.message})`);
        }
    }

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    clearChatBtn.addEventListener('click', () => {
        chatMessagesArea.innerHTML = `
            <div class="chat-empty-state" id="chat-empty-state">
                <div class="empty-state-badge">
                    <span class="material-symbols-outlined" style="font-size: 18px; color: var(--primary-cyan);">auto_awesome</span>
                    <span>AI Copilot Ready</span>
                </div>
                <h3 class="empty-state-title">Ask Any Question About Your Video</h3>
                <p class="empty-state-subtitle">Paste a YouTube link above, then ask any type of question to analyze tracklists, tutorials, podcasts, or key moments.</p>
            </div>
        `;
        showToast('Chat History Cleared', 'delete_sweep');
    });

    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const promptText = btn.getAttribute('data-prompt');
            chatInputField.value = promptText;
            sendChatMessage();
        });
    });
});
