// --- DOM-ELEMENTE ---
const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');
const downloadBtn = document.getElementById('download-brain-btn');
const uploadBtn = document.getElementById('upload-brain-btn');
const fileInput = document.getElementById('brain-file-input');

// --- 1. EXTERNES LOKALES WÖRTERBUCH (Laden aus dictionary.json) ---
let externalDictionary = { stopWords: [], simpleWords: {} };

fetch('dictionary.json')
    .then(response => response.json())
    .then(data => {
        externalDictionary = data;
        console.log("Lokales Sprachpaket geladen!");
    })
    .catch(() => console.log("Hinweis: dictionary.json nicht gefunden, nutze eingebauten Wortschatz."));

// --- 2. INTEGRATION: EINGEBAUTER OFFLINE-WORTSCHATZ (Fallback) ---
const builtInDictionary = {
    "zoo": "Ein Zoo ist ein Park, in dem Tiere gehalten werden, damit Menschen sie ansehen können.",
    "tier": "Ein Tier ist ein Lebewesen, das sich bewegt und fressen muss.",
    "hund": "Ein Hund ist ein vierbeiniges Haustier und ein treuer Begleiter.",
    "katze": "Eine Katze ist ein beliebtes Haustier, das sehr gut schleichen und klettern kann.",
    "vogel": "Ein Vogel ist ein Tier mit Federn, Flügeln und einem Schnabel.",
    "fisch": "Ein Fisch ist ein Tier, das im Wasser schwimmt und mit Kiemen atmet.",
    "baum": "Ein Baum ist eine hohe Pflanze aus Holz mit einem Stamm und Blättern.",
    "haus": "Ein Haus ist ein festes Gebäude, in dem Menschen wohnen.",
    "auto": "Ein Auto ist ein Fahrzeug mit Rädern und Motor zur Fortbewegung.",
    "schule": "Eine Schule ist ein Ort, an dem Kinder lesen, schreiben und Neues lernen.",
    "computer": "Ein Computer ist ein elektronisches Gerät, das Daten verarbeitet und Programme ausführt.",
    "wasser": "Wasser ist eine durchsichtige Flüssigkeit, die wir zum Trinken und Leben brauchen.",
    "sonne": "Die Sonne ist der heiße Stern am Himmel, der uns Licht und Wärme gibt.",
    "geld": "Geld nutzt man, um Dinge wie Essen oder Kleidung zu kaufen.",
    "zeit": "Die Zeit zeigt uns mit Stunden und Minuten an, wann etwas passiert."
};

// --- 3. SYSTEM-ANTWORTEN & FRAGE-MUSTER ---
const systemIntents = [
    { 
        patterns: ["wie spät", "uhrzeit", "wie viel uhr"], 
        reply: () => `Es ist jetzt ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Uhr.` 
    },
    { 
        patterns: ["welcher tag", "datum", "welcher heute"], 
        reply: () => `Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}.` 
    },
    { 
        patterns: ["was weißt du", "was weißt du schon", "was kannst du", "hilfe", "funktionen"], 
        reply: () => "Ich kenne viele Wörter aus meinem lokalen Speicher. Frag mich einfach 'Was ist X?' oder 'Was bedeutet X?'!" 
    },
    { 
        patterns: ["wer hat dich gemacht", "wer ist dein erfinder", "wer hat dich programmiert"], 
        reply: () => "Ich wurde als lokales JavaScript-Projekt entwickelt." 
    },
    { 
        patterns: ["wie alt bist du"], 
        reply: () => "Ich habe kein Alter, ich bin reiner Code!" 
    }
];

