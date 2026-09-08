// --- DOM-ELEMENTE ---
const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');

// --- INTEGRATED LOCAL DICTIONARY ---
const builtInDictionary = {
    "zoo": "Ein Zoo ist ein Park, in dem Tiere gehalten werden.",
    "hund": "Ein Hund ist ein Haustier und ein treuer Begleiter.",
    "katze": "Eine Katze ist ein Haustier, das gut klettern kann.",
    "computer": "Ein Computer ist ein elektronisches Gerät zur Datenverarbeitung.",
    "wasser": "Wasser ist eine Flüssigkeit, die wir zum Leben brauchen.",
    "sonne": "Die Sonne ist der Stern, der uns Licht und Wärme gibt."
};

// --- GEDÄCHTNIS LADEN (localStorage) ---
let omniBrain = JSON.parse(localStorage.getItem('omni_memory')) || {};
let waitingForDefinitionFor = null;

function saveMemory() {
    localStorage.setItem('omni_memory', JSON.stringify(omniBrain));
}

// --- PUPILLEN-STEUERUNG ---
window.addEventListener('mousemove', (e) => movePupils(e.clientX, e.clientY));
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

// --- SPRACHAUSGABE ---
function speakOmni(text) {
    statusText.innerText = "Omni: " + text;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;

    utterance.onend = () => startContinuousListening();
    utterance.onerror = () => startContinuousListening();

    window.speechSynthesis.speak(utterance);
}

// --- SPRACHERKENNUNG ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;

    recognition.onstart = () => { isListening = true; talkBtn.innerText = "Höre zu..."; };
    recognition.onresult = (e) => processUserInput(e.results[0][0].transcript);
    recognition.onerror = () => { isListening = false; talkBtn.innerText = "Aufwachen"; };
    recognition.onend = () => {
        isListening = false;
        talkBtn.innerText = "Aufwachen";
        if (!window.speechSynthesis.speaking) startContinuousListening();
    };
}

function startContinuousListening() {
    if (recognition && !isListening && !window.speechSynthesis.speaking) {
        try { recognition.start(); } catch (e) {}
    }
}

talkBtn.addEventListener('click', () => startContinuousListening());

// --- LOGIK OHNE QUIETSCH-FALLES ---
function processUserInput(text) {
    const rawInput = text.trim();
    const input = rawInput.toLowerCase();

    // 1. LERN-MODUS (Definition speichern)
    if (waitingForDefinitionFor) {
        const cleanKey = waitingForDefinitionFor.toLowerCase().trim();
        omniBrain[cleanKey] = rawInput;
        saveMemory();
        
        const learned = waitingForDefinitionFor;
        waitingForDefinitionFor = null;
        speakOmni(`Gemerkt! Ich weiß jetzt, was '${learned}' bedeutet.`);
        return;
    }

    // 2. LERN-BEFEHL ERKENNEN
    if (input.startsWith("lerne") || input.startsWith("bring mir bei")) {
        waitingForDefinitionFor = input.replace("lerne", "").replace("bring mir bei", "").trim();
        speakOmni(`Alles klar. Was bedeutet '${waitingForDefinitionFor}'?`);
        return;
    }

    // 3. FRAGE REINIGEN (Satzbausteine entfernen)
    let searchWord = input;
    const prefixes = [
        "was bedeutet ein", "was bedeutet eine", "was bedeutet", 
        "was ist ein", "was ist eine", "was ist", "erkläre mir", "erkläre", "wer ist"
    ];

    for (let p of prefixes) {
        if (searchWord.startsWith(p)) {
            searchWord = searchWord.replace(p, "").trim();
            break;
        }
    }

    if (searchWord.endsWith("bedeutet")) {
        searchWord = searchWord.replace("bedeutet", "").trim();
    }

    searchWord = searchWord.replace(/[^\w\säöüß]/gi, '').trim();

    // 4. STOPP-WÖRTER BLOCKIEREN (Keine Suchen nach Einzelwörtern wie "was")
    const blockedWords = ["was", "ist", "ein", "eine", "das", "der", "die", "wie", "du", "bedeutet", ""];
    if (blockedWords.includes(searchWord)) {
        speakOmni("Sag mir ein bestimmtes Wort. Zum Beispiel: Was ist ein Hund?");
        return;
    }

    // 5. IM LOKALEN WISSEN SUCHEN
    const allKnowledge = Object.assign({}, builtInDictionary, omniBrain);

    if (allKnowledge[searchWord]) {
        speakOmni(allKnowledge[searchWord]);
        return;
    }

    // 6. FALLBACK (Keine fehlerhafte Internet-Suche mehr)
    speakOmni(`Das weiß ich noch nicht. Sag 'Lerne ${searchWord}', um es mir zu erklären.`);
}
