/**
 * scoringSystem.js — RepSense Score Calculator
 * Cumulative brand metric that increases with performance and consistency.
 */
const ScoringSystem = (() => {
  const STORAGE_KEY = 'repsense_score';

  // Rank definitions based on cumulative score
  const RANKS = [
    { name: 'Beginner', min: 0, max: 200, color: 'gray' },
    { name: 'Athlete', min: 201, max: 600, color: 'green' },
    { name: 'Advanced', min: 601, max: 1200, color: 'blue' },
    { name: 'Elite', min: 1201, max: 2000, color: 'purple' },
    { name: 'Master', min: 2001, max: 3500, color: 'gold' },
    { name: 'Legend', min: 3501, max: Infinity, color: 'red' }
  ];

  /**
   * Get current score.
   */
  function getScore() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Get rank information for a given score.
   * Returns { name, color, min, max, progressPercent }
   */
  function getRankInfo(score) {
    let currentRank = RANKS[0];
    for (const rank of RANKS) {
      if (score >= rank.min && score <= rank.max) {
        currentRank = rank;
        break;
      }
    }

    let progressPercent = 100; // default for Legend
    if (currentRank.max !== Infinity) {
      const range = currentRank.max - currentRank.min;
      const progress = score - currentRank.min;
      progressPercent = Math.min(100, Math.max(0, (progress / range) * 100));
    }

    return {
      ...currentRank,
      progressPercent
    };
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
    const prevRankInfo = getRankInfo(currentScore);
    
    const newScore = currentScore + delta;
    saveScore(newScore);
    
    const newRankInfo = getRankInfo(newScore);
    const rankUp = newRankInfo.name !== prevRankInfo.name;

    return { delta, newScore, rankUp, newRankInfo };
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
    getRankInfo,
    calculateWorkoutScore,
    getScoreDisplay
  };
})();
