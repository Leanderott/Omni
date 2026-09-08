// --- DOM-ELEMENTE ---
const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');
const downloadBtn = document.getElementById('download-brain-btn');
const uploadBtn = document.getElementById('upload-brain-btn');
const fileInput = document.getElementById('brain-file-input');

// --- 1. GEDÄCHTNIS-SYSTEM (LocalStorage + Standard-Start) ---
let omniBrain = JSON.parse(localStorage.getItem('omni_memory')) || {
    "hallo": "Hallo! Wer bist du?",
    "wer bist du": "Ich bin Omni. Ich bin gerade erst auf die Welt gekommen und lerne von dir."
};

let waitingForDefinitionFor = null;

function saveMemory() {
    localStorage.setItem('omni_memory', JSON.stringify(omniBrain));
}

// --- 2. PUPILLEN-STEUERUNG (Maus & Touch) ---
window.addEventListener('mousemove', (e) => movePupils(e.clientX, e.clientY));
window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) movePupils(e.touches[0].clientX, e.touches[0].clientY);
});

function movePupils(mouseX, mouseY) {
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

// --- 3. SPRACHAUSGABE (TTS + Bewegung beim Sprechen) ---
function speakOmni(text) {
    if (!('speechSynthesis' in window)) {
        alert("Dein Browser unterstützt keine Sprachausgabe.");
        return;
    }

    window.speechSynthesis.cancel(); // Laufende Sprache abbrechen

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;  
    utterance.pitch = 1.05; 

    // Verfügbare Stimmen laden und beste deutsche Stimme wählen
    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.includes('de') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) 
                     || voices.find(v => v.lang.startsWith('de'));
    
    if (bestVoice) utterance.voice = bestVoice;

    // BEWEGUNG STARTET EXKLUSIV BEIM SPRECHEN
    utterance.onstart = () => {
        blob.classList.add('speaking');
        statusText.innerText = "Omni spricht...";
    };

    // BEWEGUNG STOPPT SOFORT WENN SIE FERTIG IST
    utterance.onend = () => {
        blob.classList.remove('speaking');
        statusText.innerText = "Omni hört zu...";
        startListening(); // Direkt weiter zuhören
    };

    utterance.onerror = (e) => {
        console.error("Sprachausgabe-Fehler:", e);
        blob.classList.remove('speaking');
        statusText.innerText = "Klicke 'Aufwachen', um zu sprechen.";
    };

    window.speechSynthesis.speak(utterance);
}

// Stimmen beim Starten laden
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// --- 4. SPRACHERKENNUNG (Mikrofon-Eingabe) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;

    recognition.onstart = () => {
        statusText.innerText = "Omni hört zu...";
        talkBtn.innerText = "Höre zu...";
    };

    recognition.onresult = (event) => {
        const userText = event.results[0][0].transcript;
        statusText.innerText = `Du: "${userText}"`;
        processUserInput(userText);
    };

    recognition.onerror = (event) => {
        console.log("Mikrofon-Fehler:", event.error);
        statusText.innerText = "Klicke 'Aufwachen', um zu sprechen.";
        talkBtn.innerText = "Aufwachen";
    };

    recognition.onend = () => {
        talkBtn.innerText = "Aufwachen";
    };
} else {
    statusText.innerText = "Spracherkennung wird nicht unterstützt.";
}

function startListening() {
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            // Bereits aktiv
        }
    }
}

// Button schaltet Mikrofon frei & reaktiviert Audio
talkBtn.addEventListener('click', () => {
    // Leere Sprachausgabe triggern, um Audio-Berechtigung auf Mobilgeräten freizuschalten
    if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
    startListening();
});

// --- 5. LERN-LOGIK (Menschliches Lernen von Null auf) ---
function processUserInput(text) {
    const input = text.toLowerCase().trim();

    // Fall 1: Omni wartet auf die Erklärung für ein unbekanntes Wort
    if (waitingForDefinitionFor) {
        omniBrain[waitingForDefinitionFor] = text;
        saveMemory();
        
        const learnedWord = waitingForDefinitionFor;
        waitingForDefinitionFor = null;
        
        speakOmni(`Ich habe verstanden! Wenn du '${learnedWord}' sagst, bedeutet das: ${text}.`);
        return;
    }

    // Fall 2: Wort ist exakt im Gedächtnis vorhanden
    if (omniBrain[input]) {
        speakOmni(omniBrain[input]);
        return;
    }

    // Fall 3: Wort ist als Teilbegriff im Gedächtnis enthalten
    for (let key in omniBrain) {
        if (input.includes(key)) {
            speakOmni(omniBrain[key]);
            return;
        }
    }

    // Fall 4: Wort ist völlig neu -> Omni fragt nach!
    waitingForDefinitionFor = input;
    speakOmni(`Das kenne ich noch nicht. Was bedeutet '${text}'?`);
}

// --- 6. EXPORT / IMPORT SYSTEM FOR FILE BACKUP ---

// Wissen als .json-Datei herunterladen
downloadBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(omniBrain, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "omni_brain.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    speakOmni("Ich habe mein gelerntes Wissen gesichert.");
});

// Wissen aus einer Datei laden
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedBrain = JSON.parse(e.target.result);
            omniBrain = importedBrain;
            saveMemory();
            speakOmni("Ich habe mein altes Wissen erfolgreich geladen.");
        } catch (err) {
            alert("Fehler beim Lesen der Wissensdatei.");
        }
    };
    reader.readAsText(file);
});
