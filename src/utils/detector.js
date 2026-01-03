import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

let model = null;

export const loadModel = async () => {
    if (model) return model;
    try {
        console.log("Loading COCO-SSD model...");
        model = await cocoSsd.load();
        console.log("Model loaded successfully.");
        return model;
    } catch (err) {
        console.error("Failed to load model:", err);
        throw err;
    }
};

export const detect = async (videoElement) => {
    if (!model || !videoElement) return [];
    // predictions: Array of { class: string, score: number, bbox: [x, y, width, height] }
    // Lowering threshold to 0.35 to catch smaller/harder objects
    return await model.detect(videoElement, 20, 0.35);
};
