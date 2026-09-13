// ==========================================
// CONFIGURATION & WORKER URLS (Option A)
// ==========================================
const WORKER_GEMINI_URL = "https://omni.leanderotternberg.workers.dev";
const WORKER_GITHUB_URL = "https://omnireadwrite.leanderotternberg.workers.dev";

// ==========================================
// CENTRAL BRAIN OBJECT
// ==========================================
let omniBrain = {
    "Schule_und_Abschlüsse": {
        "ZAP_Sekundarstufe_I": "Zentrale Prüfungen Klasse 10 in Mathematik, Deutsch und Englisch.",
        "Abitur_Oberstufe": "Vorbereitung Sekundarstufe II. Leistungskurse & Grundkurse.",
        "Physik": "Klassische Mechanik, Elektrodynamik, Optik, Quantenphysik.",
        "Spanisch": "Grammatik, Vokabeln, Indirekte Objektpronomen, Mündliche Prüfungen.",
        "Französisch": "Pronomen 'y' und 'en', Hörverstehen, Textanalyse, Präsentationen."
    },
    "Systeme_und_Hardware": {
        "PC_Setup": "Dell OptiPlex 5040 Tower, Intel Core i5-6500, 16 GB RAM, GTX 1050 Ti, SSD.",
        "Single_Board_Computer": "Raspberry Pi 1 Model B, Pi 2, Pi 3 B+, Raspberry Pi Pico, ESP32, ESP8266.",
        "System_Monitoring": "Rainmeter (Glass-Design), HWiNFO64, AIDA64, Wallpaper Engine, Razer Synapse.",
        "Netzwerk_und_Security": "Nmap Scanning, Cloudflare DNS-over-HTTPS, Swisscows, Pentesting-Basics."
    },
    "Entwicklung_und_Projekte": {
        "Roblox_Studio": "Luau Scripting, UserInputService, ProximityPrompts, GUI-Entwicklung.",
        "OFFCHAT": "LoRa ESP32-S3 Terminal, Off-Grid P2P Textübertragung, Solar, AES-256.",
        "Drohne_Omni": "ArduPilot / Betaflight, MAVLink, Raspberry Pi 5 Edge-KI / Cloud-Anbindung.",
        "Web_Development": "HTML5, CSS3 (Glassmorphism), JavaScript, Dark Mode, Multilingual Support."
    },
    "Protokolle_und_Notizen": {}
};

let conversationHistory = [];

// ==========================================
// DOM ELEMENTE & UI STEUERUNG
// ==========================================
const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');

// Pupillen-Verfolgung (Maus & Touch)
window.addEventListener('mousemove', (e) => movePupils(e.clientX, e.clientY));
window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) movePupils(e.touches[0].clientX, e.touches[0].clientY);
});

function movePupils(mouseX, mouseY) {
    if (!pupils.length) return;
    pupils.forEach(pupil => {
        const eye = pupil.parentElement;
        const rect = eye.getBoundingClientRect();
        const eyeX = rect.left + rect.width / 2;
        const eyeY = rect.top + rect.height / 2;
        
        const angle = Math.atan2(mouseY - eyeY, mouseX - eyeX);
        const distance = Math.min(6, Math.hypot(mouseX - eyeX, mouseY - eyeY) / 15);
        
        pupil.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
    });
}

// Kategorien-Zusammenfassung für den KI-Prompt
function getCategoriesSummary() {
    let summary = [];
    for (let cat in omniBrain) {
        summary.push(`${cat}: [${Object.keys(omniBrain[cat]).join(", ")}]`);
    }
    return summary.join(" | ");
}

// ==========================================
// BACKEND API WORKER CALLS
// ==========================================

// Worker 2: Speichern auf GitHub (omni_brain.json)
async function saveToGitHub() {
    try {
        const response = await fetch(WORKER_GITHUB_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                brainData: omniBrain
            })
        });
        const resData = await response.json();
        if (resData.success) {
            console.log("Omni Brain erfolgreich auf GitHub aktualisiert!");
        } else {
            console.error("Fehler beim Speichern auf GitHub:", resData);
        }
    } catch (err) {
        console.error("Fehler beim Auto-Save auf GitHub:", err);
    }
}

