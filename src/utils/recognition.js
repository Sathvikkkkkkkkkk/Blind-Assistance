const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const isRecognitionSupported = () => {
    return !!SpeechRecognition;
};

export const startListening = (onResult, onError) => {
    if (!isRecognitionSupported()) {
        onError("Speech recognition not supported in this browser.");
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };

    recognition.onerror = (event) => {
        onError(event.error);
    };

    try {
        recognition.start();
        return recognition;
    } catch (e) {
        onError(e.message);
        return null;
    }
};
