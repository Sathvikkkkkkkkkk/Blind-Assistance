import Tesseract from 'tesseract.js';

let worker = null;

export const initializeOCR = async () => {
    if (worker) return worker;
    console.log("Initializing Tesseract OCR...");
    worker = await Tesseract.createWorker('eng');
    console.log("OCR Ready.");
    return worker;
};

export const recognizeText = async (videoElement) => {
    if (!worker) await initializeOCR();

    // Create a canvas to capture the frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const ret = await worker.recognize(canvas);
    return ret.data.text;
};

export const terminateOCR = async () => {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
};