// Worker 1: Anfrage an Gemini KI
async function askGemini(userText) {
    const kbOverview = getCategoriesSummary();
    const fullKbData = JSON.stringify(omniBrain);

    conversationHistory.push({ role: "user", parts: [{ text: userText }] });

    const systemInstruction = `
        Du bist Omni, eine direkte, extrem schlaue KI-Assistentin.
        
        DEIN OBERKATEGORIEN-INDEX:
        ${kbOverview}

        DEINE DETAIL-DATENBANK:
        ${fullKbData}

        VERHALTENSREGELN:
        - Antworte immer extrem präzise in 1 bis 2 kurzen Sätzen.
        - Greife auf das Wissen über ZAP, Abitur, Hardware oder Projekte nur zu, wenn danach gefragt wird.
        - Wenn der Nutzer ein Protokoll oder eine Notiz fordert, erstelle sie und füge am ENDE deiner Antwort folgendes JSON-Kommando an:
          [[SAVE: {"kategorie": "Protokolle_und_Notizen", "thema": "Thema_Oder_Datum", "inhalt": "Kurzes Protokoll..."}]]
    `;

    const requestBody = {
        contents: conversationHistory,
        systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    try {
        const response = await fetch(WORKER_GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                payload: requestBody
            })
        });

        if (!response.ok) throw new Error(`Server Fehler: ${response.status}`);

        const data = await response.json();
        let rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!rawReply) {
            return "Keine Antwort erhalten.";
        }

        // Speicher-Befehl verarbeiten
        const saveMatch = rawReply.match(/\[\[SAVE:\s*(\{.*?\})\s*\]\]/s);
        if (saveMatch) {
            try {
                const saveData = JSON.parse(saveMatch[1]);
                if (!omniBrain[saveData.kategorie]) {
                    omniBrain[saveData.kategorie] = {};
                }
                omniBrain[saveData.kategorie][saveData.thema] = saveData.inhalt;
                console.log("Neues Protokoll erfasst. Sende an GitHub...");
                
                saveToGitHub();

                rawReply = rawReply.replace(/\[\[SAVE:.*?\]\]/s, "").trim();
            } catch (e) {
                console.error("Fehler beim Parsen des Protokolls:", e);
            }
        }

        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }

        return rawReply;

    } catch (error) {
        console.error("Gemini Fehler:", error);
        return "Verbindung zum Server fehlgeschlagen.";
    }
}

// ==========================================
// SPRACHAUSGABE (TTS) & SPRACHERKENNUNG (STT)
// ==========================================

function speakOmni(text) {
    if (statusText) statusText.innerText = "Omni: " + text;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 1.0;

    if (blob) utterance.onstart = () => blob.classList.add('speaking');
    
    const cleanup = () => {
        if (blob) blob.classList.remove('speaking');
        startContinuousListening();
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    window.speechSynthesis.speak(utterance);
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        if (statusText) statusText.innerText = "Omni hört zu...";
        if (talkBtn) talkBtn.innerText = "Höre zu...";
    };

    recognition.onresult = async (event) => {
        const userText = event.results[0][0].transcript;
        if (statusText) statusText.innerText = `Du: "${userText}"`;
        
        if (statusText) statusText.innerText = "Omni überlegt...";
        const aiReply = await askGemini(userText);
        speakOmni(aiReply);
    };

    recognition.onerror = () => { 
        isListening = false; 
        if (talkBtn) talkBtn.innerText = "Aufwachen";
    };
    
    recognition.onend = () => {
        isListening = false;
        if (talkBtn) talkBtn.innerText = "Aufwachen";
        if (blob && !blob.classList.contains('speaking')) startContinuousListening();
    };
} else {
    if (statusText) statusText.innerText = "❌ Spracherkennung wird nicht unterstützt.";
}

function startContinuousListening() {
    if (recognition && !isListening && blob && !blob.classList.contains('speaking')) {
        try { 
            recognition.start(); 
        } catch (e) {
            console.warn("Erkennung läuft bereits:", e);
        }
    }
}

// Aufwachen Button-Eventlistener
if (talkBtn) {
    talkBtn.addEventListener('click', () => {
        startContinuousListening();
    });
}
