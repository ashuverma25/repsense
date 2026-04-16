/**
 * repStateMachine.js — State Machine Rep Counter
 * Manages exercise state transitions, rep counting, and cooldown.
 * Supports form-gated rep counting — only valid form counts.
 */
const RepStateMachine = (() => {
  let currentExerciseKey = null;
  let currentExercise = null;
  let currentState = null;
  let repCount = 0;
  let lastRepTime = 0;
  let plankTimer = 0;
  let plankTimerInterval = null;
  let isPlankHolding = false;
  let onRepCallback = null;
  let onStateChangeCallback = null;
  let lastFormCorrect = true;

  const COOLDOWN_MS = 500; // 500ms cooldown between reps

  /**
   * Start tracking an exercise.
   * @param {string} exerciseKey
   */
  function startExercise(exerciseKey) {
    currentExerciseKey = exerciseKey;
    currentExercise = ExerciseEngine.getExercise(exerciseKey);
    console.log('[RepStateMachine] Rep counting active for', exerciseKey);
    if (!currentExercise) {
      console.error('[RepStateMachine] Unknown exercise:', exerciseKey);
      return;
    }

    repCount = 0;
    lastRepTime = 0;
    plankTimer = 0;
    isPlankHolding = false;
    lastFormCorrect = true;

    // Set initial state
    if (currentExercise.type === 'timer') {
      currentState = 'HOLDING';
    } else {
      currentState = currentExercise.states[0];
    }

    ExerciseEngine.resetSmoothing();

    // Start plank timer if timer-type
    if (currentExercise.type === 'timer') {
      startPlankTimer();
    }
  }

  /**
   * Stop tracking.
   */
  function stopExercise() {
    if (plankTimerInterval) {
      clearInterval(plankTimerInterval);
      plankTimerInterval = null;
    }
    currentExerciseKey = null;
    currentExercise = null;
    currentState = null;
  }

  /**
   * Process a frame of landmarks.
   * @param {Array} landmarks - MediaPipe pose landmarks
   * @returns {Object} { state, repCount, depth, formIssues, angles, isFormCorrect }
   */
  function processFrame(landmarks) {
    if (!currentExercise || !landmarks) return null;

    const angles = currentExercise.getAngles(landmarks);

    // Timer exercises (plank)
    if (currentExercise.type === 'timer') {
      const holding = currentExercise.isHolding(angles);
      isPlankHolding = holding;
      const formIssues = currentExercise.formChecks ? currentExercise.formChecks(landmarks, angles) : [];
      const isFormCorrect = formIssues.length === 0;
      lastFormCorrect = isFormCorrect;

      return {
        state: holding ? 'HOLDING' : 'NOT_ALIGNED',
        repCount: 0,
        plankTime: plankTimer,
        depth: holding ? 100 : 0,
        formIssues,
        angles,
        isTimer: true,
        isFormCorrect
      };
    }

    // Rep exercises
    const newState = currentExercise.getState(angles, currentState);
    const depth = currentExercise.getDepth(angles);
    const formIssues = currentExercise.formChecks ? currentExercise.formChecks(landmarks, angles) : [];
    const isFormCorrect = formIssues.length === 0;
    lastFormCorrect = isFormCorrect;

    if (newState !== currentState) {
      const oldState = currentState;
      currentState = newState;

      if (onStateChangeCallback) {
        onStateChangeCallback(oldState, newState);
      }

      // Check if rep completed
      if (newState === 'COMPLETED') {
        const now = Date.now();
        if (now - lastRepTime >= COOLDOWN_MS && isFormCorrect) {
          // Form-gated: only count if form is correct at completion
          repCount++;
          lastRepTime = now;
          currentState = currentExercise.states[0]; // Reset to initial state

          if (onRepCallback) {
            onRepCallback(repCount, depth, formIssues);
          }
        } else {
          // Bad form or cooldown — reset without counting
          currentState = currentExercise.states[0];
        }
      }
    }

    return {
      state: currentState,
      repCount,
      depth,
      formIssues,
      angles,
      isTimer: false,
      isFormCorrect
    };
  }

  /**
   * Start plank timer.
   */
  function startPlankTimer() {
    if (plankTimerInterval) clearInterval(plankTimerInterval);
    plankTimer = 0;
    plankTimerInterval = setInterval(() => {
      if (isPlankHolding) {
        plankTimer++;
      }
    }, 1000);
  }

  function getRepCount() {
    return repCount;
  }

  function getState() {
    return currentState;
  }

  function getPlankTime() {
    return plankTimer;
  }

  function getCurrentExerciseKey() {
    return currentExerciseKey;
  }

  function isLastFormCorrect() {
    return lastFormCorrect;
  }

  function setOnRep(callback) {
    onRepCallback = callback;
  }

  function setOnStateChange(callback) {
    onStateChangeCallback = callback;
  }

  return {
    startExercise,
    stopExercise,
    processFrame,
    getRepCount,
    getState,
    getPlankTime,
    getCurrentExerciseKey,
    isLastFormCorrect,
    setOnRep,
    setOnStateChange
  };
})();
