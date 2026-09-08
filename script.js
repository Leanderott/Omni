const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');
const downloadBtn = document.getElementById('download-brain-btn');
const uploadBtn = document.getElementById('upload-brain-btn');
const fileInput = document.getElementById('brain-file-input');

// Gedächtnis aus dem Browser laden
let omniBrain = JSON.parse(localStorage.getItem('omni_memory')) || {
    "hallo": "Hallo! Wer bist du?",
    "wer bist du": "Ich bin Omni. Ich bin blau, gerade auf die Welt gekommen und lerne von dir."
};

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

// Sprachausgabe von Omni (Startet Bewegung & Ton)
function speakOmni(text) {
    if (!('speechSynthesis' in window)) {
        alert("Browser unterstützt keine Sprachausgabe.");
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;  
    utterance.pitch = 1.05; 

    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.startsWith('de'));
    if (bestVoice) utterance.voice = bestVoice;

    // Bewegung startet
    utterance.onstart = () => {
        blob.classList.add('speaking');
        statusText.innerText = "Omni spricht...";
    };

    // Bewegung stoppt
    utterance.onend = () => {
        blob.classList.remove('speaking');
        statusText.innerText = "Omni hört zu...";
        startListening();
    };

    utterance.onerror = () => {
        blob.classList.remove('speaking');
        statusText.innerText = "Fehler bei der Sprachausgabe.";
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
        console.error("Mikrofon-Fehler:", event.error);
        if (event.error === 'not-allowed') {
            statusText.innerText = "Bitte erlaube den Mikrofon-Zugriff im Browser!";
        } else {
            statusText.innerText = "Fehler beim Zuhören. Klicke erneut.";
        }
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

// Mikrofon-Berechtigung explizit abfragen beim Klick
talkBtn.addEventListener('click', () => {
    // Mikrofon-Freigabe anfordern
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                startListening();
            })
            .catch((err) => {
                statusText.innerText = "Mikrofon-Zugriff wurde im Browser blockiert!";
                console.error(err);
            });
    } else {
        startListening();
    }
});

// Lern-Logik
function processUserInput(text) {
    const input = text.toLowerCase().trim();

    if (waitingForDefinitionFor) {
        omniBrain[waitingForDefinitionFor] = text;
        saveMemory();
        
        const learnedWord = waitingForDefinitionFor;
        waitingForDefinitionFor = null;
        
        speakOmni(`Ich habe verstanden! Wenn du '${learnedWord}' sagst, bedeutet das: ${text}.`);
        return;
    }

    if (omniBrain[input]) {
        speakOmni(omniBrain[input]);
        return;
    }

    for (let key in omniBrain) {
        if (input.includes(key)) {
            speakOmni(omniBrain[key]);
            return;
        }
    }

    waitingForDefinitionFor = input;
    speakOmni(`Das kenne ich noch nicht. Was bedeutet '${text}'?`);
}

// Wissen Sichern / Laden
downloadBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(omniBrain, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "omni_brain.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
            speakOmni("Ich habe mein Wissen erfolgreich geladen!");
        } catch (err) {
            alert("Fehler beim Lesen der Datei.");
        }
    };
    reader.readAsText(file);
}); 
