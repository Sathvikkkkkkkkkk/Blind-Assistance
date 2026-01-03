import React, { useRef, useEffect, useState } from 'react';
import { loadModel, detect } from '../utils/detector';
import { speak } from '../utils/voice';
import { triggerVibration, patterns } from '../utils/haptics';
import { playSonarBeep } from '../utils/sonar';
import { recognizeText } from '../utils/ocr';

const CameraView = ({ isRunning, targetObject, uploadedImage, settings = { useVoice: true, useVibration: true, useSonar: true } }) => {
    const videoRef = useRef(null);
    const imageRef = useRef(null);
    const canvasRef = useRef(null);
    const requestRef = useRef(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("Tap Start to Begin");

    const [facingMode, setFacingMode] = useState('environment');
    const [showPlayButton, setShowPlayButton] = useState(true);
    const [debugError, setDebugError] = useState("");

    // Initialize Camera - SIMPLIFIED
    const startCamera = async () => {
        setDebugError("");
        setStatus("Starting Camera...");
        let stream = null;

        try {
            // Unblock audio context
            if (window.speechSynthesis) window.speechSynthesis.cancel();

            // Check if browser supports camera access (Requires HTTPS)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                let msg = "Camera API unavailable.";
                if (window.location.protocol === 'http:') {
                    msg += " You MUST use HTTPS (Secure Link).";
                }
                throw new Error(msg);
            }

            const constraints = {
                video: {
                    facingMode: facingMode,
                    // Don't force strict resolution on mobile, let it decide
                },
                audio: false,
            };

            console.log("Requesting camera with:", constraints);
            stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Crucial for iOS:
                videoRef.current.setAttribute("playsinline", true);

                await videoRef.current.play();
                setShowPlayButton(false);
                setStatus("Initializing AI...");
            }
        } catch (err) {
            console.error("Camera Start Error:", err);
            setShowPlayButton(true);

            let msg = err.name + ": " + err.message;
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = "Permission Denied. Please reset site permissions.";
            } else if (err.name === 'NotFoundError') {
                msg = "No suitable camera found.";
            }
            setDebugError(msg);
            setStatus("Camera Failed");
        }
    };

    // Auto-load model
    useEffect(() => {
        // Load Model in background
        loadModel().then(() => {
            setModelLoaded(true);
            if (!showPlayButton) setStatus("Ready to Scan");
        }).catch(() => {
            setStatus("Model Error");
        });

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []);

    const handleManualStart = () => {
        startCamera();
    };

    const toggleCamera = () => {
        // Stop current
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        setFacingMode(prev => {
            const next = prev === 'environment' ? 'user' : 'environment';
            setTimeout(() => startCamera(), 200);
            return next;
        });
    };

    // Tracking for smoothing
    const detectionHistory = useRef(new Map()); // Map<class, count>

    // Detection Loop
    useEffect(() => {
        if (!isRunning) {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            return;
        }

        let isProcessingOCR = false;

        const detectFrame = async () => {
            // 1. HANDLING STATIC IMAGE ANALYSIS
            if (targetObject === "analyze" && uploadedImage) {
                if (imageRef.current && modelLoaded && !isProcessingOCR) {
                    isProcessingOCR = true;
                    setStatus("Analyzing Photo...");
                    const img = imageRef.current;

                    try {
                        const predictions = await detect(img);
                        const processedPredictions = processPredictions(predictions);
                        drawPredictions(processedPredictions);

                        let text = "";
                        try { text = await recognizeText(img); } catch (e) { console.warn(e); }

                        const uniqueObjects = [...new Set(processedPredictions.map(p => p.class))];
                        const objectText = uniqueObjects.length > 0 ? `I see ${uniqueObjects.join(" and ")}.` : "";
                        const readText = text && text.length > 2 ? `Text found: ${text}` : "";

                        const finalSpeech = `${objectText} ${readText}`.trim() || "No objects or clear text found.";

                        if (settings.useVoice) speak(finalSpeech);
                        setStatus("Analysis Done");

                    } catch (e) {
                        console.error(e);
                        setStatus("Analysis Failed");
                    }
                }
                requestRef.current = setTimeout(detectFrame, 1000);
                return;
            }

            // 2. LIVE VIDEO
            if (videoRef.current && videoRef.current.readyState === 4) {
                try {
                    if (targetObject === "text") {
                        // OCR MODE
                        if (!isProcessingOCR) {
                            isProcessingOCR = true;
                            setStatus("Reading text...");
                            // Run OCR (async)
                            recognizeText(videoRef.current).then(text => {
                                if (text && text.trim().length > 2) {
                                    if (settings.useVoice) speak(text);
                                }
                                isProcessingOCR = false;
                                setStatus("Ready for Text");
                            }).catch(e => {
                                console.error(e);
                                isProcessingOCR = false;
                            });
                        }
                    } else {
                        // OBJECT DETECTION MODE
                        // Ensure model is loaded before trying detect
                        if (modelLoaded) {
                            const predictions = await detect(videoRef.current);
                            const processedPredictions = processPredictions(predictions);
                            drawPredictions(processedPredictions);
                            announcePredictions(processedPredictions);
                        }
                    }
                } catch (e) {
                    console.warn("Detection error:", e);
                }
            }
            // Loop slowly for OCR to save battery/resources, fast for Objects
            const delay = targetObject === "text" ? 500 : 0;
            setTimeout(() => {
                requestRef.current = requestAnimationFrame(detectFrame);
            }, delay);
        };

        detectFrame();

        return () => {
            isProcessingOCR = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            clearTimeout(requestRef.current);
        }
    }, [isRunning, modelLoaded, settings, targetObject, uploadedImage]);

    // Process predictions to filter jitter and add spatial info
    const processPredictions = (predictions) => {
        const currentClasses = new Set(predictions.map(p => p.class));
        const width = canvasRef.current ? canvasRef.current.width : 640;
        const height = canvasRef.current ? canvasRef.current.height : 480;

        // Decay history for missing objects
        detectionHistory.current.forEach((count, key) => {
            if (!currentClasses.has(key)) {
                const newCount = count - 1;
                if (newCount <= 0) {
                    detectionHistory.current.delete(key);
                } else {
                    detectionHistory.current.set(key, newCount);
                }
            }
        });

        return predictions.map(pred => {
            // Update history
            const currentCount = detectionHistory.current.get(pred.class) || 0;
            const newCount = Math.min(currentCount + 1, 10);
            detectionHistory.current.set(pred.class, newCount);

            // Spatial Logic
            const [x, y, w, h] = pred.bbox;
            const centerX = x + w / 2;
            const screenSection = width / 3;

            let position = "center";
            if (centerX < screenSection) position = "left";
            else if (centerX > screenSection * 2) position = "right";

            // Proximity Logic
            const boxArea = w * h;
            const screenArea = width * height;
            const coverage = boxArea / screenArea;

            let distance = "";
            if (coverage > 0.4) distance = "very close";
            else if (coverage > 0.15) distance = "near";

            return { ...pred, position, distance, stable: newCount > 0 }; // Threshold reduced for responsiveness
        }).filter(pred => pred.stable);
    };

    const drawPredictions = (predictions) => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        const video = videoRef.current;

        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.font = '24px Arial';
        ctx.textBaseline = 'top';

        predictions.forEach(prediction => {
            // Logic to process predictions guarantees these fields
            const position = prediction.position || "";
            const distance = prediction.distance || "";

            const [x, y, width, height] = prediction.bbox;
            const text = `${prediction.class} (${position}) ${distance}`;

            ctx.strokeStyle = '#FFFF00';

            // Highlight target object differently
            if (targetObject && prediction.class.toLowerCase() === targetObject.toLowerCase()) {
                ctx.strokeStyle = '#00FF00'; // Green for found target
                ctx.lineWidth = 8;
            } else {
                ctx.lineWidth = 4;
            }

            ctx.strokeRect(x, y, width, height);

            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(x, y, textWidth + 10, 30);

            ctx.fillStyle = '#000000';
            ctx.fillText(text, x + 5, y + 2);
        });
    };

    const announcePredictions = (predictions) => {
        if (predictions.length === 0) return;

        let prominent;

        if (targetObject === "hazard") {
            // HAZARD MODE: Prioritize proximity over anything else
            // Look for objects that are "very close" or "near" AND in front (center)
            const hazard = predictions.find(p => p.distance === "very close" || (p.distance === "near" && p.position === "center"));

            if (hazard) {
                prominent = hazard;
                // Override voice behavior for urgent alert
                if (settings.useVoice) {
                    speak(`Warning! ${hazard.class} ${hazard.distance}!`);
                }
                if (settings.useVibration) {
                    triggerVibration([500, 100, 500]); // Heavy Double Pulse
                }
                // Sonar takes care of itself below
            }
        } else if (targetObject === "text") {
            // Handled in loop
            return;
        } else if (targetObject) {
            // FIND MODE
            prominent = predictions.find(p => p.class.toLowerCase() === targetObject.toLowerCase());
        } else {
            // GENERAL MODE
            const valid = predictions.filter(p => p.score > 0.4); // slightly stricter for general chatter
            if (valid.length === 0) return;

            // Prioritize NON-PERSON objects
            const nonPersons = valid.filter(p => p.class !== 'person');
            if (nonPersons.length > 0) {
                prominent = nonPersons.sort((a, b) => (b.bbox[2] * b.bbox[3]) - (a.bbox[2] * a.bbox[3]))[0];
            } else {
                prominent = valid.sort((a, b) => (b.bbox[2] * b.bbox[3]) - (a.bbox[2] * a.bbox[3]))[0];
            }
        }

        if (prominent && targetObject !== "hazard") { // Hazard has custom alert above
            // 1. Voice Announcement
            if (settings.useVoice) {
                let directionText = "";
                if (prominent.position === "left") directionText = "on your left";
                else if (prominent.position === "right") directionText = "on your right";
                else directionText = "directly ahead";

                let text = `${prominent.class} is ${directionText}`;

                if (targetObject && prominent.class.toLowerCase() === targetObject.toLowerCase()) {
                    text = `Found ${prominent.class}! It is ${directionText}.`;
                }

                // Avoid repeating "near/far" constantly, focusing on direction which is actionable
                speak(text);
            }

            // 2. Haptic Feedback (Vibration)
            if (settings.useVibration) {
                if (targetObject && prominent.class.toLowerCase() === targetObject.toLowerCase()) {
                    triggerVibration(patterns.found);
                } else if (prominent.distance === "very close") {
                    triggerVibration(patterns.danger);
                }
            }
        }

        // 3. 3D Sonar Audio (Always Active if enabled)
        if (prominent && settings.useSonar) {
            const width = canvasRef.current ? canvasRef.current.width : 640;
            const height = canvasRef.current ? canvasRef.current.height : 480;

            const [x, y, w, h] = prominent.bbox;
            const centerX = x + w / 2;

            // Map center X (0 to width) to Pan (-1 to 1)
            const pan = (centerX / width) * 2 - 1;

            // Map Area (0 to width*height) to Distance Score (0 to 1)
            const area = w * h;
            const screenArea = width * height;
            // Cap at 0.5 (50% screen coverage) as "Max Proximity" for sound
            const distanceScore = Math.min((area / screenArea) * 2, 1);

            playSonarBeep(pan, distanceScore);
        }
    };

    return (
        <div className={`camera-wrapper ${facingMode === 'user' ? 'mirror-mode' : ''}`}>
            <video
                ref={videoRef}
                playsInline
                muted
                style={{ display: uploadedImage ? 'none' : 'block' }}
            />
            {uploadedImage && (
                <img
                    ref={imageRef}
                    src={uploadedImage}
                    alt="Uploaded for analysis"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        position: 'absolute',
                        top: 0,
                        left: 0
                    }}
                    onLoad={() => {
                        // Trigger analysis manually or let useEffect handle it if we structure correctly
                        // For now, simpler to emit a custom event or let the effect loop catch it? 
                        // Actually, the simpler way is to let the Effect dependency trigger.
                    }}
                />
            )}
            <canvas ref={canvasRef} />
            <div className="status-indicator" role="status" aria-live="polite">
                {status === "Ready to Scan" && !isRunning ? "Tap 'Start Scanning' below" : status}
            </div>

            {/* Manual Play / Retry Button */}
            {showPlayButton && (
                <div className="play-btn-overlay">
                    <button
                        onClick={handleManualStart}
                        className="big-start-btn"
                    >
                        ▶ Start Camera
                    </button>
                    {debugError && <p className="error-text">{debugError}</p>}
                </div>
            )}

            <button
                className="camera-flip-btn"
                onClick={toggleCamera}
                aria-label="Switch Camera"
            >
                🔄
            </button>
        </div>
    );
};

export default CameraView;
