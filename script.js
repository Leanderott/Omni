// --- DOM-ELEMENTE ---
const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');
const downloadBtn = document.getElementById('download-brain-btn');
const uploadBtn = document.getElementById('upload-brain-btn');
const fileInput = document.getElementById('brain-file-input');

// --- 1. LOKALES SPRACHPAKET AUS EXTERNER DATEI LADEN ---
let externalDictionary = { stopWords: [], simpleWords: {} };

fetch('dictionary.json')
    .then(response => response.json())
    .then(data => {
        externalDictionary = data;
        console.log("Lokales Sprachpaket erfolgreich geladen!");
    })
    .catch(err => console.log("Hinweis: dictionary.json wurde nicht gefunden oder konnte nicht geladen werden."));

// Feste System-Antworten & Smalltalk
const systemResponses = {
    intents: [
        { triggers: ["wie spät", "uhrzeit", "wie viel uhr"], reply: () => `Es ist jetzt ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Uhr.` },
        { triggers: ["welcher tag", "welches datum", "welcher heute"], reply: () => `Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}.` },
        { triggers: ["was kannst du", "hilfe", "funktionen"], reply: () => "Ich kann Smalltalk führen, Begriffe lokal oder im Internet recherchieren und neue Wörter lernen, wenn du 'Lerne' sagst." },
        { triggers: ["wer hat dich gemacht", "wer ist dein erfinder", "wer hat dich programmiert"], reply: () => "Ich wurde als lokales Web-Projekt entwickelt." },
        { triggers: ["wie alt bist du"], reply: () => "Ich habe kein Alter, ich bin eine digitale Assistentin." }
    ],
    greetings: ["hallo", "hi", "hey", "guten morgen", "guten tag", "guten abend", "servus", "moin"],
    greetingResponses: ["Hallo!", "Hey! Schön dich zu hören.", "Hi! Wie kann ich dir helfen?", "Moin!"],
    wellbeing: ["wie gehts", "wie geht es dir", "alles klar", "wie läufts"],
    wellbeingResponses: ["Mir geht es super, danke der Nachfrage!", "Alles bestens bei mir!", "Ich bin bereit."],
    identity: ["wer bist du", "wie heißt du", "was bist du"],
    identityResponses: ["Ich bin Omni, deine blaue digitale Assistentin.", "Mein Name ist Omni!"],
    farewell: ["tschüss", "ciao", "auf wiedersehen", "bis später", "gute nacht"],
    farewellResponses: ["Tschüss! Bis zum nächsten Mal.", "Ciao!", "Bis später!"],
    thanks: ["danke", "vielen dank", "dankeschön"],
    thanksResponses: ["Sehr gerne!", "Kein Problem!", "Jederzeit wieder!"]
};

// --- 2. DYNAMISCHES GEDÄCHTNIS (localStorage) ---
let omniBrain = JSON.parse(localStorage.getItem('omni_memory')) || {};
let waitingForDefinitionFor = null;

function saveMemory() {
    localStorage.setItem('omni_memory', JSON.stringify(omniBrain));
}

// --- 3. PUPILLEN-STEUERUNG ---
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

// --- 4. SPRACHAUSGABE ---
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
    utterance.onend = () => blob.classList.remove('speaking');
    utterance.onerror = () => blob.classList.remove('speaking');

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

// --- 5. SPRACHERKENNUNG ---
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
        talkBtn.innerText = "Aufwachen";
        if (event.error === 'not-allowed') {
            statusText.innerText = "❌ Mikrofon im Browser blockiert!";
        } else {
            statusText.innerText = "Fehler: " + event.error;
        }
    };

    recognition.onend = () => talkBtn.innerText = "Aufwachen";
} else {
    statusText.innerText = "❌ Spracherkennung wird nicht unterstützt.";
}

talkBtn.addEventListener('click', () => {
    unlockAudioOniOS();
    if (!SpeechRecognition) return;
    try {
        recognition.start();
    } catch (e) {
        recognition.stop();
    }
});

