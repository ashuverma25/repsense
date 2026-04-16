/**
 * voiceAssistant.js — Voice Interaction
 * Uses Web Speech API for speech recognition and SpeechSynthesis for TTS.
 * Provides Siri-like waveform animation and message queue.
 * Includes cooldown system and form-specific feedback phrases.
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

  // Cooldown tracking
  let lastSpeakTime = 0;
  const DEFAULT_COOLDOWN_MS = 1500; // 1.5s cooldown

  // Recognized commands
  const COMMANDS = {
    'pause': ['buddy pause', 'pause workout', 'pause'],
    'skip': ['buddy skip', 'skip exercise', 'skip', 'next'],
    'stop': ['buddy stop', 'stop workout', 'stop'],
    'repeat': ['buddy repeat', 'repeat exercise', 'repeat'],
  };

  // Form feedback phrases
  const CORRECT_PHRASES = ['Good rep', 'Nice', 'Perfect', 'Great form', 'Keep it up'];
  const INCORRECT_PHRASES = {
    default: ['Fix your form', 'Watch your form', 'Adjust your posture'],
    back: ['Keep your back straight', 'Straighten your back'],
    knees: ['Keep knees aligned over ankles', 'Watch your knees'],
    arms: ['Adjust your arms', 'Keep elbows close'],
    depth: ['Go lower', 'Go deeper for full range'],
    alignment: ['Keep hips aligned', 'Align your body'],
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
   * Speak with cooldown — prevents voice spam.
   * Only speaks if enough time has elapsed since last speak.
   * @param {string} text
   * @param {number} cooldownMs - Cooldown in ms (default 1500)
   * @returns {boolean} - Whether the message was spoken
   */
  function speakWithCooldown(text, cooldownMs = DEFAULT_COOLDOWN_MS) {
    const now = Date.now();
    if (now - lastSpeakTime < cooldownMs) {
      return false;
    }
    lastSpeakTime = now;
    speak(text);
    return true;
  }

  /**
   * Get a random correct form feedback phrase.
   */
  function getCorrectPhrase() {
    return CORRECT_PHRASES[Math.floor(Math.random() * CORRECT_PHRASES.length)];
  }

  /**
   * Get a contextual incorrect form feedback phrase.
   * @param {string} issueMessage - The form issue message to match against
   */
  function getIncorrectPhrase(issueMessage = '') {
    const msg = issueMessage.toLowerCase();
    if (msg.includes('back') || msg.includes('straight')) {
      return pickRandom(INCORRECT_PHRASES.back);
    }
    if (msg.includes('knee') || msg.includes('ankle')) {
      return pickRandom(INCORRECT_PHRASES.knees);
    }
    if (msg.includes('arm') || msg.includes('elbow')) {
      return pickRandom(INCORRECT_PHRASES.arms);
    }
    if (msg.includes('lower') || msg.includes('deep') || msg.includes('range')) {
      return pickRandom(INCORRECT_PHRASES.depth);
    }
    if (msg.includes('hip') || msg.includes('align')) {
      return pickRandom(INCORRECT_PHRASES.alignment);
    }
    return pickRandom(INCORRECT_PHRASES.default);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
    speakWithCooldown,
    getCorrectPhrase,
    getIncorrectPhrase,
    startListening,
    stopListening,
    stop,
    clearMessages,
    setOnCommand
  };
})();
