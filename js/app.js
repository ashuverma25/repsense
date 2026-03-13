/**
 * app.js — RepSense App Controller
 * Orchestrates all modules, manages views, and coordinates the workout flow.
 */
const App = (() => {
  // =========================================
  // STATE
  // =========================================
  const VIEWS = ['intro-view', 'profile-view', 'dashboard-view', 'workout-view', 'report-view'];
  let currentView = null;
  let profile = null;

  // Workout state
  let currentPlaylist = null;
  let currentExerciseIndex = 0;
  let workoutPaused = false;
  let workoutStartTime = null;
  let exerciseStartTime = null;
  let exerciseTimer = null;
  let exerciseResults = []; // array of per-exercise data
  let currentExerciseData = null;
  let isWorkoutActive = false;
  let freeWorkoutExercise = null; // for free workout mode

  // =========================================
  // VIEW ROUTING
  // =========================================
  // Map each view to its correct CSS display value
  const VIEW_DISPLAY = {
    'intro-view': 'flex',
    'profile-view': 'flex',
    'dashboard-view': 'block',
    'workout-view': 'block',
    'report-view': 'block'
  };

  function showView(viewId) {
    for (const id of VIEWS) {
      const el = document.getElementById(id);
      if (el) {
        if (id === viewId) {
          el.classList.remove('hidden');
          el.style.display = VIEW_DISPLAY[id] || 'block';
        } else {
          el.classList.add('hidden');
          el.style.display = 'none';
        }
      }
    }
    currentView = viewId;
  }

  // =========================================
  // INITIALIZATION
  // =========================================
  let introAnimationDone = false;

  function init() {
    profile = loadProfile();

    // Skip intro button
    document.getElementById('skip-intro-btn')?.addEventListener('click', skipIntro);

    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);

    // Dashboard buttons
    document.getElementById('create-playlist-btn')?.addEventListener('click', openCreatePlaylistModal);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closePlaylistModal);
    document.getElementById('modal-save-btn')?.addEventListener('click', handleSavePlaylist);

    // Workout controls
    document.getElementById('btn-pause-workout')?.addEventListener('click', togglePause);
    document.getElementById('btn-skip-exercise')?.addEventListener('click', skipExercise);
    document.getElementById('btn-stop-workout')?.addEventListener('click', stopWorkout);

    // Report done
    document.getElementById('report-done-btn')?.addEventListener('click', () => {
      showView('dashboard-view');
      refreshDashboard();
    });

    // Initialize voice assistant
    VoiceAssistant.init();
    VoiceAssistant.setOnCommand(handleVoiceCommand);

    // Initialize camera
    CameraModule.init(document.getElementById('camera-video'));

    // Initialize profile drawer
    initProfileDrawer();

    // Show intro and run animation
    showView('intro-view');
    runIntroAnimation();
  }

  /**
   * Run the premium diagonal intro animation — smooth, slow, cinematic.
   */
  function runIntroAnimation() {
    const repEl = document.getElementById('intro-text-rep');
    const senseEl = document.getElementById('intro-text-sense');
    const tagline = document.getElementById('intro-tagline');
    const introView = document.getElementById('intro-view');
    const skipBtn = document.getElementById('skip-intro-btn');
    const countdownEl = document.getElementById('skip-countdown');

    if (!repEl || !senseEl) {
      goToNextAfterIntro();
      return;
    }

    // Step 1: Slide REP from top-left with fade (0ms)
    requestAnimationFrame(() => {
      repEl.classList.add('animate-in');

      // Step 2: Slide SENSE from bottom-right with 200ms stagger
      setTimeout(() => {
        senseEl.classList.add('animate-in');
      }, 200);
    });

    // Step 3: Settle micro-bounce at ~1.5s (both have arrived)
    setTimeout(() => {
      repEl.classList.add('settle');
      senseEl.classList.add('settle');
    }, 1500);

    // Step 4: Subtle glow pulse at ~1.75s
    setTimeout(() => {
      repEl.classList.add('glow-pulse');
      senseEl.classList.add('glow-pulse');
    }, 1750);

    // Step 5: Show tagline at ~2s
    setTimeout(() => {
      tagline.classList.add('visible');
    }, 2000);

    // Step 6: Show skip button + start countdown at ~2.5s
    setTimeout(() => {
      if (introAnimationDone) return;
      skipBtn.classList.add('visible');
      startSkipCountdown(countdownEl, introView);
    }, 2500);
  }

  /**
   * Run the skip countdown: 3 → 2 → 1 → auto-transition.
   */
  let countdownInterval = null;

  function startSkipCountdown(countdownEl, introView) {
    let remaining = 3;
    countdownEl.textContent = `(${remaining})`;

    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        countdownEl.textContent = `(${remaining})`;
      } else {
        clearInterval(countdownInterval);
        countdownInterval = null;
        countdownEl.textContent = '';
        // Auto-transition
        if (!introAnimationDone) {
          introAnimationDone = true;
          introView.classList.add('intro-fade-out');
          setTimeout(() => {
            goToNextAfterIntro();
          }, 600);
        }
      }
    }, 1000);
  }

  /**
   * Skip intro immediately.
   */
  function skipIntro() {
    if (introAnimationDone) return;
    introAnimationDone = true;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    const introView = document.getElementById('intro-view');
    introView.classList.add('intro-fade-out');
    setTimeout(() => {
      goToNextAfterIntro();
    }, 400);
  }

  function goToNextAfterIntro() {
    if (profile) {
      showView('dashboard-view');
      refreshDashboard();
    } else {
      showView('profile-view');
    }
  }

  // =========================================
  // PROFILE
  // =========================================
  function loadProfile() {
    const stored = localStorage.getItem('repsense_profile');
    return stored ? JSON.parse(stored) : null;
  }

  function saveProfile(data) {
    localStorage.setItem('repsense_profile', JSON.stringify(data));
    profile = data;
  }

  function handleProfileSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    const age = parseInt(document.getElementById('profile-age').value);
    const gender = document.getElementById('profile-gender').value;
    const fitness = document.getElementById('profile-fitness').value;

    if (!name || !age || !gender || !fitness) return;

    saveProfile({ name, age, gender, fitness });
    showView('dashboard-view');
    refreshDashboard();
  }

  // =========================================
  // DASHBOARD
  // =========================================
  function refreshDashboard() {
    if (!profile) return;

    // Insight cards
    document.getElementById('dash-score').textContent = ScoringSystem.getScoreDisplay();
    document.getElementById('dash-streak').textContent = CalendarTracker.getStreak();

    const streak = CalendarTracker.getStreak();
    document.getElementById('dash-streak-sub').textContent = streak === 1 ? 'day' : 'days';

    const avgForm = CalendarTracker.getAvgFormScore();
    document.getElementById('dash-form').textContent = avgForm > 0 ? avgForm + '%' : '—';

    // Calendar & playlists
    CalendarTracker.renderCalendar();
    PlaylistManager.renderList(startPlaylist, openEditPlaylistModal, deletePlaylist);

    // Profile drawer data
    refreshDrawer();
  }

  function refreshDrawer() {
    if (!profile) return;
    const nameEl = document.getElementById('drawer-username');
    const ageEl = document.getElementById('drawer-age');
    const fitnessEl = document.getElementById('drawer-fitness');
    const scoreEl = document.getElementById('drawer-score');
    if (nameEl) nameEl.textContent = profile.name;
    if (ageEl) ageEl.textContent = profile.age || '—';
    if (fitnessEl) fitnessEl.textContent = profile.fitness || '—';
    if (scoreEl) scoreEl.textContent = ScoringSystem.getScoreDisplay();
  }

  // =========================================
  // PROFILE DRAWER
  // =========================================
  function initProfileDrawer() {
    const profileBtn = document.getElementById('profile-icon');
    const drawer = document.getElementById('profile-drawer');
    const overlay = document.getElementById('drawer-overlay');

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        drawer.classList.add('open');
        overlay.classList.add('open');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
  }

  /**
   * Format seconds into a human-readable duration string.
   */
  function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  // =========================================
  // PLAYLIST MODAL
  // =========================================
  let editingPlaylistId = null;

  function openCreatePlaylistModal() {
    editingPlaylistId = null;
    document.getElementById('modal-title').textContent = 'Create Playlist';
    document.getElementById('modal-playlist-name').value = '';
    document.getElementById('modal-reps-per-exercise').value = '12';
    renderExerciseChips([]);
    showModal();
  }

  function openEditPlaylistModal(playlist) {
    editingPlaylistId = playlist.id;
    document.getElementById('modal-title').textContent = 'Edit Playlist';
    document.getElementById('modal-playlist-name').value = playlist.name;
    document.getElementById('modal-reps-per-exercise').value = playlist.repsPerExercise || 12;
    renderExerciseChips(playlist.exercises);
    showModal();
  }

  function renderExerciseChips(selected) {
    const container = document.getElementById('modal-exercise-chips');
    container.innerHTML = '';
    for (const key of ExerciseEngine.getExerciseList()) {
      const chip = document.createElement('div');
      chip.className = `exercise-chip${selected.includes(key) ? ' selected' : ''}`;
      chip.textContent = ExerciseEngine.getExerciseName(key);
      chip.dataset.exercise = key;
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
      container.appendChild(chip);
    }
  }

  function showModal() {
    const modal = document.getElementById('playlist-modal');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
  }

  function closePlaylistModal() {
    const modal = document.getElementById('playlist-modal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
  }

  function handleSavePlaylist() {
    const name = document.getElementById('modal-playlist-name').value.trim();
    const reps = parseInt(document.getElementById('modal-reps-per-exercise').value) || 12;
    const selected = [...document.querySelectorAll('#modal-exercise-chips .exercise-chip.selected')]
      .map(el => el.dataset.exercise);

    if (!name || selected.length === 0) {
      showToast('Please enter a name and select exercises.');
      return;
    }

    if (editingPlaylistId) {
      PlaylistManager.update(editingPlaylistId, { name, exercises: selected, repsPerExercise: reps });
    } else {
      PlaylistManager.create(name, selected, reps);
    }

    closePlaylistModal();
    PlaylistManager.renderList(startPlaylist, openEditPlaylistModal, deletePlaylist);
    showToast(editingPlaylistId ? 'Playlist updated!' : 'Playlist created!');
  }

  function deletePlaylist(playlist) {
    if (confirm(`Delete "${playlist.name}"?`)) {
      PlaylistManager.remove(playlist.id);
      PlaylistManager.renderList(startPlaylist, openEditPlaylistModal, deletePlaylist);
      showToast('Playlist deleted.');
    }
  }

  // =========================================
  // WORKOUT FLOW
  // =========================================

  /**
   * Start a playlist workout.
   */
  async function startPlaylist(playlist) {
    currentPlaylist = playlist;
    currentExerciseIndex = 0;
    exerciseResults = [];
    workoutPaused = false;
    workoutStartTime = Date.now();
    isWorkoutActive = true;
    freeWorkoutExercise = null;

    showView('workout-view');

    // Start camera
    try {
      await CameraModule.start();
    } catch (err) {
      showToast('Camera access denied. Please allow camera permissions.');
      showView('dashboard-view');
      return;
    }

    // Init pose detection
    await PoseDetectionModule.init(
      document.getElementById('pose-canvas'),
      document.getElementById('camera-video')
    );

    PoseDetectionModule.setOnResults(handlePoseResults);
    PoseDetectionModule.startLoop();

    // Start voice
    VoiceAssistant.clearMessages();
    VoiceAssistant.startListening();

    if (playlist.isFree) {
      VoiceAssistant.speak('Free Workout mode. Choose an exercise.');
      showFreeWorkoutSelector();
    } else {
      VoiceAssistant.speak(`Starting ${playlist.name}`);
      beginExercise(playlist.exercises[0]);
    }
  }

  /**
   * Show exercise selector for free workout.
   */
  function showFreeWorkoutSelector() {
    const preview = document.getElementById('exercise-preview');
    preview.classList.remove('hidden');
    document.getElementById('preview-exercise-name').textContent = 'Choose Exercise';
    document.getElementById('preview-target').innerHTML = '';

    const container = document.getElementById('preview-target');
    container.innerHTML = '';
    for (const key of ExerciseEngine.getExerciseList()) {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.margin = '4px';
      btn.textContent = ExerciseEngine.getExerciseName(key);
      btn.addEventListener('click', () => {
        freeWorkoutExercise = key;
        preview.classList.add('hidden');
        beginExercise(key);
      });
      container.appendChild(btn);
    }
  }

  /**
   * Begin a specific exercise with preview + countdown.
   */
  async function beginExercise(exerciseKey) {
    const exercise = ExerciseEngine.getExercise(exerciseKey);
    if (!exercise) return;

    currentExerciseData = {
      key: exerciseKey,
      name: exercise.name,
      reps: 0,
      formScores: [],
      issues: [],
      plankTime: 0,
      startTime: Date.now()
    };

    // Show exercise preview
    await showExercisePreview(exercise, exerciseKey);

    // Wait for frame readiness
    await waitForFrameReady();

    // Countdown
    await showCountdown();

    // Start exercise tracking
    FormAnalyzer.reset(exerciseKey);
    RepStateMachine.startExercise(exerciseKey);

    // Update UI
    document.getElementById('workout-exercise-name').textContent = exercise.name;
    document.getElementById('workout-exercise-status').textContent = exercise.type === 'timer' ? 'Hold position' : 'Start exercising';
    document.getElementById('metric-reps').textContent = '0';
    document.getElementById('metric-depth').textContent = '—';
    document.getElementById('metric-timer').textContent = '00:00';
    document.getElementById('form-score-value').textContent = '—';
    document.getElementById('form-bar-fill').style.width = '0%';

    const target = currentPlaylist.repsPerExercise;
    document.getElementById('metric-target').textContent = target > 0 ? `${target} reps` : 'Free';

    const totalEx = currentPlaylist.exercises.length;
    document.getElementById('metric-exercise-idx').textContent = currentPlaylist.isFree
      ? 'Free Mode'
      : `${currentExerciseIndex + 1} / ${totalEx}`;

    VoiceAssistant.speak(`${exercise.name}. Let's go!`);

    // Set up rep callback
    RepStateMachine.setOnRep(handleRepCompleted);

    // Start exercise timer
    exerciseStartTime = Date.now();
    startExerciseTimer();
  }

  /**
   * Show exercise preview for 2 seconds.
   */
  function showExercisePreview(exercise, exerciseKey) {
    return new Promise((resolve) => {
      const preview = document.getElementById('exercise-preview');
      document.getElementById('preview-exercise-name').textContent = exercise.name;
      document.getElementById('preview-target').textContent = currentPlaylist.repsPerExercise > 0
        ? `Target: ${currentPlaylist.repsPerExercise} reps`
        : (exercise.type === 'timer' ? 'Hold as long as you can' : 'Do as many as you want');

      // Draw a stick figure
      drawStickFigure(exerciseKey);

      preview.classList.remove('hidden');

      setTimeout(() => {
        preview.classList.add('hidden');
        resolve();
      }, 2500);
    });
  }

  /**
   * Draw a simple stick figure for exercise preview.
   */
  function drawStickFigure(exerciseKey) {
    const svg = document.getElementById('preview-svg');
    if (!svg) return;

    // Simple stick figure representations
    const figures = {
      squats: `<line x1="50" y1="20" x2="50" y2="50" stroke="#00ff88" stroke-width="2"/>
        <circle cx="50" cy="15" r="8" fill="none" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="30" x2="30" y2="45" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="30" x2="70" y2="45" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="50" x2="35" y2="75" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="50" x2="65" y2="75" stroke="#00ff88" stroke-width="2"/>
        <line x1="35" y1="75" x2="30" y2="100" stroke="#00ff88" stroke-width="2"/>
        <line x1="65" y1="75" x2="70" y2="100" stroke="#00ff88" stroke-width="2"/>`,
      default: `<circle cx="50" cy="15" r="8" fill="none" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="23" x2="50" y2="60" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="35" x2="30" y2="50" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="35" x2="70" y2="50" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="60" x2="35" y2="90" stroke="#00ff88" stroke-width="2"/>
        <line x1="50" y1="60" x2="65" y2="90" stroke="#00ff88" stroke-width="2"/>`
    };

    svg.innerHTML = figures[exerciseKey] || figures.default;
  }

  /**
   * Wait until frame is ready (body visible).
   */
  function waitForFrameReady() {
    return new Promise((resolve) => {
      const statusEl = document.getElementById('frame-status');
      statusEl.classList.remove('hidden');

      function check() {
        if (PoseDetectionModule.isBodyVisible()) {
          statusEl.textContent = 'Frame Ready ✓';
          statusEl.className = 'frame-status ready';
          setTimeout(() => {
            statusEl.classList.add('hidden');
            resolve();
          }, 800);
        } else {
          statusEl.textContent = 'Step back so your full body is visible';
          statusEl.className = 'frame-status not-ready';
          requestAnimationFrame(check);
        }
      }

      // Give pose detection a moment to start
      setTimeout(check, 500);
    });
  }

  /**
   * Show 3-2-1 countdown.
   */
  function showCountdown() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('countdown-overlay');
      const numberEl = document.getElementById('countdown-number');
      overlay.classList.remove('hidden');

      let count = 3;
      numberEl.textContent = count;

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          numberEl.textContent = count;
          numberEl.style.animation = 'none';
          void numberEl.offsetWidth; // trigger reflow
          numberEl.style.animation = 'countdownPulse 0.8s ease-out';
        } else {
          clearInterval(interval);
          numberEl.textContent = 'GO!';
          numberEl.style.animation = 'none';
          void numberEl.offsetWidth;
          numberEl.style.animation = 'countdownPulse 0.8s ease-out';
          setTimeout(() => {
            overlay.classList.add('hidden');
            resolve();
          }, 600);
        }
      }, 1000);
    });
  }

  // =========================================
  // POSE RESULTS HANDLER
  // =========================================
  function handlePoseResults(landmarks, bodyVisible) {
    if (!isWorkoutActive || workoutPaused) return;

    // Update frame status
    const statusEl = document.getElementById('frame-status');
    if (!bodyVisible && !statusEl.classList.contains('hidden')) {
      statusEl.textContent = 'Step back so your full body is visible';
      statusEl.className = 'frame-status not-ready';
    }

    if (!landmarks || !RepStateMachine.getCurrentExerciseKey()) return;

    // Process frame
    const result = RepStateMachine.processFrame(landmarks);
    if (!result) return;

    // Update metrics
    if (result.isTimer) {
      // Plank mode
      const time = result.plankTime;
      document.getElementById('metric-reps').textContent = formatTime(time);
      document.getElementById('metric-depth').textContent = result.state === 'HOLDING' ? '✓' : '✗';
      document.getElementById('workout-exercise-status').textContent = result.state === 'HOLDING' ? 'Holding...' : 'Align your body!';

      if (currentExerciseData) {
        currentExerciseData.plankTime = time;
      }

      // Form scoring for plank
      const score = FormAnalyzer.scorePlankFrame(result.angles.bodyLine);
      updateFormBar(score);

      // Red joint highlight if misaligned
      if (result.formIssues.length > 0) {
        for (const issue of result.formIssues) {
          PoseDetectionModule.markJointIncorrect(landmarks, issue.joint);
        }
      }
    } else {
      // Rep exercises
      document.getElementById('metric-reps').textContent = result.repCount;
      document.getElementById('metric-depth').textContent = result.depth + '%';
      document.getElementById('workout-exercise-status').textContent = result.state;

      // Mark incorrect joints
      if (result.formIssues.length > 0) {
        for (const issue of result.formIssues) {
          PoseDetectionModule.markJointIncorrect(landmarks, issue.joint);
        }
      }
    }
  }

  /**
   * Handle completed rep.
   */
  function handleRepCompleted(repCount, depth, formIssues) {
    // Score the rep
    const scoreResult = FormAnalyzer.scoreRep(depth, formIssues);

    if (currentExerciseData) {
      currentExerciseData.reps = repCount;
      currentExerciseData.formScores.push(scoreResult.repScore);
      if (formIssues.length > 0) {
        currentExerciseData.issues.push(...formIssues.map(i => i.message));
      }
    }

    // Update form bar
    updateFormBar(scoreResult.avgScore);

    // Voice feedback
    if (scoreResult.repScore >= 80) {
      if (repCount % 5 === 0) {
        VoiceAssistant.speak(`${repCount} reps. ${scoreResult.feedback}`);
      } else {
        VoiceAssistant.speak(`${repCount}`);
      }
    } else {
      VoiceAssistant.speak(scoreResult.feedback);
    }

    // Check if target reached
    const target = currentPlaylist.repsPerExercise;
    if (target > 0 && repCount >= target) {
      VoiceAssistant.speak('Target reached! Great job.');
      setTimeout(() => moveToNextExercise(), 1500);
    }
  }

  /**
   * Update form score bar.
   */
  function updateFormBar(score) {
    const fill = document.getElementById('form-bar-fill');
    const value = document.getElementById('form-score-value');
    if (fill) {
      fill.style.width = score + '%';
      fill.className = 'form-bar-fill' + (score < 50 ? ' danger' : score < 75 ? ' warning' : '');
    }
    if (value) {
      value.textContent = score + '%';
    }
  }

  // =========================================
  // EXERCISE TIMER
  // =========================================
  function startExerciseTimer() {
    if (exerciseTimer) clearInterval(exerciseTimer);
    exerciseTimer = setInterval(() => {
      if (!workoutPaused && exerciseStartTime) {
        const elapsed = Math.floor((Date.now() - exerciseStartTime) / 1000);
        document.getElementById('metric-timer').textContent = formatTime(elapsed);
      }
    }, 1000);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // =========================================
  // EXERCISE TRANSITIONS
  // =========================================
  function moveToNextExercise() {
    // Save current exercise data
    finishCurrentExercise();

    if (currentPlaylist.isFree) {
      showFreeWorkoutSelector();
      return;
    }

    currentExerciseIndex++;
    if (currentExerciseIndex < currentPlaylist.exercises.length) {
      const nextKey = currentPlaylist.exercises[currentExerciseIndex];
      VoiceAssistant.speak(`Next exercise: ${ExerciseEngine.getExerciseName(nextKey)}`);
      beginExercise(nextKey);
    } else {
      // Workout complete
      finishWorkout(true);
    }
  }

  function finishCurrentExercise() {
    RepStateMachine.stopExercise();
    if (exerciseTimer) {
      clearInterval(exerciseTimer);
      exerciseTimer = null;
    }

    if (currentExerciseData) {
      currentExerciseData.endTime = Date.now();
      currentExerciseData.avgFormScore = currentExerciseData.formScores.length > 0
        ? Math.round(currentExerciseData.formScores.reduce((a, b) => a + b, 0) / currentExerciseData.formScores.length)
        : 0;
      exerciseResults.push(currentExerciseData);
      currentExerciseData = null;
    }
  }

  // =========================================
  // WORKOUT CONTROLS
  // =========================================
  function togglePause() {
    workoutPaused = !workoutPaused;
    const btn = document.getElementById('btn-pause-workout');
    btn.textContent = workoutPaused ? '▶' : '⏸';
    btn.title = workoutPaused ? 'Resume' : 'Pause';
    VoiceAssistant.speak(workoutPaused ? 'Workout paused.' : 'Resuming workout.');
  }

  function skipExercise() {
    VoiceAssistant.speak('Skipping exercise.');
    moveToNextExercise();
  }

  function stopWorkout() {
    VoiceAssistant.speak('Stopping workout.');
    finishCurrentExercise();
    finishWorkout(false);
  }

  function handleVoiceCommand(cmd) {
    switch (cmd) {
      case 'pause': togglePause(); break;
      case 'skip': skipExercise(); break;
      case 'stop': stopWorkout(); break;
      case 'repeat':
        if (!currentPlaylist.isFree && currentExerciseIndex > 0) {
          finishCurrentExercise();
          currentExerciseIndex--;
          beginExercise(currentPlaylist.exercises[currentExerciseIndex]);
        }
        break;
    }
  }

  // =========================================
  // FINISH WORKOUT & REPORT
  // =========================================
  function finishWorkout(completed) {
    isWorkoutActive = false;

    // Stop all systems
    PoseDetectionModule.stopLoop();
    CameraModule.stop();
    VoiceAssistant.stop();
    if (exerciseTimer) clearInterval(exerciseTimer);

    // Calculate totals
    const totalReps = exerciseResults.reduce((sum, e) => sum + e.reps, 0);
    const totalPlankTime = exerciseResults.reduce((sum, e) => sum + (e.plankTime || 0), 0);
    const allFormScores = exerciseResults.flatMap(e => e.formScores);
    const avgFormScore = allFormScores.length > 0
      ? Math.round(allFormScores.reduce((a, b) => a + b, 0) / allFormScores.length)
      : 0;
    const duration = Math.floor((Date.now() - workoutStartTime) / 1000);

    // Calculate RepSense Score
    const scoreResult = ScoringSystem.calculateWorkoutScore({
      totalReps,
      avgFormScore,
      playlistCompleted: completed,
      exerciseCount: exerciseResults.length,
      streak: CalendarTracker.getStreak() + 1
    });

    // Log to calendar
    CalendarTracker.logWorkout({
      playlistName: currentPlaylist.name,
      totalReps,
      avgFormScore,
      duration,
      playlistCompleted: completed,
      exerciseCount: exerciseResults.length,
      exercises: exerciseResults.map(e => ({
        name: e.name,
        reps: e.reps,
        plankTime: e.plankTime,
        avgFormScore: e.avgFormScore
      }))
    });

    // Render report
    renderReport(totalReps, avgFormScore, duration, scoreResult.newScore, completed);
    showView('report-view');
  }

  function renderReport(totalReps, avgFormScore, duration, newScore, completed) {
    document.getElementById('report-total-reps').textContent = totalReps;
    document.getElementById('report-form-score').textContent = avgFormScore + '%';
    document.getElementById('report-duration').textContent = formatTime(duration);
    document.getElementById('report-repsense-score').textContent = newScore;

    // Exercise list
    const listEl = document.getElementById('report-exercise-list');
    listEl.innerHTML = '';
    for (const ex of exerciseResults) {
      const item = document.createElement('div');
      item.className = 'report-exercise-item';
      const repsDisplay = ex.plankTime > 0 ? formatTime(ex.plankTime) : ex.reps + ' reps';
      const formClass = ex.avgFormScore >= 80 ? 'color:var(--accent)' : ex.avgFormScore >= 50 ? 'color:var(--warning)' : 'color:var(--danger)';

      item.innerHTML = `
        <span class="name">${ex.name}</span>
        <span class="reps">${repsDisplay}</span>
        <span class="form-score" style="${formClass}">${ex.avgFormScore}%</span>
        <span class="feedback">${ex.issues.length > 0 ? ex.issues[0] : 'Good form'}</span>
      `;
      listEl.appendChild(item);
    }

    // Form issues
    const issuesSection = document.getElementById('report-issues-section');
    const issuesList = document.getElementById('report-issues-list');
    const allIssues = exerciseResults.flatMap(e => e.issues.map(i => `${e.name}: ${i}`));
    const uniqueIssues = [...new Set(allIssues)];

    if (uniqueIssues.length === 0) {
      issuesSection.classList.add('hidden');
    } else {
      issuesSection.classList.remove('hidden');
      issuesList.innerHTML = '';
      for (const issue of uniqueIssues) {
        const item = document.createElement('div');
        item.className = 'issue-item';
        item.innerHTML = `<div class="issue-dot"></div><span>${issue}</span>`;
        issuesList.appendChild(item);
      }
    }
  }

  // =========================================
  // TOAST NOTIFICATION
  // =========================================
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  // =========================================
  // BOOT
  // =========================================
  document.addEventListener('DOMContentLoaded', init);

  return {
    showView,
    refreshDashboard,
    showToast
  };
})();
