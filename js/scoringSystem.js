/**
 * scoringSystem.js — RepSense Score Calculator
 * Cumulative brand metric that increases with performance and consistency.
 */
const ScoringSystem = (() => {
  const STORAGE_KEY = 'repsense_score';

  /**
   * Get current score.
   */
  function getScore() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Save score.
   */
  function saveScore(score) {
    localStorage.setItem(STORAGE_KEY, score.toString());
  }

  /**
   * Calculate score change after a workout.
   * @param {Object} workoutData
   * @param {number} workoutData.totalReps
   * @param {number} workoutData.avgFormScore - 0-100
   * @param {boolean} workoutData.playlistCompleted
   * @param {number} workoutData.exerciseCount
   * @param {number} workoutData.streak - current streak
   * @returns {Object} { delta, newScore }
   */
  function calculateWorkoutScore(workoutData) {
    let delta = 0;

    // Base points: 1 point per rep
    delta += workoutData.totalReps;

    // Form bonus: up to 20 points for high form
    if (workoutData.avgFormScore >= 90) {
      delta += 20;
    } else if (workoutData.avgFormScore >= 75) {
      delta += 10;
    } else if (workoutData.avgFormScore >= 50) {
      delta += 5;
    }

    // Playlist completion bonus
    if (workoutData.playlistCompleted) {
      delta += 15;
    }

    // Streak bonus: 2 points per streak day
    delta += Math.min(workoutData.streak * 2, 20);

    // Exercise variety bonus
    if (workoutData.exerciseCount >= 5) {
      delta += 10;
    } else if (workoutData.exerciseCount >= 3) {
      delta += 5;
    }

    const currentScore = getScore();
    const newScore = currentScore + delta;
    saveScore(newScore);

    return { delta, newScore };
  }

  /**
   * Get score display string.
   */
  function getScoreDisplay() {
    return getScore().toString();
  }

  return {
    getScore,
    saveScore,
    calculateWorkoutScore,
    getScoreDisplay
  };
})();
