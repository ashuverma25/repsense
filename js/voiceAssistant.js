/**
 * voiceAssistant.js — Voice Interaction
 * Uses Web Speech API for speech recognition and SpeechSynthesis for TTS.
 * Provides Siri-like waveform animation and message queue.
 */
const VoiceAssistant = (() => {
  let synthesis = null;
  let recognition = null;
  let isListening = false;
  let isSpeaking = false;
  let messageQueue = [];
  let processing = false;
  let onCommandCallback = null;
  let waveformBars = [];
  let waveformInterval = null;

  // Recognized commands
  const COMMANDS = {
    'pause': ['buddy pause', 'pause workout', 'pause'],
    'skip': ['buddy skip', 'skip exercise', 'skip', 'next'],
    'stop': ['buddy stop', 'stop workout', 'stop'],
    'repeat': ['buddy repeat', 'repeat exercise', 'repeat'],
  };

  /**
   * Initialize voice assistant.
   */
  function init() {
    synthesis = window.speechSynthesis;

    // Initialize waveform bars
    const waveformContainer = document.getElementById('voice-waveform');
    if (waveformContainer) {
      waveformContainer.innerHTML = '';
      for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.height = '4px';
        bar.style.animationDelay = `${i * 0.05}s`;
        waveformContainer.appendChild(bar);
        waveformBars.push(bar);
      }
    }

    // Initialize speech recognition
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript.toLowerCase().trim();
          handleVoiceInput(text);
        };

        recognition.onerror = (event) => {
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('[Voice] Recognition error:', event.error);
          }
        };

        recognition.onend = () => {
          if (isListening) {
            try { recognition.start(); } catch (e) { /* ignore */ }
          }
        };
      }
    } catch (e) {
      console.warn('[Voice] Speech recognition not supported');
    }
  }

  /**
   * Handle voice input and detect commands.
   */
  function handleVoiceInput(text) {
    for (const [cmd, phrases] of Object.entries(COMMANDS)) {
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          if (onCommandCallback) {
            onCommandCallback(cmd);
          }
          return;
        }
      }
    }
  }

  /**
   * Start listening for voice commands.
   */
  function startListening() {
    if (recognition && !isListening) {
      isListening = true;
      try { recognition.start(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Stop listening.
   */
  function stopListening() {
    isListening = false;
    if (recognition) {
      try { recognition.stop(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Speak a message via TTS.
   * @param {string} text
   * @param {boolean} priority - If true, interrupts current speech
   */
  function speak(text, priority = false) {
    if (!synthesis) return;

    if (priority) {
      synthesis.cancel();
      messageQueue = [];
    }

    messageQueue.push(text);
    addMessageToUI(text);
    processQueue();
  }

  /**
   * Process the speech queue.
   */
  function processQueue() {
    if (processing || messageQueue.length === 0) return;
    processing = true;

    const text = messageQueue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Try to use a natural voice
    const voices = synthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      isSpeaking = true;
      activateWaveform(true);
    };

    utterance.onend = () => {
      isSpeaking = false;
      activateWaveform(false);
      processing = false;
      processQueue();
    };

    utterance.onerror = () => {
      isSpeaking = false;
      activateWaveform(false);
      processing = false;
      processQueue();
    };

    synthesis.speak(utterance);
  }

  /**
   * Add message to voice panel UI.
   */
  function addMessageToUI(text) {
    const container = document.getElementById('voice-messages');
    if (!container) return;

    // Remove 'latest' class from all
    container.querySelectorAll('.voice-msg').forEach(m => m.classList.remove('latest'));

    const msgEl = document.createElement('div');
    msgEl.className = 'voice-msg latest';
    msgEl.textContent = text;
    container.appendChild(msgEl);

    // Keep only last 5 messages
    while (container.children.length > 5) {
      container.removeChild(container.firstChild);
    }

    container.scrollTop = container.scrollHeight;
  }

  /**
   * Activate/deactivate waveform animation.
   */
  function activateWaveform(active) {
    waveformBars.forEach(bar => {
      if (active) {
        bar.classList.add('active');
        bar.style.height = `${Math.random() * 26 + 4}px`;
      } else {
        bar.classList.remove('active');
        bar.style.height = '4px';
      }
    });

    if (active && !waveformInterval) {
      waveformInterval = setInterval(() => {
        waveformBars.forEach(bar => {
          if (bar.classList.contains('active')) {
            bar.style.height = `${Math.random() * 26 + 4}px`;
          }
        });
      }, 100);
    } else if (!active && waveformInterval) {
      clearInterval(waveformInterval);
      waveformInterval = null;
    }
  }

  /**
   * Clear all messages from UI.
   */
  function clearMessages() {
    const container = document.getElementById('voice-messages');
    if (container) container.innerHTML = '';
  }

  /**
   * Stop all speech.
   */
  function stop() {
    if (synthesis) synthesis.cancel();
    stopListening();
    messageQueue = [];
    processing = false;
    isSpeaking = false;
    activateWaveform(false);
    if (waveformInterval) {
      clearInterval(waveformInterval);
      waveformInterval = null;
    }
  }

  function setOnCommand(callback) {
    onCommandCallback = callback;
  }

  return {
    init,
    speak,
    startListening,
    stopListening,
    stop,
    clearMessages,
    setOnCommand
  };
})();