// --- 6. LOGIK & BEANTWORTUNG (LOKAL + INTERNET) ---
async function processUserInput(text) {
    const input = text.toLowerCase().trim();

    // 1. Wenn Omni gerade eine Erklärung lernt
    if (waitingForDefinitionFor) {
        omniBrain[waitingForDefinitionFor] = text;
        saveMemory();
        const learnedWord = waitingForDefinitionFor;
        waitingForDefinitionFor = null;
        speakOmni(`Verstanden! Ich habe mir gemerkt, was '${learnedWord}' bedeutet.`);
        return;
    }

    // 2. Gezielter Lern-Befehl
    if (input.startsWith("lerne") || input.startsWith("bring mir bei")) {
        waitingForDefinitionFor = input.replace("lerne", "").replace("bring mir bei", "").trim();
        speakOmni(`Alles klar. Was bedeutet '${waitingForDefinitionFor}'?`);
        return;
    }

    // 3. Uhrzeit, Datum & Systemfragen
    for (let intent of systemResponses.intents) {
        if (intent.triggers.some(t => input.includes(t))) {
            speakOmni(intent.reply());
            return;
        }
    }

    // 4. Smalltalk
    if (systemResponses.greetings.some(w => input.includes(w))) {
        speakOmni(getRandom(systemResponses.greetingResponses));
        return;
    }
    if (systemResponses.wellbeing.some(w => input.includes(w))) {
        speakOmni(getRandom(systemResponses.wellbeingResponses));
        return;
    }
    if (systemResponses.identity.some(w => input.includes(w))) {
        speakOmni(getRandom(systemResponses.identityResponses));
        return;
    }
    if (systemResponses.farewell.some(w => input.includes(w))) {
        speakOmni(getRandom(systemResponses.farewellResponses));
        return;
    }
    if (systemResponses.thanks.some(w => input.includes(w))) {
        speakOmni(getRandom(systemResponses.thanksResponses));
        return;
    }

    // 5. Exakter Treffer im gelernten Gedächtnis (localStorage)
    if (omniBrain[input]) {
        speakOmni(omniBrain[input]);
        return;
    }

    // 6. SCHLAGWORT-SUCHE IN DER LOKALEN DICTIONARY.JSON
    const stopWords = externalDictionary.stopWords || [];
    const simpleWords = externalDictionary.simpleWords || {};
    const words = input.replace(/[^\w\säöüß]/gi, '').split(" ").filter(w => !stopWords.includes(w) && w.length > 1);

    for (let word of words) {
        // A) Zuerst im eigenen gelernten Gedächtnis prüfen
        if (omniBrain[word]) {
            speakOmni(omniBrain[word]);
            return;
        }
        // B) In der externen dictionary.json suchen
        if (simpleWords[word]) {
            speakOmni(simpleWords[word]);
            return;
        }
    }

    // 7. ONLINE-RECHERCHE VIA WIKIPEDIA (Fallback bei unbekannten Wörtern)
    if (words.length > 0) {
        const queryTerm = words[0]; // Erstes relevantes Wort
        statusText.innerText = `Omni recherchiert im Internet nach '${queryTerm}'...`;

        try {
            const response = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(queryTerm)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.extract) {
                    // Ersten Satz extrahieren
                    const firstSentence = data.extract.split('.')[0] + '.';
                    
                    // Automatisch im lokalen Speicher für die Zukunft ablegen
                    omniBrain[queryTerm] = firstSentence;
                    saveMemory();

                    speakOmni(firstSentence);
                    return;
                }
            }
        } catch (err) {
            console.error("Internet-Recherche Fehler:", err);
        }
    }

    // 8. Ausweich-Antwort
    speakOmni("Dazu kenne ich noch keine Erklärung. Sag 'Lerne' und das Wort, um es mir beizubringen!");
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- 7. GEDÄCHTNIS BACKUP ---
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
