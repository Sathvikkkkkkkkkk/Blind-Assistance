import React, { useState, useRef, useEffect } from 'react';
import CameraView from './components/CameraView';
import { startListening } from './utils/recognition';
import { stopSpeaking, speak } from './utils/voice';
import './App.css';

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [targetObject, setTargetObject] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [useVibration, setUseVibration] = useState(true);
  const [useVoice, setUseVoice] = useState(true);
  const [useSonar, setUseSonar] = useState(true);

  const commonObjects = ["person", "cup", "cell phone", "chair", "bottle", "keyboard", "mouse", "laptop"];

  // Image Upload State
  const [uploadedImage, setUploadedImage] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
      setIsRunning(true); // Ensure processing runs
      setTargetObject("analyze"); // Special mode for static analysis
      speak("Analyzing image...");
    }
  };

  const toggleSystem = () => {
    // If analyzing image, close it
    if (uploadedImage) {
      setUploadedImage(null);
      setTargetObject("");
      speak("Returning to Camera.");
      return;
    }

    const newState = !isRunning;
    setIsRunning(newState);
    if (newState) {
      if (targetObject) {
        if (targetObject === "text") { if (useVoice) speak("Starting Text Reader."); }
        else if (targetObject === "hazard") { if (useVoice) speak("Hazard Avoidance Active."); }
        else { if (useVoice) speak(`Starting search for ${targetObject}.`); }
      } else {
        if (useVoice) speak("Starting general detection.");
      }
    } else {
      stopSpeaking();
      if (useVoice) speak("System paused.");
    }
  };

  const handleTargetChange = (e) => {
    setTargetObject(e.target.value);
    if (isRunning && useVoice) {
      speak(`Searching for ${e.target.value || "everything"}`);
    }
  };

  // Emergency SOS Logic
  const handleSOS = () => {
    speak("Emergency Mode Activated. Getting location...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
          const message = `SOS! I need help. My current location: ${mapLink}`;

          speak("Sharing location.");
          if (navigator.share) {
            navigator.share({
              title: 'Emergency Help Needed',
              text: message,
              url: mapLink,
            }).catch((e) => {
              console.error("Share failed", e);
              window.open(`sms:?body=${encodeURIComponent(message)}`);
            });
          } else {
            // Fallback to SMS
            window.open(`sms:?body=${encodeURIComponent(message)}`);
          }
        },
        (err) => {
          console.error(err);
          speak("Could not get location. Ensure GPS is on.");
          // Fallback without location
          const message = "SOS! I need help. (Location unavailable)";
          window.open(`sms:?body=${encodeURIComponent(message)}`);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      speak("Location services unavailable.");
    }
  };

  // AI Assistant Logic
  const processAssistantCommand = (command) => {
    // 1. Navigation & Control
    if (command.includes("stop") || command.includes("pause")) {
      setIsRunning(false);
      stopSpeaking();
      speak("System paused.");
      return;
    }
    if (command.includes("start") || command.includes("scan")) {
      setIsRunning(true);
      speak("Scanning started.");
      return;
    }

    // 2. Modes
    if (command.includes("text") || command.includes("read")) {
      setTargetObject("text");
      speak("Reader Mode activated. Hold text steady.");
      if (!isRunning) setIsRunning(true);
      return;
    }
    if (command.includes("hazard") || command.includes("danger")) {
      setTargetObject("hazard");
      speak("Hazard Mode activated. I will look for obstacles.");
      if (!isRunning) setIsRunning(true);
      return;
    }
    if (command.includes("describe") || command.includes("what is in front")) {
      setTargetObject("");
      speak("Describing the scene...");
      if (!isRunning) setIsRunning(true);
      return;
    }

    // 3. Search / Find
    if (command.includes("find") || command.includes("where is")) {
      const words = command.split(" ");
      const findIndex = words.indexOf("find") !== -1 ? words.indexOf("find") : words.indexOf("is");
      if (findIndex !== -1 && findIndex < words.length - 1) {
        const obj = words.slice(findIndex + 1).join(" ").replace(/my|the|a|an/g, "").trim();
        setTargetObject(obj);
        speak(`Looking for ${obj}. Move device slowly.`);
        if (!isRunning) setIsRunning(true);
      } else {
        speak("What should I find?");
      }
      return;
    }

    // 4. Utilities (Assistant Features)
    if (command.includes("time")) {
      const now = new Date();
      speak(`The time is ${now.toLocaleTimeString()}`);
      return;
    }
    if (command.includes("date") || command.includes("today")) {
      const now = new Date();
      speak(`Today is ${now.toLocaleDateString()}`);
      return;
    }
    if (command.includes("battery")) {
      if (navigator.getBattery) {
        navigator.getBattery().then(batt => {
          speak(`Battery is at ${Math.round(batt.level * 100)} percent.`);
        });
      } else {
        speak("Battery status unavailable.");
      }
      return;
    }
    if (command.includes("location") || command.includes("where am i")) {
      speak("Checking GPS...");
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
          speak(`You are at Start Latitude ${pos.coords.latitude.toFixed(2)} and Longitude ${pos.coords.longitude.toFixed(2)}.`);
        }, () => speak("Unable to get location."));
      }
      return;
    }

    // 5. Emergency & Help
    if (command.includes("help") || command.includes("app instructions") || command.includes("what can you do")) {
      speak("I am your Assistant. You can ask: 'What time is it?', 'Battery level', 'Where am I?', or 'Find keys'. Say 'SOS' for emergency.");
      return;
    }

    if (command.includes("sos") || command.includes("emergency")) {
      handleSOS();
      return;
    }

    // 6. Conversational Extras
    if (command.includes("who are you") || command.includes("your name")) {
      speak("I am Blind Assist, your vision companion.");
      return;
    }
    if (command.includes("joke")) {
      speak("Why did the computer go to the doctor? Because it had a virus!");
      return;
    }

    // 7. "Answer Anything" / Fallback
    speak(`Searching Google for ${command}`);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(command)}`, '_blank');
  };

  const handleVoiceCommand = () => {
    if (isListening) return;
    setIsListening(true);
    stopSpeaking();
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);

    startListening(
      (transcript) => {
        setIsListening(false);
        console.log("User said:", transcript);
        processAssistantCommand(transcript.toLowerCase());
      },
      (error) => {
        setIsListening(false);
        if (error.includes("no-speech")) { } else { speak("I didn't hear you."); }
      }
    );
  };

  // Gesture State
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const lastTap = useRef(0);
  const longPressTimer = useRef(null);

  // Initial Greeting
  useEffect(() => {
    // Wait for user interaction to unlock audio, then speak instructions
    const welcome = () => speak("Blind Assist Ready. Swipe left or right to change modes. Double tap to start scanning. Long press to speak.");
  }, []);

  const handleTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    };

    // Long Press Logic: Reduced to 600ms
    longPressTimer.current = setTimeout(() => {
      handleVoiceCommand();
    }, 600);
  };

  const handleTouchMove = (e) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };

    // Only cancel long press if moved significantly (>10px)
    if (touchStart.current) {
      const diffX = Math.abs(touchStart.current.x - e.targetTouches[0].clientX);
      const diffY = Math.abs(touchStart.current.y - e.targetTouches[0].clientY);
      if (diffX > 10 || diffY > 10) {
        clearTimeout(longPressTimer.current);
      }
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    if (!touchStart.current) return;

    const now = Date.now();
    const isTap = !touchEnd.current || (Math.abs(touchStart.current.x - touchEnd.current.x) < 20 && Math.abs(touchStart.current.y - touchEnd.current.y) < 20);

    if (isTap) {
      // Double Tap Logic
      if (now - lastTap.current < 300) {
        toggleSystem();
      }
      lastTap.current = now;
    } else {
      // Swipe Logic
      const diffX = touchStart.current.x - touchEnd.current.x;
      const diffY = touchStart.current.y - touchEnd.current.y;

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          // Swipe Left -> Next Mode
          cycleMode(1);
        } else {
          // Swipe Right -> Prev Mode
          cycleMode(-1);
        }
      }
    }
  };

  const cycleMode = (direction) => {
    const modes = ["", "text", "hazard", ...commonObjects];
    const currentIndex = modes.indexOf(targetObject);
    // If curent is not in list (e.g. custom), reset to 0
    let nextIndex = (currentIndex + direction + modes.length) % modes.length;

    const newMode = modes[nextIndex];
    setTargetObject(newMode);

    let label = newMode === "" ? "General Detection" : (newMode === "text" ? "Reading Text" : (newMode === "hazard" ? "Hazard Awareness" : `Find ${newMode} `));
    speak(label + " Mode");
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(20);
  };

  return (
    <div className="app-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Blind Assist Application. Swipe to change modes, double tap to start.">
      <header>
        <h1>Blind Assist</h1>
        <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
          ⚙️
        </button>
      </header>

      <main role="main" aria-label="Camera View">
        <CameraView
          isRunning={isRunning}
          targetObject={targetObject}
          settings={{ useVoice, useVibration, useSonar }}
        />
      </main>

      {/* Accessible Controls Panel */}
      <section className="controls" aria-label="Control Panel">

        {/* Mode Selector - Horizontal Scroll for Accessibility */}
        <div className="mode-selector" role="radiogroup" aria-label="Detection Mode">
          <button
            role="radio"
            aria-checked={targetObject === ""}
            className={`mode - btn ${targetObject === "" ? "active" : ""} `}
            onClick={() => { setTargetObject(""); if (useVoice) speak("General Detection Mode"); }}
          >
            👁️ General
          </button>

          <button
            role="radio"
            aria-checked={targetObject === "hazard"}
            className={`mode - btn ${targetObject === "hazard" ? "active" : ""} `}
            onClick={() => { setTargetObject("hazard"); if (useVoice) speak("Hazard Avoidance Mode"); }}
          >
            ⚠️ Hazard
          </button>

          <button
            role="radio"
            aria-checked={targetObject === "text"}
            className={`mode - btn ${targetObject === "text" ? "active" : ""} `}
            onClick={() => { setTargetObject("text"); if (useVoice) speak("Reader Mode"); }}
          >
            📖 Read Text
          </button>

          {commonObjects.map(obj => (
            <button
              key={obj}
              role="radio"
              aria-checked={targetObject === obj}
              className={`mode - btn ${targetObject === obj ? "active" : ""} `}
              onClick={() => { setTargetObject(obj); if (useVoice) speak(`Find ${obj} Mode`); }}
            >
              🔍 {obj}
            </button>
          ))}
        </div>

        <div className="button-group">
          <button
            className={`btn - voice ${isListening ? 'listening' : ''} `}
            onClick={handleVoiceCommand}
            aria-label={isListening ? "Listening... Tap to stop" : "Voice Command. Tap to speak"}
            title="Voice Command"
          >
            {isListening ? "👂" : "🎤"}
          </button>

          <button
            className="btn-voice"
            style={{ background: '#FF3B30', borderColor: '#FF3B30', color: 'white' }}
            onClick={handleSOS}
            aria-label="SOS Emergency Help"
            title="SOS"
          >
            🆘
          </button>

          <label className="btn-voice" style={{ background: '#007AFF', borderColor: '#007AFF', color: 'white' }} aria-label="Upload Image for Analysis">
            📁
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>

          <button
            className={`btn - main ${isRunning ? 'btn-stop' : 'btn-start'} `}
            onClick={toggleSystem}
            aria-label={isRunning ? "Stop Scanning" : "Start Scanning"}
          >
            {isRunning ? "Stop Scanning" : "Start Scanning"}
          </button>
        </div>
      </section>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => { if (e.target.className === 'modal-overlay') setShowSettings(false) }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="settings-title">Options</h2>
              <button className="close-btn" onClick={() => setShowSettings(false)} aria-label="Close Settings">×</button>
            </div>

            <div className="setting-item">
              <label>Voice Feedback</label>
              <label className="switch">
                <input type="checkbox" checked={useVoice} onChange={(e) => setUseVoice(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <label>Vibration Hints</label>
              <label className="switch">
                <input type="checkbox" checked={useVibration} onChange={(e) => setUseVibration(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <label>3D Sonar Audio</label>
              <label className="switch">
                <input type="checkbox" checked={useSonar} onChange={(e) => setUseSonar(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item" style={{ display: 'block', marginTop: '15px' }}>
              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(pos => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    localStorage.setItem('saved_location', JSON.stringify(loc));
                    speak("Location saved as Home.");
                    setShowSettings(false);
                  });
                } else speak("GPS not available");
              }}>
                📍 Save Current Location
              </button>
            </div>

            <div className="setting-item">
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Version 1.3.0 • Blind Assist</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
