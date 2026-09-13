// ==========================================
// CONFIGURATION & WORKER URLS
// ==========================================
const WORKER_GEMINI_URL = "https://omni.leanderotternberg.workers.dev";
const WORKER_GITHUB_URL = "https://omnireadwrite.leanderotternberg.workers.dev";

// Globaler Speicherzustand (Brain)
let omniBrain = {
  history: [],
  notes: [],
  lastUpdated: new Date().toISOString()
};

// ==========================================
// DOM ELEMENTE & STATE
// ==========================================
const statusText = document.getElementById("status");
const startBtn = document.getElementById("start-btn");

let recognition = null;
let isListening = false;
let isSpeaking = false;

// ==========================================
// 1. BACKEND API ANFRAGEN
// ==========================================

// Worker 1: KI-Antwort von Gemini abrufen
async function askGemini(promptText) {
  try {
    const response = await fetch(WORKER_GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          contents: [{ parts: [{ text: promptText }] }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Worker HTTP Fehler: ${response.status}`);
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return replyText || "Ich habe dazu leider keine Antwort erhalten.";
  } catch (error) {
    console.error("Fehler bei askGemini:", error);
    return "Fehler bei der Verbindung zum KI-Worker.";
  }
}

// Worker 2: Zustand in GitHub (omni_brain.json) speichern
async function saveBrainToGitHub(brainData) {
  try {
    const response = await fetch(WORKER_GITHUB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brainData: brainData })
    });

    const result = await response.json();
    if (result.success) {
      console.log("Brain erfolgreich auf GitHub gespeichert!");
    } else {
      console.error("Fehler beim Speichern des Brains:", result);
    }
  } catch (error) {
    console.error("Fehler bei saveBrainToGitHub:", error);
  }
}

// ==========================================
// 2. SPRACHAUSGABE (TEXT-TO-SPEECH)
// ==========================================
function speakText(text, onComplete) {
  if (!("speechSynthesis" in window)) {
    console.warn("SpeechSynthesis wird von diesem Browser nicht unterstützt.");
    if (onComplete) onComplete();
    return;
  }

  window.speechSynthesis.cancel(); // Laufende Sprachausgaben abbrechen

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  isSpeaking = true;
  if (statusText) statusText.innerText = "Spricht...";

  utterance.onend = () => {
    isSpeaking = false;
    if (onComplete) onComplete();
  };

  utterance.onerror = (err) => {
    console.error("Fehler bei der Sprachausgabe:", err);
    isSpeaking = false;
    if (onComplete) onComplete();
  };

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// 3. SPRACHERKENNUNG (SPEECH-TO-TEXT)
// ==========================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Dein Browser unterstützt keine Sprachsteuerung. Bitte verwende Chrome oder Safari.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-DE";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    if (statusText) statusText.innerText = "Hört zu...";
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("Erkannt:", transcript);

    if (statusText) statusText.innerText = "Überlegt...";

    // Verlauf & Brain aktualisieren
    omniBrain.history.push({ role: "user", text: transcript, timestamp: new Date().toISOString() });
    omniBrain.lastUpdated = new Date().toISOString();

    // 1. Gemini fragen
    const reply = await askGemini(transcript);

    // 2. Antwort zum Brain hinzufügen & auf GitHub sichern
    omniBrain.history.push({ role: "omni", text: reply, timestamp: new Date().toISOString() });
    saveBrainToGitHub(omniBrain);

    // 3. Antwort vorlesen und erst DANACH wieder zuhören
    speakText(reply, () => {
      startListening();
    });
  };

  recognition.onerror = (event) => {
    console.error("Spracherkennungsfehler:", event.error);
    isListening = false;
    
    // Bei Stille (no-speech) oder Abbruch automatisch neu starten
    if (event.error === "no-speech" || event.error === "network") {
      setTimeout(() => startListening(), 1000);
    } else {
      if (statusText) statusText.innerText = "Bereit";
    }
  };

  recognition.onend = () => {
    isListening = false;
    // Nur neu starten, wenn Omni nicht gerade spricht
    if (!isSpeaking && statusText && statusText.innerText === "Hört zu...") {
      startListening();
    }
  };
}

function startListening() {
  if (recognition && !isListening && !isSpeaking) {
    try {
      recognition.start();
    } catch (e) {
      console.warn("Erkennung lief bereits:", e);
    }
  }
}

// ==========================================
// 4. INITIALISIERUNG
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initSpeechRecognition();

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startListening();
    });
  }
});