const smalltalk = {
    greetings: {
        keywords: ["hallo", "hi", "hey", "guten morgen", "guten tag", "servus", "moin"],
        answers: ["Hallo!", "Hey! Schön dich zu hören.", "Hi! Wie kann ich helfen?", "Moin Moin!"]
    },
    wellbeing: {
        keywords: ["wie gehts", "wie geht es dir", "alles klar"],
        answers: ["Mir geht es super!", "Alles bestens bei mir!", "Ich bin voll einsatzbereit."]
    },
    identity: {
        keywords: ["wer bist du", "wie heißt du", "was bist du"],
        answers: ["Ich bin Omni, deine lokale Assistentin.", "Mein Name ist Omni!"]
    },
    farewell: {
        keywords: ["tschüss", "ciao", "auf wiedersehen", "gute nacht"],
        answers: ["Tschüss! Bis bald.", "Ciao!", "Bis zum nächsten Mal!"]
    },
    thanks: {
        keywords: ["danke", "dankeschön", "vielen dank"],
        answers: ["Sehr gerne!", "Kein Problem!", "Jederzeit wieder!"]
    }
};

// --- 4. DYNAMISCHES GEDÄCHTNIS (localStorage) ---
let omniBrain = JSON.parse(localStorage.getItem('omni_memory')) || {};
let waitingForDefinitionFor = null;

function saveMemory() {
    localStorage.setItem('omni_memory', JSON.stringify(omniBrain));
}

// --- 5. PUPILLEN-ANIMATION ---
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

// --- 6. SPRACHAUSGABE (TTS) MIT AUTO-RESTART MIKROFON ---
function speakOmni(text) {
    statusText.innerText = "Omni: " + text;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;  
    utterance.pitch = 1.05; 

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        const germanVoice = voices.find(v => v.lang && (v.lang.startsWith('de') || v.lang.includes('DE')));
        if (germanVoice) utterance.voice = germanVoice;
    }

    utterance.onstart = () => blob.classList.add('speaking');
    
    // Sobald Omni fertig gesprochen hat, hört das Mikrofon wieder zu
    utterance.onend = () => {
        blob.classList.remove('speaking');
        startContinuousListening();
    };
    utterance.onerror = () => {
        blob.classList.remove('speaking');
        startContinuousListening();
    };

    window.speechSynthesis.speak(utterance);
}

function unlockAudioOniOS() {
    if ('speechSynthesis' in window) {
        const silentUtterance = new SpeechSynthesisUtterance("");
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
    }
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// --- 7. SPRACHERKENNUNG (STT) MIT DAUERHAFTEM ZUHÖREN ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        statusText.innerText = "Omni hört zu...";
        talkBtn.innerText = "Höre zu...";
    };

    recognition.onresult = (event) => {
        const userText = event.results[0][0].transcript;
        statusText.innerText = `Du: "${userText}"`;
        processUserInput(userText);
    };

    recognition.onerror = (event) => {
        isListening = false;
        talkBtn.innerText = "Aufwachen";
        if (event.error !== 'no-speech') {
            statusText.innerText = "Fehler: " + event.error;
        }
    };

    recognition.onend = () => {
        isListening = false;
        talkBtn.innerText = "Aufwachen";
        // Automatisch neu aktivieren, wenn Omni nicht gerade spricht
        if (!blob.classList.contains('speaking')) {
            startContinuousListening();
        }
    };
} else {
    statusText.innerText = "❌ Spracherkennung nicht unterstützt.";
}

function startContinuousListening() {
    if (recognition && !isListening && !blob.classList.contains('speaking')) {
        try {
            recognition.start();
        } catch (e) {
            // Bereits gestartet
        }
    }
}

talkBtn.addEventListener('click', () => {
    unlockAudioOniOS();
    startContinuousListening();
});

