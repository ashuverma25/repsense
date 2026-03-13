/**
 * formAnalyzer.js — Form Scoring & Feedback
 * Calculates per-rep form scores, running averages, and generates feedback.
 */
const FormAnalyzer = (() => {
  let repScores = []; // per-rep form scores for the current exercise
  let issueLog = []; // accumulated form issues
  let currentExerciseKey = null;

  /**
   * Reset for a new exercise.
   */
  function reset(exerciseKey) {
    repScores = [];
    issueLog = [];
    currentExerciseKey = exerciseKey;
  }

  /**
   * Score a completed rep.
   * @param {number} depth - 0-100 depth percentage
   * @param {Array} formIssues - form issues from this frame
   * @returns {Object} { repScore, avgScore, feedback }
   */
  function scoreRep(depth, formIssues) {
    let score = 100;

    // Deduct for shallow depth
    if (depth < 70) {
      score -= (70 - depth) * 0.8;
    }

    // Deduct for form issues
    if (formIssues.length > 0) {
      score -= formIssues.length * 15;
    }

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));

    repScores.push(score);

    // Log issues
    for (const issue of formIssues) {
      issueLog.push({
        exercise: currentExerciseKey,
        message: issue.message,
        repNumber: repScores.length
      });
    }

    // Generate feedback
    const feedback = generateFeedback(score, depth, formIssues);

    return {
      repScore: score,
      avgScore: getAvgScore(),
      feedback
    };
  }

  /**
   * Generate coaching feedback based on score.
   */
  function generateFeedback(score, depth, formIssues) {
    if (score >= 95) {
      const msgs = ['Perfect form!', 'Excellent rep!', 'Flawless!', 'Great job!'];
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
    if (score >= 80) {
      if (depth < 70) return 'Go deeper for full range.';
      return 'Good rep! Keep it up.';
    }
    if (score >= 60) {
      if (formIssues.length > 0) return formIssues[0].message;
      return 'Almost there, focus on form.';
    }
    // Score < 60
    if (formIssues.length > 0) return formIssues[0].message;
    return "That rep didn't count. Try again.";
  }

  /**
   * Get average form score.
   */
  function getAvgScore() {
    if (repScores.length === 0) return 0;
    const sum = repScores.reduce((a, b) => a + b, 0);
    return Math.round(sum / repScores.length);
  }

  /**
   * Get all rep scores.
   */
  function getRepScores() {
    return [...repScores];
  }

  /**
   * Get accumulated issue log.
   */
  function getIssueLog() {
    return [...issueLog];
  }

  /**
   * Get summary for the current exercise.
   */
  function getSummary() {
    return {
      totalReps: repScores.length,
      avgScore: getAvgScore(),
      issues: [...issueLog],
      scores: [...repScores]
    };
  }

  /**
   * Score form during plank hold (continuous).
   */
  function scorePlankFrame(bodyLine) {
    // Perfect = 180 degrees
    const deviation = Math.abs(180 - bodyLine);
    const score = Math.max(0, Math.min(100, Math.round(100 - deviation * 2)));
    return score;
  }

  return {
    reset,
    scoreRep,
    getAvgScore,
    getRepScores,
    getIssueLog,
    getSummary,
    scorePlankFrame
  };
})();
