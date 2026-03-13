/**
 * exerciseEngine.js — Exercise Definitions & Angle Math
 * Defines 10 exercises with tracked joints, angle thresholds, and state transitions.
 */
const ExerciseEngine = (() => {

  // =========================================
  // LANDMARK INDICES (MediaPipe)
  // =========================================
  const LM = {
    NOSE: 0,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  };

  // =========================================
  // ANGLE CALCULATION
  // =========================================

  /**
   * Calculate angle at point B formed by points A-B-C.
   * Returns angle in degrees (0-180).
   */
  function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  }

  /**
   * Get midpoint of two landmarks.
   */
  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  // =========================================
  // ANGLE SMOOTHER
  // =========================================
  const angleSmoothers = {};
  const SMOOTH_FACTOR = 0.4; // EMA factor (lower = smoother)

  function smoothAngle(key, rawAngle) {
    if (!(key in angleSmoothers)) {
      angleSmoothers[key] = rawAngle;
    }
    angleSmoothers[key] = SMOOTH_FACTOR * rawAngle + (1 - SMOOTH_FACTOR) * angleSmoothers[key];
    return angleSmoothers[key];
  }

  function resetSmoothing() {
    for (const key in angleSmoothers) delete angleSmoothers[key];
  }

  // =========================================
  // EXERCISE DEFINITIONS
  // =========================================
  const EXERCISES = {
    squats: {
      name: 'Squats',
      type: 'rep',
      getAngles(lm) {
        const leftKnee = calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
        const rightKnee = calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
        const kneeAngle = smoothAngle('squat_knee', (leftKnee + rightKnee) / 2);
        const leftHip = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
        const rightHip = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
        const hipAngle = smoothAngle('squat_hip', (leftHip + rightHip) / 2);
        return { kneeAngle, hipAngle };
      },
      states: ['STANDING', 'GOING_DOWN', 'BOTTOM', 'GOING_UP', 'COMPLETED'],
      thresholds: {
        standingKnee: 160,
        goingDownKnee: 140,
        bottomKnee: 100,
        goingUpKnee: 130,
      },
      getState(angles, currentState) {
        const { kneeAngle } = angles;
        switch (currentState) {
          case 'STANDING':
            if (kneeAngle < this.thresholds.goingDownKnee) return 'GOING_DOWN';
            return 'STANDING';
          case 'GOING_DOWN':
            if (kneeAngle < this.thresholds.bottomKnee) return 'BOTTOM';
            if (kneeAngle > this.thresholds.standingKnee) return 'STANDING';
            return 'GOING_DOWN';
          case 'BOTTOM':
            if (kneeAngle > this.thresholds.goingUpKnee) return 'GOING_UP';
            return 'BOTTOM';
          case 'GOING_UP':
            if (kneeAngle > this.thresholds.standingKnee) return 'COMPLETED';
            if (kneeAngle < this.thresholds.bottomKnee) return 'BOTTOM';
            return 'GOING_UP';
          default:
            return 'STANDING';
        }
      },
      getDepth(angles) {
        const { kneeAngle } = angles;
        const maxAngle = 170;
        const minAngle = 70;
        const depth = Math.max(0, Math.min(100, ((maxAngle - kneeAngle) / (maxAngle - minAngle)) * 100));
        return Math.round(depth);
      },
      formChecks(lm, angles) {
        const issues = [];
        // Check knee alignment (knees shouldn't go too far over toes)
        const leftKneeX = lm[LM.LEFT_KNEE].x;
        const leftAnkleX = lm[LM.LEFT_ANKLE].x;
        if (Math.abs(leftKneeX - leftAnkleX) > 0.08) {
          issues.push({ message: 'Keep knees aligned over ankles', joint: LM.LEFT_KNEE });
        }
        // Check back straightness
        if (angles.hipAngle < 60) {
          issues.push({ message: 'Keep your back straighter', joint: LM.LEFT_HIP });
        }
        return issues;
      }
    },

    pushups: {
      name: 'Pushups',
      type: 'rep',
      getAngles(lm) {
        const leftElbow = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
        const rightElbow = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
        const elbowAngle = smoothAngle('pushup_elbow', (leftElbow + rightElbow) / 2);
        const bodyLine = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_ANKLE]);
        return { elbowAngle, bodyLine: smoothAngle('pushup_body', bodyLine) };
      },
      states: ['UP', 'GOING_DOWN', 'BOTTOM', 'GOING_UP', 'COMPLETED'],
      thresholds: {
        upElbow: 155,
        goingDownElbow: 130,
        bottomElbow: 90,
        goingUpElbow: 120,
      },
      getState(angles, currentState) {
        const { elbowAngle } = angles;
        switch (currentState) {
          case 'UP':
            if (elbowAngle < this.thresholds.goingDownElbow) return 'GOING_DOWN';
            return 'UP';
          case 'GOING_DOWN':
            if (elbowAngle < this.thresholds.bottomElbow) return 'BOTTOM';
            if (elbowAngle > this.thresholds.upElbow) return 'UP';
            return 'GOING_DOWN';
          case 'BOTTOM':
            if (elbowAngle > this.thresholds.goingUpElbow) return 'GOING_UP';
            return 'BOTTOM';
          case 'GOING_UP':
            if (elbowAngle > this.thresholds.upElbow) return 'COMPLETED';
            if (elbowAngle < this.thresholds.bottomElbow) return 'BOTTOM';
            return 'GOING_UP';
          default:
            return 'UP';
        }
      },
      getDepth(angles) {
        const { elbowAngle } = angles;
        return Math.round(Math.max(0, Math.min(100, ((170 - elbowAngle) / (170 - 60)) * 100)));
      },
      formChecks(lm, angles) {
        const issues = [];
        if (angles.bodyLine < 150) {
          issues.push({ message: 'Keep your body in a straight line', joint: LM.LEFT_HIP });
        }
        return issues;
      }
    },

    lunges: {
      name: 'Lunges',
      type: 'rep',
      getAngles(lm) {
        const leftKnee = calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
        const rightKnee = calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
        // Use the lower knee angle (the lunging leg)
        const frontKnee = smoothAngle('lunge_front', Math.min(leftKnee, rightKnee));
        return { frontKnee };
      },
      states: ['STANDING', 'GOING_DOWN', 'BOTTOM', 'GOING_UP', 'COMPLETED'],
      thresholds: {
        standingKnee: 155,
        goingDownKnee: 135,
        bottomKnee: 100,
        goingUpKnee: 125,
      },
      getState(angles, currentState) {
        const { frontKnee } = angles;
        switch (currentState) {
          case 'STANDING':
            if (frontKnee < this.thresholds.goingDownKnee) return 'GOING_DOWN';
            return 'STANDING';
          case 'GOING_DOWN':
            if (frontKnee < this.thresholds.bottomKnee) return 'BOTTOM';
            if (frontKnee > this.thresholds.standingKnee) return 'STANDING';
            return 'GOING_DOWN';
          case 'BOTTOM':
            if (frontKnee > this.thresholds.goingUpKnee) return 'GOING_UP';
            return 'BOTTOM';
          case 'GOING_UP':
            if (frontKnee > this.thresholds.standingKnee) return 'COMPLETED';
            if (frontKnee < this.thresholds.bottomKnee) return 'BOTTOM';
            return 'GOING_UP';
          default:
            return 'STANDING';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((170 - angles.frontKnee) / (170 - 70)) * 100)));
      },
      formChecks(lm, angles) {
        const issues = [];
        // Check that front knee doesn't pass ankle
        return issues;
      }
    },

    jumping_jacks: {
      name: 'Jumping Jacks',
      type: 'rep',
      getAngles(lm) {
        // Arm spread: angle at shoulder
        const leftArm = calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_SHOULDER], lm[LM.LEFT_WRIST]);
        const rightArm = calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_WRIST]);
        const armAngle = smoothAngle('jj_arm', (leftArm + rightArm) / 2);
        // Leg spread: distance between ankles relative to hips
        const legSpread = smoothAngle('jj_leg', Math.abs(lm[LM.LEFT_ANKLE].x - lm[LM.RIGHT_ANKLE].x) * 500);
        return { armAngle, legSpread };
      },
      states: ['CLOSED', 'OPENING', 'OPEN', 'CLOSING', 'COMPLETED'],
      thresholds: {
        closedArm: 40,
        openArm: 130,
      },
      getState(angles, currentState) {
        const { armAngle } = angles;
        switch (currentState) {
          case 'CLOSED':
            if (armAngle > 80) return 'OPENING';
            return 'CLOSED';
          case 'OPENING':
            if (armAngle > this.thresholds.openArm) return 'OPEN';
            if (armAngle < this.thresholds.closedArm) return 'CLOSED';
            return 'OPENING';
          case 'OPEN':
            if (armAngle < 80) return 'CLOSING';
            return 'OPEN';
          case 'CLOSING':
            if (armAngle < this.thresholds.closedArm) return 'COMPLETED';
            if (armAngle > this.thresholds.openArm) return 'OPEN';
            return 'CLOSING';
          default:
            return 'CLOSED';
        }
      },
      getDepth(angles) {
        return Math.round(Math.min(100, (angles.armAngle / 170) * 100));
      },
      formChecks() { return []; }
    },

    plank: {
      name: 'Plank',
      type: 'timer',
      getAngles(lm) {
        const bodyLine = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_ANKLE]);
        return { bodyLine: smoothAngle('plank_body', bodyLine) };
      },
      isHolding(angles) {
        // Plank: body should be roughly aligned (angle > 150)
        return angles.bodyLine > 140;
      },
      formChecks(lm, angles) {
        const issues = [];
        if (angles.bodyLine < 150) {
          issues.push({ message: 'Keep hips aligned with shoulders and ankles', joint: LM.LEFT_HIP });
        }
        return issues;
      }
    },

    high_knees: {
      name: 'High Knees',
      type: 'rep',
      getAngles(lm) {
        const leftHipAngle = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
        const rightHipAngle = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
        // Track which knee is higher
        const leftKneeH = lm[LM.LEFT_KNEE].y;
        const rightKneeH = lm[LM.RIGHT_KNEE].y;
        const hipHeight = (lm[LM.LEFT_HIP].y + lm[LM.RIGHT_HIP].y) / 2;
        const activeKnee = leftKneeH < rightKneeH ? 'left' : 'right';
        const hipAngle = smoothAngle('hk_hip', activeKnee === 'left' ? leftHipAngle : rightHipAngle);
        return { hipAngle, activeKnee };
      },
      states: ['STANDING', 'KNEE_UP', 'COMPLETED'],
      thresholds: {
        standingHip: 140,
        kneeUpHip: 100,
      },
      getState(angles, currentState) {
        const { hipAngle } = angles;
        switch (currentState) {
          case 'STANDING':
            if (hipAngle < this.thresholds.kneeUpHip) return 'KNEE_UP';
            return 'STANDING';
          case 'KNEE_UP':
            if (hipAngle > this.thresholds.standingHip) return 'COMPLETED';
            return 'KNEE_UP';
          default:
            return 'STANDING';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((160 - angles.hipAngle) / 90) * 100)));
      },
      formChecks() { return []; }
    },

    standing_knee_raises: {
      name: 'Standing Knee Raises',
      type: 'rep',
      getAngles(lm) {
        const leftHip = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
        const rightHip = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
        const hipAngle = smoothAngle('skr_hip', Math.min(leftHip, rightHip));
        return { hipAngle };
      },
      states: ['STANDING', 'KNEE_UP', 'COMPLETED'],
      thresholds: {
        standingHip: 145,
        kneeUpHip: 95,
      },
      getState(angles, currentState) {
        const { hipAngle } = angles;
        switch (currentState) {
          case 'STANDING':
            if (hipAngle < this.thresholds.kneeUpHip) return 'KNEE_UP';
            return 'STANDING';
          case 'KNEE_UP':
            if (hipAngle > this.thresholds.standingHip) return 'COMPLETED';
            return 'KNEE_UP';
          default:
            return 'STANDING';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((160 - angles.hipAngle) / 80) * 100)));
      },
      formChecks() { return []; }
    },

    side_lunges: {
      name: 'Side Lunges',
      type: 'rep',
      getAngles(lm) {
        const leftKnee = calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
        const rightKnee = calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
        const activeKnee = smoothAngle('sl_knee', Math.min(leftKnee, rightKnee));
        return { activeKnee };
      },
      states: ['STANDING', 'GOING_DOWN', 'BOTTOM', 'GOING_UP', 'COMPLETED'],
      thresholds: {
        standingKnee: 155,
        goingDownKnee: 135,
        bottomKnee: 105,
        goingUpKnee: 125,
      },
      getState(angles, currentState) {
        const { activeKnee } = angles;
        switch (currentState) {
          case 'STANDING':
            if (activeKnee < this.thresholds.goingDownKnee) return 'GOING_DOWN';
            return 'STANDING';
          case 'GOING_DOWN':
            if (activeKnee < this.thresholds.bottomKnee) return 'BOTTOM';
            if (activeKnee > this.thresholds.standingKnee) return 'STANDING';
            return 'GOING_DOWN';
          case 'BOTTOM':
            if (activeKnee > this.thresholds.goingUpKnee) return 'GOING_UP';
            return 'BOTTOM';
          case 'GOING_UP':
            if (activeKnee > this.thresholds.standingKnee) return 'COMPLETED';
            if (activeKnee < this.thresholds.bottomKnee) return 'BOTTOM';
            return 'GOING_UP';
          default:
            return 'STANDING';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((170 - angles.activeKnee) / (170 - 70)) * 100)));
      },
      formChecks() { return []; }
    },

    arm_raises: {
      name: 'Arm Raises',
      type: 'rep',
      getAngles(lm) {
        const leftArm = calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_SHOULDER], lm[LM.LEFT_WRIST]);
        const rightArm = calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_WRIST]);
        const armAngle = smoothAngle('ar_arm', (leftArm + rightArm) / 2);
        return { armAngle };
      },
      states: ['DOWN', 'RAISING', 'UP', 'LOWERING', 'COMPLETED'],
      thresholds: {
        downArm: 30,
        raisingArm: 70,
        upArm: 150,
        loweringArm: 100,
      },
      getState(angles, currentState) {
        const { armAngle } = angles;
        switch (currentState) {
          case 'DOWN':
            if (armAngle > this.thresholds.raisingArm) return 'RAISING';
            return 'DOWN';
          case 'RAISING':
            if (armAngle > this.thresholds.upArm) return 'UP';
            if (armAngle < this.thresholds.downArm) return 'DOWN';
            return 'RAISING';
          case 'UP':
            if (armAngle < this.thresholds.loweringArm) return 'LOWERING';
            return 'UP';
          case 'LOWERING':
            if (armAngle < this.thresholds.downArm) return 'COMPLETED';
            if (armAngle > this.thresholds.upArm) return 'UP';
            return 'LOWERING';
          default:
            return 'DOWN';
        }
      },
      getDepth(angles) {
        return Math.round(Math.min(100, (angles.armAngle / 180) * 100));
      },
      formChecks() { return []; }
    },

    mountain_climbers: {
      name: 'Mountain Climbers',
      type: 'rep',
      getAngles(lm) {
        const leftHip = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
        const rightHip = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
        const activeHip = smoothAngle('mc_hip', Math.min(leftHip, rightHip));
        return { activeHip };
      },
      states: ['EXTENDED', 'KNEE_IN', 'COMPLETED'],
      thresholds: {
        extendedHip: 140,
        kneeInHip: 90,
      },
      getState(angles, currentState) {
        const { activeHip } = angles;
        switch (currentState) {
          case 'EXTENDED':
            if (activeHip < this.thresholds.kneeInHip) return 'KNEE_IN';
            return 'EXTENDED';
          case 'KNEE_IN':
            if (activeHip > this.thresholds.extendedHip) return 'COMPLETED';
            return 'KNEE_IN';
          default:
            return 'EXTENDED';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((160 - angles.activeHip) / 80) * 100)));
      },
      formChecks() { return []; }
    },
  };

  /**
   * Get list of all exercise keys.
   */
  function getExerciseList() {
    return Object.keys(EXERCISES);
  }

  /**
   * Get exercise definition by key.
   */
  function getExercise(key) {
    return EXERCISES[key] || null;
  }

  /**
   * Get exercise name by key.
   */
  function getExerciseName(key) {
    return EXERCISES[key]?.name || key;
  }

  return {
    LM,
    calculateAngle,
    midpoint,
    smoothAngle,
    resetSmoothing,
    getExerciseList,
    getExercise,
    getExerciseName,
    EXERCISES
  };
})();
