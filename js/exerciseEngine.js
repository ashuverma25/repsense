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
  const SMOOTH_FACTOR = 0.3; // EMA factor (lower = smoother, reduced from 0.4)

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
  // EXERCISE DEFINITIONS — 10 Core Exercises
  // =========================================
  const EXERCISES = {

    // ─── 1. SQUATS ───
    squats: {
      name: 'Squats',
      type: 'rep',
      trackedJoints: [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
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
          issues.push({ message: 'Keep knees aligned over ankles', joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE] });
        }
        // Check back straightness
        if (angles.hipAngle < 60) {
          issues.push({ message: 'Keep your back straighter', joints: [LM.LEFT_HIP, LM.RIGHT_HIP] });
        }
        return issues;
      }
    },

    // ─── 2. PUSH-UPS ───
    pushups: {
      name: 'Push-ups',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP],
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
          issues.push({ message: 'Keep your body in a straight line', joints: [LM.LEFT_HIP, LM.RIGHT_HIP] });
        }
        return issues;
      }
    },

    // ─── 3. JUMPING JACKS ───
    jumping_jacks: {
      name: 'Jumping Jacks',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
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

    // ─── 4. LUNGES ───
    lunges: {
      name: 'Lunges',
      type: 'rep',
      trackedJoints: [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
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

    // ─── 5. PLANK (time-based) ───
    plank: {
      name: 'Plank',
      type: 'timer',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
      getAngles(lm) {
        const bodyLine = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_ANKLE]);
        return { bodyLine: smoothAngle('plank_body', bodyLine) };
      },
      isHolding(angles) {
        // Plank: body should be roughly aligned (angle > 140)
        return angles.bodyLine > 140;
      },
      formChecks(lm, angles) {
        const issues = [];
        if (angles.bodyLine < 150) {
          issues.push({ message: 'Keep hips aligned with shoulders and ankles', joints: [LM.LEFT_HIP, LM.RIGHT_HIP] });
        }
        return issues;
      }
    },

    // ─── 6. BICEP CURL ───
    bicep_curl: {
      name: 'Bicep Curl',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST],
      getAngles(lm) {
        const leftElbow = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
        const rightElbow = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
        const elbowAngle = smoothAngle('bc_elbow', (leftElbow + rightElbow) / 2);
        return { elbowAngle };
      },
      states: ['EXTENDED', 'CURLING', 'CURLED', 'EXTENDING', 'COMPLETED'],
      thresholds: {
        extendedElbow: 150,
        curlingElbow: 120,
        curledElbow: 50,
        extendingElbow: 100,
      },
      getState(angles, currentState) {
        const { elbowAngle } = angles;
        switch (currentState) {
          case 'EXTENDED':
            if (elbowAngle < this.thresholds.curlingElbow) return 'CURLING';
            return 'EXTENDED';
          case 'CURLING':
            if (elbowAngle < this.thresholds.curledElbow) return 'CURLED';
            if (elbowAngle > this.thresholds.extendedElbow) return 'EXTENDED';
            return 'CURLING';
          case 'CURLED':
            if (elbowAngle > this.thresholds.extendingElbow) return 'EXTENDING';
            return 'CURLED';
          case 'EXTENDING':
            if (elbowAngle > this.thresholds.extendedElbow) return 'COMPLETED';
            if (elbowAngle < this.thresholds.curledElbow) return 'CURLED';
            return 'EXTENDING';
          default:
            return 'EXTENDED';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((170 - angles.elbowAngle) / (170 - 30)) * 100)));
      },
      formChecks(lm, angles) {
        const issues = [];
        // Check that elbows stay close to the body (shoulder-elbow X alignment)
        const leftShoulderX = lm[LM.LEFT_SHOULDER].x;
        const leftElbowX = lm[LM.LEFT_ELBOW].x;
        if (Math.abs(leftShoulderX - leftElbowX) > 0.1) {
          issues.push({ message: 'Keep elbows close to your body', joints: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW] });
        }
        return issues;
      }
    },

    // ─── 7. SHOULDER PRESS ───
    shoulder_press: {
      name: 'Shoulder Press',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST],
      getAngles(lm) {
        const leftElbow = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
        const rightElbow = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
        const elbowAngle = smoothAngle('sp_elbow', (leftElbow + rightElbow) / 2);
        // Shoulder angle (hip-shoulder-elbow) indicates arm elevation
        const leftShoulder = calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW]);
        const rightShoulder = calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW]);
        const shoulderAngle = smoothAngle('sp_shoulder', (leftShoulder + rightShoulder) / 2);
        return { elbowAngle, shoulderAngle };
      },
      states: ['DOWN', 'PRESSING', 'UP', 'LOWERING', 'COMPLETED'],
      thresholds: {
        downElbow: 90,
        pressingElbow: 120,
        upElbow: 160,
        loweringElbow: 130,
      },
      getState(angles, currentState) {
        const { elbowAngle } = angles;
        switch (currentState) {
          case 'DOWN':
            if (elbowAngle > this.thresholds.pressingElbow) return 'PRESSING';
            return 'DOWN';
          case 'PRESSING':
            if (elbowAngle > this.thresholds.upElbow) return 'UP';
            if (elbowAngle < this.thresholds.downElbow) return 'DOWN';
            return 'PRESSING';
          case 'UP':
            if (elbowAngle < this.thresholds.loweringElbow) return 'LOWERING';
            return 'UP';
          case 'LOWERING':
            if (elbowAngle < this.thresholds.downElbow) return 'COMPLETED';
            if (elbowAngle > this.thresholds.upElbow) return 'UP';
            return 'LOWERING';
          default:
            return 'DOWN';
        }
      },
      getDepth(angles) {
        return Math.round(Math.min(100, (angles.elbowAngle / 180) * 100));
      },
      formChecks(lm, angles) {
        const issues = [];
        // Arms should stay roughly symmetrical
        const leftWristY = lm[LM.LEFT_WRIST].y;
        const rightWristY = lm[LM.RIGHT_WRIST].y;
        if (Math.abs(leftWristY - rightWristY) > 0.12) {
          issues.push({ message: 'Press both arms evenly', joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER] });
        }
        return issues;
      }
    },

    // ─── 8. HIGH KNEES ───
    high_knees: {
      name: 'High Knees',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE],
      getAngles(lm) {
        const leftHipAngle = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
        const rightHipAngle = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
        // Track which knee is higher
        const leftKneeH = lm[LM.LEFT_KNEE].y;
        const rightKneeH = lm[LM.RIGHT_KNEE].y;
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

    // ─── 9. SIT-UPS ───
    sit_ups: {
      name: 'Sit-ups',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE],
      getAngles(lm) {
        const leftHip = calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
        const rightHip = calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
        const hipAngle = smoothAngle('su_hip', (leftHip + rightHip) / 2);
        return { hipAngle };
      },
      states: ['LYING', 'RISING', 'UP', 'LOWERING', 'COMPLETED'],
      thresholds: {
        lyingHip: 150,
        risingHip: 130,
        upHip: 80,
        loweringHip: 110,
      },
      getState(angles, currentState) {
        const { hipAngle } = angles;
        switch (currentState) {
          case 'LYING':
            if (hipAngle < this.thresholds.risingHip) return 'RISING';
            return 'LYING';
          case 'RISING':
            if (hipAngle < this.thresholds.upHip) return 'UP';
            if (hipAngle > this.thresholds.lyingHip) return 'LYING';
            return 'RISING';
          case 'UP':
            if (hipAngle > this.thresholds.loweringHip) return 'LOWERING';
            return 'UP';
          case 'LOWERING':
            if (hipAngle > this.thresholds.lyingHip) return 'COMPLETED';
            if (hipAngle < this.thresholds.upHip) return 'UP';
            return 'LOWERING';
          default:
            return 'LYING';
        }
      },
      getDepth(angles) {
        return Math.round(Math.max(0, Math.min(100, ((170 - angles.hipAngle) / (170 - 60)) * 100)));
      },
      formChecks(lm, angles) {
        const issues = [];
        // Neck should not strain forward excessively
        const noseY = lm[LM.NOSE].y;
        const shoulderY = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
        if (noseY < shoulderY - 0.15) {
          issues.push({ message: 'Avoid straining your neck forward', joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER] });
        }
        return issues;
      }
    },

    // ─── 10. MOUNTAIN CLIMBERS ───
    mountain_climbers: {
      name: 'Mountain Climbers',
      type: 'rep',
      trackedJoints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE],
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
