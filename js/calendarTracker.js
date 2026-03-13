/**
 * calendarTracker.js — Activity Calendar & Streak
 * Stores workout history in localStorage, renders heatmap calendar, tracks streaks.
 */
const CalendarTracker = (() => {
  const STORAGE_KEY = 'repsense_calendar';

  /**
   * Get all workout history.
   * Returns object: { "YYYY-MM-DD": [{ ...workoutData }] }
   */
  function getHistory() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Log a completed workout.
   * @param {Object} workoutData
   */
  function logWorkout(workoutData) {
    const history = getHistory();
    const today = getDateKey(new Date());

    if (!history[today]) {
      history[today] = [];
    }

    history[today].push({
      ...workoutData,
      timestamp: Date.now()
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  /**
   * Get date key string.
   */
  function getDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate current workout streak.
   */
  function getStreak() {
    const history = getHistory();
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today has a workout
    const todayKey = getDateKey(today);
    if (history[todayKey] && history[todayKey].length > 0) {
      streak = 1;
    } else {
      // If no workout today, check from yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = getDateKey(yesterday);
      if (!history[yesterdayKey] || history[yesterdayKey].length === 0) {
        return 0;
      }
    }

    // Go backwards
    const checkDate = new Date(today);
    if (streak === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
      streak = 1;
    }

    for (let i = 1; i < 365; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const key = getDateKey(checkDate);
      if (history[key] && history[key].length > 0) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get total workout count.
   */
  function getTotalWorkouts() {
    const history = getHistory();
    let count = 0;
    for (const day of Object.values(history)) {
      count += day.length;
    }
    return count;
  }

  /**
   * Get average form score across all workouts.
   */
  function getAvgFormScore() {
    const history = getHistory();
    let totalScore = 0;
    let count = 0;
    for (const day of Object.values(history)) {
      for (const workout of day) {
        if (workout.avgFormScore !== undefined) {
          totalScore += workout.avgFormScore;
          count++;
        }
      }
    }
    return count > 0 ? Math.round(totalScore / count) : 0;
  }

  /**
   * Render calendar heatmap for the current month.
   */
  function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const history = getHistory();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun

    container.innerHTML = `
      <div class="calendar-month-label">${monthName}</div>
      <div class="calendar-grid" id="calendar-grid"></div>
      <div class="calendar-legend">
        <span><div class="legend-dot green"></div>Complete</span>
        <span><div class="legend-dot yellow"></div>Partial</span>
        <span><div class="legend-dot gray"></div>No workout</span>
      </div>
    `;

    const grid = document.getElementById('calendar-grid');

    // Day headers
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (const d of days) {
      const hdr = document.createElement('div');
      hdr.className = 'calendar-day-header';
      hdr.textContent = d;
      grid.appendChild(hdr);
    }

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      grid.appendChild(empty);
    }

    // Days of month
    const today = now.getDate();
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dayEl = document.createElement('div');
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const workouts = history[dateKey] || [];

      let cls = 'none';
      if (workouts.length > 0) {
        // Check if at least one was a "complete" workout
        const hasComplete = workouts.some(w => w.playlistCompleted);
        cls = hasComplete ? 'complete' : 'partial';
      }

      dayEl.className = `calendar-day ${cls}${d === today ? ' today' : ''}`;
      dayEl.textContent = d;

      if (workouts.length > 0) {
        dayEl.title = `${workouts.length} workout(s)`;
      }

      grid.appendChild(dayEl);
    }
  }

  /**
   * Get total exercises completed across all workouts.
   */
  function getTotalExercises() {
    const history = getHistory();
    let count = 0;
    for (const day of Object.values(history)) {
      for (const workout of day) {
        count += workout.exerciseCount || (workout.exercises ? workout.exercises.length : 0);
      }
    }
    return count;
  }

  /**
   * Get total workout time in seconds.
   */
  function getTotalWorkoutTime() {
    const history = getHistory();
    let totalSeconds = 0;
    for (const day of Object.values(history)) {
      for (const workout of day) {
        totalSeconds += workout.duration || 0;
      }
    }
    return totalSeconds;
  }

  /**
   * Get the best workout day (highest single-session score delta).
   * Returns { date, score } or null.
   */
  function getBestWorkoutDay() {
    const history = getHistory();
    let best = null;

    for (const [dateKey, workouts] of Object.entries(history)) {
      for (const workout of workouts) {
        // Estimate score delta from workout data (same formula as ScoringSystem)
        let delta = 0;
        delta += workout.totalReps || 0;
        const form = workout.avgFormScore || 0;
        if (form >= 90) delta += 20;
        else if (form >= 75) delta += 10;
        else if (form >= 50) delta += 5;
        if (workout.playlistCompleted) delta += 15;
        const exCount = workout.exerciseCount || 0;
        if (exCount >= 5) delta += 10;
        else if (exCount >= 3) delta += 5;

        if (!best || delta > best.score) {
          best = { date: dateKey, score: delta };
        }
      }
    }

    return best;
  }

  /**
   * Get today's workouts.
   */
  function getTodayWorkouts() {
    const history = getHistory();
    const todayKey = getDateKey(new Date());
    return history[todayKey] || [];
  }

  return {
    getHistory,
    logWorkout,
    getStreak,
    getTotalWorkouts,
    getAvgFormScore,
    getTotalExercises,
    getTotalWorkoutTime,
    getBestWorkoutDay,
    getTodayWorkouts,
    renderCalendar
  };
})();
