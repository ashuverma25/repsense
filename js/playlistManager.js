/**
 * playlistManager.js — Workout Playlist CRUD
 * Manages playlists in localStorage with a default "Free Workout" playlist.
 */
const PlaylistManager = (() => {
  const STORAGE_KEY = 'repsense_playlists';

  // Default Free Workout playlist
  const FREE_WORKOUT = {
    id: 'free_workout',
    name: 'Free Workout',
    exercises: ExerciseEngine.getExerciseList(),
    repsPerExercise: 0, // 0 = no limit
    isFree: true
  };

  /**
   * Get all playlists.
   * @returns {Array}
   */
  function getAll() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const custom = stored ? JSON.parse(stored) : [];
    return [FREE_WORKOUT, ...custom];
  }

  /**
   * Get playlist by ID.
   */
  function getById(id) {
    if (id === 'free_workout') return FREE_WORKOUT;
    const all = getAll();
    return all.find(p => p.id === id) || null;
  }

  /**
   * Create a new playlist.
   * @param {string} name
   * @param {Array<string>} exercises - exercise keys
   * @param {number} repsPerExercise
   * @returns {Object} created playlist
   */
  function create(name, exercises, repsPerExercise) {
    const playlist = {
      id: 'pl_' + Date.now(),
      name,
      exercises,
      repsPerExercise: repsPerExercise || 12,
      isFree: false
    };

    const stored = localStorage.getItem(STORAGE_KEY);
    const custom = stored ? JSON.parse(stored) : [];
    custom.push(playlist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));

    return playlist;
  }

  /**
   * Update a playlist.
   */
  function update(id, data) {
    if (id === 'free_workout') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const custom = stored ? JSON.parse(stored) : [];
    const idx = custom.findIndex(p => p.id === id);
    if (idx >= 0) {
      custom[idx] = { ...custom[idx], ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    }
  }

  /**
   * Delete a playlist.
   */
  function remove(id) {
    if (id === 'free_workout') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const custom = stored ? JSON.parse(stored) : [];
    const filtered = custom.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Render playlist list to DOM.
   * @param {Function} onStart - callback when user clicks to start a playlist
   * @param {Function} onEdit - callback when user clicks edit
   * @param {Function} onDelete - callback when user clicks delete
   */
  // SVG icons for playlist thumbnails
  const PLAYLIST_ICONS = {
    free: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M4 8.5v7"/><path d="M20 8.5v7"/><path d="M2 10v4"/><path d="M22 10v4"/></svg>`,
    running: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="4" r="2"/><path d="M15.59 13.51l-1.59-4.51 4-1 .5 3.5-2.5 1z"/><path d="M9 22l3-9 3 2v-4l-4-2-3 5-2-1"/><path d="M2 17l3-3"/></svg>`,
    body: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="12" y1="11" x2="8" y2="14"/><line x1="12" y1="11" x2="16" y2="14"/><line x1="12" y1="16" x2="9" y2="22"/><line x1="12" y1="16" x2="15" y2="22"/></svg>`
  };

  // Rotate icons for variety
  const ICON_CYCLE = ['dumbbell', 'running', 'body'];

  function getPlaylistIcon(pl, index) {
    if (pl.isFree) return PLAYLIST_ICONS.free;
    return PLAYLIST_ICONS[ICON_CYCLE[index % ICON_CYCLE.length]];
  }

  // Play icon SVG for button
  const PLAY_SVG = `<svg viewBox="0 0 24 24" width="14" height="14"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>`;

  function renderList(onStart, onEdit, onDelete) {
    const container = document.getElementById('playlist-list');
    if (!container) return;
    container.innerHTML = '';

    const playlists = getAll();
    let customIdx = 0;

    for (const pl of playlists) {
      const card = document.createElement('div');
      card.className = 'playlist-card' + (pl.isFree ? ' free-card' : '');

      const thumbIcon = getPlaylistIcon(pl, customIdx);
      if (!pl.isFree) customIdx++;

      const exerciseCount = pl.exercises.length;
      const estMinutes = pl.repsPerExercise > 0
        ? Math.round((exerciseCount * pl.repsPerExercise * 4) / 60)
        : null;

      card.innerHTML = `
        <div class="pl-thumbnail">${thumbIcon}</div>
        <div class="pl-body">
          <div class="pl-name">${pl.name}</div>
          <div class="pl-meta">
            <span>${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}</span>
            ${estMinutes ? `<span class="pl-meta-dot"></span><span>~${estMinutes} min</span>` : ''}
            ${pl.isFree ? `<span class="pl-meta-dot"></span><span>Free mode</span>` : ''}
          </div>
          <div class="pl-card-footer">
            <button class="btn-start pl-start">${PLAY_SVG} Start Workout</button>
            <div class="pl-actions">
              ${!pl.isFree ? '<button class="btn-icon pl-edit" title="Edit">✏</button><button class="btn-icon pl-delete" title="Delete" style="color:var(--danger)">✕</button>' : ''}
            </div>
          </div>
        </div>
      `;

      // Start button
      card.querySelector('.pl-start').addEventListener('click', (e) => {
        e.stopPropagation();
        onStart(pl);
      });

      // Edit button
      const editBtn = card.querySelector('.pl-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onEdit(pl);
        });
      }

      // Delete button
      const deleteBtn = card.querySelector('.pl-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onDelete(pl);
        });
      }

      container.appendChild(card);
    }
  }

  return {
    getAll,
    getById,
    create,
    update,
    remove,
    renderList,
    FREE_WORKOUT
  };
})();
