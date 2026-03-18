/**
 * poseDetection.js — MediaPipe Pose Wrapper
 * Loads MediaPipe Pose, runs detection, draws skeleton overlay,
 * checks body visibility, and exposes landmarks.
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

  /**
   * Initialize MediaPipe Pose.
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLVideoElement} video
   */
  async function init(canvas, video) {
    canvasEl = canvas;
    canvasCtx = canvas.getContext('2d');
    videoEl = video;

    if (!pose) {
      console.log('[PoseDetection] Initializing model...');
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
      console.log('[PoseDetection] Model loaded successfully.');
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

      // Draw connections (skeleton lines)
      drawConnections(results.poseLandmarks);

      // Draw landmarks (joint dots)
      drawLandmarks(results.poseLandmarks);

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
   * Draw skeleton connections.
   */
  function drawConnections(landmarks) {
    const connections = [
      [11, 12], // shoulders
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 23], [12, 24], // torso
      [23, 24], // hips
      [23, 25], [25, 27], // left leg
      [24, 26], [26, 28], // right leg
    ];

    canvasCtx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
    canvasCtx.lineWidth = 2;

    for (const [i, j] of connections) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a.visibility > 0.3 && b.visibility > 0.3) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(a.x * canvasEl.width, a.y * canvasEl.height);
        canvasCtx.lineTo(b.x * canvasEl.width, b.y * canvasEl.height);
        canvasCtx.stroke();
      }
    }
  }

  /**
   * Draw landmark dots.
   */
  function drawLandmarks(landmarks) {
    const importantIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

    for (const idx of importantIndices) {
      const lm = landmarks[idx];
      if (lm && lm.visibility > 0.3) {
        canvasCtx.beginPath();
        canvasCtx.arc(
          lm.x * canvasEl.width,
          lm.y * canvasEl.height,
          5, 0, 2 * Math.PI
        );
        canvasCtx.fillStyle = '#00ff88';
        canvasCtx.fill();
        canvasCtx.closePath();
      }
    }
  }

  /**
   * Mark a joint as incorrect (red dot).
   */
  function markJointIncorrect(landmarks, jointIdx) {
    if (!canvasCtx || !canvasEl || !landmarks[jointIdx]) return;
    const lm = landmarks[jointIdx];
    canvasCtx.save();
    canvasCtx.translate(canvasEl.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.beginPath();
    canvasCtx.arc(
      lm.x * canvasEl.width,
      lm.y * canvasEl.height,
      8, 0, 2 * Math.PI
    );
    canvasCtx.fillStyle = '#ff4444';
    canvasCtx.fill();
    canvasCtx.restore();
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
  }

  function getLandmarks() {
    return latestLandmarks;
  }

  function isBodyVisible() {
    return bodyVisible;
  }

  function setOnResults(callback) {
    onResultsCallback = callback;
  }

  return {
    init,
    startLoop,
    stopLoop,
    getLandmarks,
    isBodyVisible,
    setOnResults,
    markJointIncorrect
  };
})();
