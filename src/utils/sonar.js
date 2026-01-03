let audioCtx;
let nextBeepTime = 0;

export const initAudio = () => {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

export const playSonarBeep = (panValue, distanceScore) => {
    // panValue: -1 (left) to 1 (right)
    // distanceScore: 0 (far) to 1 (close/large)

    if (!audioCtx) initAudio();
    const now = audioCtx.currentTime;

    if (now < nextBeepTime) return;

    // Calculate beep properties
    // Close objects = fast beeps, high pitch
    // Far objects = slow beeps, low pitch

    // Interval: 0.1s (very close) to 0.8s (far)
    const interval = 0.8 - (distanceScore * 0.7);

    // Frequency: 440Hz (far) to 1200Hz (close)
    const frequency = 440 + (distanceScore * 760);

    const osc = audioCtx.createOscillator();
    const panner = audioCtx.createStereoPanner();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;

    // Clamp pan value
    const safePan = Math.max(-1, Math.min(1, panValue));
    panner.pan.value = safePan;

    // Volume envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(panner);
    panner.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.2);

    nextBeepTime = now + interval;
};
