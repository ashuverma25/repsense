/**
 * poseDetection.js — MediaPipe Pose Wrapper
 * Loads MediaPipe Pose, runs detection, draws skeleton overlay,
 * checks body visibility, and exposes landmarks.
 * Supports model preloading and form-aware rendering.
 */
const PoseDetectionModule = (() => {
  let pose = null;
  let canvasCtx = null;
  let canvasEl = null;
  let videoEl = null;
  let latestLandmarks = null;
  let isRunning = false;
  let animFrameId = null;
  let onResultsCallback = null;
  let bodyVisible = false;
  let modelReady = false;
  let preloadPromise = null;

  // Form state for rendering
  let formCorrect = true;
  let incorrectJointSet = new Set();
  let feedbackText = '';

  // Landmark indices for visibility check
  const VISIBILITY_LANDMARKS = {
    nose: 0,
    leftShoulder: 11,
    rightShoulder: 12,
    leftHip: 23,
    rightHip: 24,
    leftKnee: 25,
    rightKnee: 26,
    leftAnkle: 27,
    rightAnkle: 28
  };

  // Important body joint indices for drawing
  const IMPORTANT_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

  // Skeleton connections
  const CONNECTIONS = [
    [11, 12], // shoulders
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], // torso
    [23, 24], // hips
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28], // right leg
  ];

  /**
   * Preload the MediaPipe Pose model independently of canvas/video.
   * Called on DOMContentLoaded for instant readiness.
   */
  async function preload() {
    if (pose || preloadPromise) return preloadPromise;

    preloadPromise = (async () => {
      console.log('[PoseDetection] Preloading model...');
      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(handleResults);

      // Wait for model to load
      await pose.initialize();
      modelReady = true;
      console.log('[PoseDetection] Model preloaded successfully.');
    })();

    return preloadPromise;
  }

  /**
   * Initialize canvas and video elements (model should already be preloaded).
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLVideoElement} video
   */
  async function init(canvas, video) {
    canvasEl = canvas;
    canvasCtx = canvas.getContext('2d');
    videoEl = video;

    // If model wasn't preloaded yet, load it now (fallback)
    if (!modelReady) {
      await preload();
    }
  }

  /**
   * Handle pose detection results.
   */
  function handleResults(results) {
    if (!canvasCtx || !canvasEl) return;

    // Match canvas to video actual size to prevent mapping issues
    canvasEl.width = videoEl.videoWidth || canvasEl.clientWidth || 640;
    canvasEl.height = videoEl.videoHeight || canvasEl.clientHeight || 480;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Mirror the canvas to match mirrored video
    canvasCtx.translate(canvasEl.width, 0);
    canvasCtx.scale(-1, 1);

    if (results.poseLandmarks) {
      latestLandmarks = results.poseLandmarks;
      bodyVisible = checkBodyVisibility(results.poseLandmarks);

      // Draw soft overlay based on form state
      drawFormOverlay();

      // Draw connections (skeleton lines)
      drawConnections(results.poseLandmarks);

      // Draw landmarks (joint dots) with form-aware coloring
      drawLandmarks(results.poseLandmarks);

      // Draw feedback text
      drawFeedbackText();

      // Call external callback
      if (onResultsCallback) {
        onResultsCallback(results.poseLandmarks, bodyVisible);
      }
    } else {
      latestLandmarks = null;
      bodyVisible = false;
      if (onResultsCallback) {
        onResultsCallback(null, false);
      }
    }

    canvasCtx.restore();
  }

  /**
   * Draw soft green/red form overlay on canvas.
   */
  function drawFormOverlay() {
    if (!feedbackText) return; // No active exercise

    const overlayColor = formCorrect
      ? 'rgba(0, 255, 136, 0.04)'
      : 'rgba(255, 68, 68, 0.06)';

    canvasCtx.fillStyle = overlayColor;
    canvasCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);
  }

  /**
   * Draw skeleton connections with form-aware coloring.
   */
  function drawConnections(landmarks) {
    const baseColor = formCorrect
      ? 'rgba(0, 255, 136, 0.5)'
      : 'rgba(0, 255, 136, 0.3)';

    canvasCtx.lineWidth = 2;

    for (const [i, j] of CONNECTIONS) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a.visibility > 0.3 && b.visibility > 0.3) {
        // Color connection red if either joint is incorrect
        const isIncorrect = incorrectJointSet.has(i) || incorrectJointSet.has(j);
        canvasCtx.strokeStyle = isIncorrect ? 'rgba(255, 68, 68, 0.6)' : baseColor;

        canvasCtx.beginPath();
        canvasCtx.moveTo(a.x * canvasEl.width, a.y * canvasEl.height);
        canvasCtx.lineTo(b.x * canvasEl.width, b.y * canvasEl.height);
        canvasCtx.stroke();
      }
    }
  }

  /**
   * Draw landmark dots with form-aware coloring.
   * Correct: bright green | Incorrect specific joints: red | Default: neutral green
   */
  function drawLandmarks(landmarks) {
    for (const idx of IMPORTANT_JOINTS) {
      const lm = landmarks[idx];
      if (lm && lm.visibility > 0.3) {
        const isIncorrect = incorrectJointSet.has(idx);
        const dotColor = isIncorrect
          ? '#ff4444'
          : (formCorrect ? '#00ff88' : '#66bb6a');
        const dotRadius = isIncorrect ? 7 : 5;

        // Glow effect for incorrect joints
        if (isIncorrect) {
          canvasCtx.beginPath();
          canvasCtx.arc(
            lm.x * canvasEl.width,
            lm.y * canvasEl.height,
            12, 0, 2 * Math.PI
          );
          canvasCtx.fillStyle = 'rgba(255, 68, 68, 0.25)';
          canvasCtx.fill();
          canvasCtx.closePath();
        }

        canvasCtx.beginPath();
        canvasCtx.arc(
          lm.x * canvasEl.width,
          lm.y * canvasEl.height,
          dotRadius, 0, 2 * Math.PI
        );
        canvasCtx.fillStyle = dotColor;
        canvasCtx.fill();
        canvasCtx.closePath();
      }
    }
  }

  /**
   * Draw "Good Rep" or "Fix Form" feedback text on canvas.
   */
  function drawFeedbackText() {
    if (!feedbackText) return;

    const text = formCorrect ? 'Good Rep ✓' : 'Fix Form ✗';
    const textColor = formCorrect
      ? 'rgba(0, 255, 136, 0.8)'
      : 'rgba(255, 68, 68, 0.8)';

    canvasCtx.font = 'bold 18px "Inter", "Segoe UI", sans-serif';
    canvasCtx.fillStyle = textColor;
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(text, canvasEl.width / 2, 36);
    canvasCtx.textAlign = 'start'; // Reset
  }

  /**
   * Set the current form state for rendering.
   * Called by the app controller each frame.
   * @param {boolean} isCorrect - Whether posture is correct
   * @param {number[]} badJoints - Array of incorrect joint indices
   */
  function setFormState(isCorrect, badJoints = []) {
    formCorrect = isCorrect;
    incorrectJointSet = new Set(badJoints);
    feedbackText = 'active'; // Non-empty signals active exercise
  }

  /**
   * Clear form state (when exercise ends).
   */
  function clearFormState() {
    formCorrect = true;
    incorrectJointSet = new Set();
    feedbackText = '';
  }

  /**
   * Check if key body parts are visible.
   */
  function checkBodyVisibility(landmarks) {
    const requiredKeys = ['nose', 'leftShoulder', 'rightShoulder', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'];
    for (const key of requiredKeys) {
      const idx = VISIBILITY_LANDMARKS[key];
      if (!landmarks[idx] || landmarks[idx].visibility < 0.4) {
        return false;
      }
    }
    return true;
  }

  /**
   * Start detection loop.
   */
  function startLoop() {
    if (isRunning) return;
    isRunning = true;
    console.log('[PoseDetection] Detection loop running');

    async function detect() {
      if (!isRunning || !videoEl || videoEl.readyState < 2) {
        animFrameId = requestAnimationFrame(detect);
        return;
      }

      try {
        await pose.send({ image: videoEl });
      } catch (e) {
        // Silently handle frame drops
      }
      animFrameId = requestAnimationFrame(detect);
    }

    animFrameId = requestAnimationFrame(detect);
  }

  /**
   * Stop detection loop.
   */
  function stopLoop() {
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    clearFormState();
  }

  function getLandmarks() {
    return latestLandmarks;
  }

  function isBodyVisible() {
    return bodyVisible;
  }

  function isModelReady() {
    return modelReady;
  }

  function setOnResults(callback) {
    onResultsCallback = callback;
  }

  return {
    preload,
    init,
    startLoop,
    stopLoop,
    getLandmarks,
    isBodyVisible,
    isModelReady,
    setOnResults,
    setFormState,
    clearFormState
  };
})();
