// Save and best records in localStorage, guarded so a private window or a
// missing store never breaks the game.
const KEY = 'solmar-city-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      mission: typeof data.mission === 'number' ? data.mission : 0,
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : 0,
      missionsDone: typeof data.missionsDone === 'number' ? data.missionsDone : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage is a nicety, never a crash.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
