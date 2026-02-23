const DEBOUNCE_MS = 2000;
let timer: ReturnType<typeof setTimeout> | null = null;
let initialSnapshot: string | null = null;
let storageKey: string | null = null;

/**
 * Set the localStorage key for this widget instance (use viewUUID or tool-call-derived ID).
 */
export function setStorageKey(key: string) {
  storageKey = `excalidraw:${key}`;
}

/**
 * Set the checkpoint key for saving state snapshots.
 * Called when ontoolresult delivers the checkpointId from the server.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setCheckpointId(_id: string) {
  // kept for API compatibility — checkpointId is now managed via onContextUpdate callback
}

/**
 * Reset the initial snapshot so the next onChange call re-initializes it.
 * Call after a new LLM render to avoid treating restored state as "changed".
 */
export function resetInitialSnapshot() {
  initialSnapshot = null;
}

/**
 * Load persisted elements from localStorage (if any).
 */
export function loadPersistedElements(): any[] | null {
  if (!storageKey) return null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/** Latest edited elements (kept in sync without triggering React re-renders). */
let latestEditedElements: any[] | null = null;

/**
 * Get the latest user-edited elements (or null if no edits were made).
 * Call this when exiting fullscreen to sync edits back to React state.
 */
export function getLatestEditedElements(): any[] | null {
  return latestEditedElements;
}

/**
 * Excalidraw onChange handler. Persists to localStorage and invokes onContextUpdate
 * with the live elements — only when user actually changed something (debounced).
 * Does NOT call setState to avoid infinite re-render loops.
 */
export function onEditorChange(
  elements: readonly any[],
  onContextUpdate: (elements: any[]) => Promise<void>,
) {
  const currentSnapshot = JSON.stringify(elements.map((el: any) => el.id + ":" + (el.version ?? 0)));

  // Lazy-initialize snapshot on first call (after reset or first mount)
  if (initialSnapshot === null) {
    initialSnapshot = currentSnapshot;
    return;
  }

  if (currentSnapshot === initialSnapshot) return;

  const live = [...elements].filter((el: any) => !el.isDeleted);
  latestEditedElements = live;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(live));
      } catch {}
    }
    onContextUpdate(live).catch(() => {});
  }, DEBOUNCE_MS);
}
