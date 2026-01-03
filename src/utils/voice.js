
const synth = window.speechSynthesis;

// Keep track of the last spoken phrase to avoid repetition loops
let lastSpoken = "";
let lastSpokenTime = 0;
const REPEAT_DELAY_MS = 3000; // Don't repeat the same object within 3 seconds

export const speak = (text, force = false) => {
    if (!synth) return;

    const now = Date.now();

    // Deduplication logic: prevents repeating the exact same phrase too quickly
    if (text === lastSpoken && (now - lastSpokenTime) < REPEAT_DELAY_MS && !force) {
        return;
    }

    // Smart Cancellation:
    // Only cancel if 'force' is true (Urgent Warning) OR if the new text is NOT the assistant answering.
    // This solves the "Assistant gets cut off" issue.
    if (force) {
        synth.cancel();
    } else if (synth.speaking && !text.includes("Battery") && !text.includes("Time") && !text.includes("Latitude")) {
        // If we want real-time updates for objects, we might want to cancel old ones, 
        // but for safety, let's just let it finish unless it's a huge backlog.
        // Actually, for object detection, dropping frames is better than queuing indefinitely.
        // so we cancel ONLY if it's "spammy" object updates.
        synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    // Adjusted rate for better clarity
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    synth.speak(utterance);

    lastSpoken = text;
    lastSpokenTime = now;
};

export const stopSpeaking = () => {
    if (synth) {
        synth.cancel();
    }
}
