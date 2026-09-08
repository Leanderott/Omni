const pupils = document.querySelectorAll('.pupil');
const blob = document.getElementById('blob');
const statusText = document.getElementById('status-text');
const talkBtn = document.getElementById('talk-btn');

// 1. Pupillen der Maus oder Touch-Bewegung folgen lassen
window.addEventListener('mousemove', (e) => {
    movePupils(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        movePupils(e.touches[0].clientX, e.touches[0].clientY);
    }
});

function movePupils(mouseX, mouseY) {
    pupils.forEach(pupil => {
        const eye = pupil.parentElement;
        const rect = eye.getBoundingClientRect();
        
        const eyeX = rect.left + rect.width / 2;
        const eyeY = rect.top + rect.height / 2;
        
        const angle = Math.atan2(mouseY - eyeY, mouseX - eyeX);
        const distance = Math.min(6, Math.hypot(mouseX - eyeX, mouseY - eyeY) / 15);
        
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        pupil.style.transform = `translate(${x}px, ${y}px)`;
    });
}

// 2. Zustand umschalten (Hören / Sprechen) als Beispiel
let isSpeaking = false;

talkBtn.addEventListener('click', () => {
    isSpeaking = !isSpeaking;
    
    if (isSpeaking) {
        blob.classList.add('speaking');
        statusText.innerText = "Spricht...";
        talkBtn.innerText = "Stoppen";
    } else {
        blob.classList.remove('speaking');
        statusText.innerText = "Ich höre zu...";
        talkBtn.innerText = "Sprechen";
    }
});
