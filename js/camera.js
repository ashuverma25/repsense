/**
 * camera.js — WebRTC Webcam Handler
 * Handles camera initialization, start/stop, and provides the video element.
 */
const CameraModule = (() => {
  let videoElement = null;
  let stream = null;
  let isRunning = false;

  /**
   * Initialize camera with the given video element.
   * @param {HTMLVideoElement} videoEl
   */
  async function init(videoEl) {
    videoElement = videoEl;
  }

  /**
   * Start the webcam stream.
   * @returns {Promise<HTMLVideoElement>}
   */
  async function start() {
    if (isRunning) return videoElement;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: false
      });

      videoElement.srcObject = stream;
      await videoElement.play();
      isRunning = true;
      return videoElement;
    } catch (err) {
      console.error('[Camera] Failed to start:', err);
      throw err;
    }
  }

  /**
   * Stop the webcam stream.
   */
  function stop() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    isRunning = false;
  }

  function getVideo() {
    return videoElement;
  }

  function getIsRunning() {
    return isRunning;
  }

  return { init, start, stop, getVideo, getIsRunning };
})();
