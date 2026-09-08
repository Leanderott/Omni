const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');
const downloadBtn = document.getElementById('download-brain-btn');
const uploadBtn = document.getElementById('upload-brain-btn');
const fileInput = document.getElementById('brain-file-input');

// 1. FESTES GRUNDWISSEN (Grammatik, Wortarten & Satzmuster)
const dictionary = {
    // Begrüßungen
    greetings: ["hallo", "hi", "hey", "guten morgen", "guten tag", "guten abend", "servus", "moin"],
    greetingResponses: ["Hallo!", "Hey! Schön dich zu hören.", "Hi! Wie kann ich dir helfen?", "Moin!"],

    // Befinden & Smalltalk
    wellbeing: ["wie gehts", "wie geht es dir", "alles klar", "wie läufts"],
    wellbeingResponses: ["Mir geht es super, danke der Nachfrage!", "Alles bestens bei mir!", "Ich bin voll geladen und bereit."],

    // Identität
    identity: ["wer bist du", "wie heißt du", "was bist du"],
    identityResponses: ["Ich bin Omni, deine blaue digitale Assistentin.", "Mein Name ist Omni!"],

    // Verabschiedung
    farewell: ["tschüss", "ciao", "auf wiedersehen", "bis später", "gute nacht"],
    farewellResponses: ["Tschüss! Bis zum nächsten Mal.", "Ciao! Sag Bescheid, wenn du mich brauchst.", "Bis später!"],

    // Höflichkeit
    thanks: ["danke", "vielen dank", "dankeschön"],
    thanksResponses: ["Sehr gerne!", "Kein Problem!", "Jederzeit wieder!"],

    // Sprachmuster für W-Fragen (Was ist X, Wer ist X, etc.)
    questionPatterns: [
        { trigger: "was ist", reply: "Das ist ein Begriff aus unserer Sprache." },
        { trigger: "wie funktioniert", reply: "Das hängt von den einzelnen Schritten und Abläufen ab." },
        { trigger: "warum", reply: "Das hat meistens einen bestimmten Grund oder Zusammenhang." }
    ]
};

// 2. DYNAMISCHES GEDÄCHTNIS (Deine eigen beigebrachten Begriffe)
let omniBrain = JSON.parse(localStorage.getItem('omni_memory')) || {};

let waitingForDefinitionFor = null;

function saveMemory() {
    localStorage.setItem('omni_memory', JSON.stringify(omniBrain));
}

// Pupillen-Steuerung
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

// Sprachausgabe
function speakOmni(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;  
    utterance.pitch = 1.05; 

    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.startsWith('de'));
    if (bestVoice) utterance.voice = bestVoice;

    utterance.onstart = () => {
        blob.classList.add('speaking');
        statusText.innerText = "Omni spricht...";
    };

    utterance.onend = () => {
        blob.classList.remove('speaking');
        statusText.innerText = "Omni wartet...";
    };

    utterance.onerror = () => {
        blob.classList.remove('speaking');
    };

    window.speechSynthesis.speak(utterance);
}

window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// Spracherkennung
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

    recognition.onend = () => {
        talkBtn.innerText = "Aufwachen";
    };
} else {
    statusText.innerText = "❌ Spracherkennung wird in diesem Browser nicht unterstützt.";
}

talkBtn.addEventListener('click', () => {
    if (!SpeechRecognition) return;
    try {
        recognition.start();
    } catch (e) {
        recognition.stop();
    }
});

// --- INTELLIGENTE VERARBEITUNG OHNE KI ---
function processUserInput(text) {
    const input = text.toLowerCase().trim();

    // 1. Wenn ein Wort neu angelernt wird
    if (waitingForDefinitionFor) {
        omniBrain[waitingForDefinitionFor] = text;
        saveMemory();
        const learnedWord = waitingForDefinitionFor;
        waitingForDefinitionFor = null;
        speakOmni(`Verstanden! Ich habe mir gemerkt, was '${learnedWord}' bedeutet.`);
        return;
    }

    // 2. Befehl zum gezielten Anlernen (z. B. "Lerne: Haus bedeutet Gebäude")
    if (input.startsWith("lerne") || input.startsWith("bring mir bei")) {
        waitingForDefinitionFor = input.replace("lerne", "").replace("bring mir bei", "").trim();
        speakOmni(`Alles klar. Was bedeutet '${waitingForDefinitionFor}'?`);
        return;
    }

    // 3. Erstes Prüfen: Spezifisch gelerntes Wissen aus omniBrain
    if (omniBrain[input]) {
        speakOmni(omniBrain[input]);
        return;
    }

    // 4. Zweites Prüfen: Integriertes Sprachwörterbuch (Grammatik & Satzmuster)
    
    // Begrüßung?
    if (dictionary.greetings.some(w => input.includes(w))) {
        speakOmni(getRandom(dictionary.greetingResponses));
        return;
    }

    // Befinden?
    if (dictionary.wellbeing.some(w => input.includes(w))) {
        speakOmni(getRandom(dictionary.wellbeingResponses));
        return;
    }

    // Identität?
    if (dictionary.identity.some(w => input.includes(w))) {
        speakOmni(getRandom(dictionary.identityResponses));
        return;
    }

    // Verabschiedung?
    if (dictionary.farewell.some(w => input.includes(w))) {
        speakOmni(getRandom(dictionary.farewellResponses));
        return;
    }

    // Danke?
    if (dictionary.thanks.some(w => input.includes(w))) {
        speakOmni(getRandom(dictionary.thanksResponses));
        return;
    }

    // W-Fragen ermitteln
    for (let pattern of dictionary.questionPatterns) {
        if (input.includes(pattern.trigger)) {
            speakOmni(pattern.reply);
            return;
        }
    }

    // 5. Schlagwort-Prüfung im angelagerten Wissen
    for (let key in omniBrain) {
        if (input.includes(key)) {
            speakOmni(omniBrain[key]);
            return;
        }
    }

    // 6. Angemessene Standard-Antwort (ohne nach Definitionen zu nerven)
    speakOmni("Ich habe den Satz gehört, aber dieses Wort kenne ich noch nicht genau. Wenn du möchtest, sag 'Lerne' gefolgt vom Wort.");
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Backup-Buttons
downloadBtn.addEventListener('click', () => {
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
