const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');

// --- 1. Pupillen folgen der Maus / dem Touch ---
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

// --- 2. Sprachausgabe (Omni spricht & bewegt sich) ---
function speakOmni(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Vorherige Sprachausgabe stoppen

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;  // Menschliches Sprechtempo
    utterance.pitch = 1.05; // Natürlicher Tonfall

    // Beste deutsche Stimme wählen
    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.includes('de') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) 
                     || voices.find(v => v.lang.startsWith('de'));
    
    if (bestVoice) utterance.voice = bestVoice;

    // Bewegung startet JETZT beim Sprechen
    utterance.onstart = () => {
        blob.classList.add('speaking');
        statusText.innerText = "Omni spricht...";
    };

    // Bewegung stoppt sofort, wenn sie fertig ist
    utterance.onend = () => {
        blob.classList.remove('speaking');
        statusText.innerText = "Drücke den Button, um zu sprechen";
    };

    window.speechSynthesis.speak(utterance);
}

// Stimmen beim Laden des Browsers vorwärmen
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// --- 3. Spracherkennung (Mikrofon-Zugriff) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    statusText.innerText = "Spracherkennung wird von diesem Browser nicht unterstützt.";
    talkBtn.style.display = "none";
} else {
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;

    talkBtn.addEventListener('click', () => {
        try {
            recognition.start();
        } catch (e) {
            console.log("Erkennung läuft bereits");
        }
    });

    recognition.onstart = () => {
        statusText.innerText = "Omni hört zu...";
        talkBtn.innerText = "Höre zu...";
    };

    recognition.onresult = (event) => {
        const userText = event.results[0][0].transcript;
        statusText.innerText = `Du: "${userText}"`;
        talkBtn.innerText = "Sprechen";

        // Einfache Logik/Antwort von Omni (später verknüpfen wir hier die KI)
        processUserInput(userText);
    };

    recognition.onerror = (event) => {
        statusText.innerText = "Mikrofon-Fehler oder Zugriff verweigert.";
        talkBtn.innerText = "Sprechen";
    };

    recognition.onend = () => {
        talkBtn.innerText = "Sprechen";
    };
}

// --- 4. Erste Test-Antworten von Omni ---
function processUserInput(text) {
    const lower = text.toLowerCase();

    if (lower.includes("hallo") || lower.includes("hi")) {
        speakOmni("Hallo! Ich bin Omni. Schön, dich zu hören!");
    } else if (lower.includes("wie heißt du") || lower.includes("wer bist du")) {
        speakOmni("Ich heiße Omni. Ich bin deine persönliche Assistentin.");
    } else if (lower.includes("wie gehts") || lower.includes("wie geht es dir")) {
        speakOmni("Mir geht es super, danke der Nachfrage! Wie geht es dir?");
    } else {
        speakOmni(`Du hast gesagt: ${text}. Ich lerne noch, um dir besser zu antworten.`);
    }
}