// --- 8. LOKALE ALGORITHMEN: LEVENSHTEIN DISTANZ (Fuzzy Match) ---
function getSimilarity(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// --- 9. HAUPTLOGIK & ANTWORT-VERARBEITUNG ---
function processUserInput(text) {
    const rawInput = text.trim();
    const input = rawInput.toLowerCase();

    // A) Lernmodus aktiv? (Wort und Erklärung sichern)
    if (waitingForDefinitionFor) {
        const cleanKey = waitingForDefinitionFor.toLowerCase().trim();
        omniBrain[cleanKey] = rawInput; 
        saveMemory(); // Automatisch dauerhaft speichern
        
        const word = waitingForDefinitionFor;
        waitingForDefinitionFor = null;
        speakOmni(`Verstanden! Ich habe mir gemerkt, was '${word}' bedeutet.`);
        return;
    }

    // B) Befehl "Lerne X"
    if (input.startsWith("lerne") || input.startsWith("bring mir bei")) {
        waitingForDefinitionFor = input.replace("lerne", "").replace("bring mir bei", "").trim();
        speakOmni(`Alles klar. Was bedeutet '${waitingForDefinitionFor}'?`);
        return;
    }

    // C) System-Intents (Uhrzeit, Datum, Hilfefunktion)
    for (let item of systemIntents) {
        if (item.patterns.some(p => input.includes(p))) {
            speakOmni(item.reply());
            return;
        }
    }

    // D) Smalltalk überprüfen
    for (let cat in smalltalk) {
        if (smalltalk[cat].keywords.some(k => input.includes(k))) {
            speakOmni(getRandom(smalltalk[cat].answers));
            return;
        }
    }

    // E) Fragesatz bereinigen & Hauptbegriff isolieren
    let searchWord = input;
    const questionPrefixes = [
        "was bedeutet ein", "was bedeutet eine", "was bedeutet", "was ist ein", 
        "was ist eine", "was ist", "weißt du was", "kennst du", "erkläre mir", "erkläre", "wer ist"
    ];

    for (let prefix of questionPrefixes) {
        if (searchWord.startsWith(prefix)) {
            searchWord = searchWord.replace(prefix, "").trim();
            break;
        }
    }

    if (searchWord.endsWith("bedeutet")) {
        searchWord = searchWord.replace("bedeutet", "").trim();
    }

    searchWord = searchWord.replace(/[^\w\säöüß]/gi, '').trim();

    // F) Alle Quellen zusammenführen
    const allDicts = Object.assign({}, builtInDictionary, externalDictionary.simpleWords || {}, omniBrain);

    // 1. Exakter Treffer?
    if (allDicts[searchWord]) {
        speakOmni(allDicts[searchWord]);
        return;
    }

    // 2. Schlagwortsuche in den Wörtern des Satzes
    const stopWords = externalDictionary.stopWords || ["was", "ist", "ein", "eine", "bedeutet", "du", "das", "der", "die", "und", "wie"];
    const words = input.replace(/[^\w\säöüß]/gi, '').split(" ").filter(w => !stopWords.includes(w) && w.length > 2);

    for (let w of words) {
        if (allDicts[w]) {
            speakOmni(allDicts[w]);
            return;
        }
    }

    // 3. Unscharfe Suche (Fuzzy Match für Vertipper)
    let bestMatch = null;
    let lowestDistance = 3; 

    for (let key in allDicts) {
        const dist = getSimilarity(searchWord, key);
        if (dist < lowestDistance) {
            lowestDistance = dist;
            bestMatch = key;
        }
    }

    if (bestMatch) {
        speakOmni(allDicts[bestMatch]);
        return;
    }

    // G) Fallback
    speakOmni("Das weiß ich leider noch nicht. Sag 'Lerne' und das Wort, um es mir beizubringen!");
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- 10. GEDÄCHTNIS BACKUP & IMPORT ---
downloadBtn.addEventListener('click', () => {
    unlockAudioOniOS();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(omniBrain, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "omni_brain.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    speakOmni("Ich habe mein Wissen gesichert.");
});

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            omniBrain = JSON.parse(e.target.result);
            saveMemory();
            speakOmni("Ich habe mein Wissen erfolgreich geladen.");
        } catch (err) {
            alert("Fehler beim Lesen der Datei.");
        }
    };
    reader.readAsText(file);
});
