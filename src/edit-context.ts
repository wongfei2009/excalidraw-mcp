import type { App } from "@modelcontextprotocol/ext-apps";
import { captureContextPng } from "./share-export";

const DEBOUNCE_MS = 2000;
let timer: ReturnType<typeof setTimeout> | null = null;
let initialSnapshot: string | null = null;
let initialElementsById: Map<string, any> = new Map();
let storageKey: string | null = null;
let checkpointId: string | null = null;

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
export function setCheckpointId(id: string) {
  checkpointId = id;
}

/**
 * Reset transient edit session state when switching diagrams/checkpoints.
 */
export function resetEditSession() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  initialSnapshot = null;
  initialElementsById = new Map();
  latestEditedElements = null;
}

/**
 * Call once after final render to capture the baseline element state.
 * This replaces the old resetInitialSnapshot — it also stores a per-element
 * map so we can compute a human-readable diff later.
 */
export function captureInitialElements(elements: readonly any[]) {
  initialSnapshot = JSON.stringify(elements.map((el: any) => el.id + ":" + (el.version ?? 0)));
  initialElementsById = new Map(elements.map((el: any) => [el.id, el]));
}

/** Compute a compact diff between initial and current elements. */
function computeDiff(current: any[]): string {
  const added: string[] = [];
  const removed: string[] = [];
  const moved: string[] = [];
  const modified: string[] = [];
  const currentIds = new Set<string>();

  /** Properties to check for style/content changes (beyond position/size). */
  const STYLE_KEYS = [
    "strokeColor", "backgroundColor", "strokeStyle", "strokeWidth",
    "opacity", "fontSize", "text", "fillStyle", "roundness", "fontFamily",
  ] as const;

  for (const el of current) {
    currentIds.add(el.id);
    const orig = initialElementsById.get(el.id);
    if (!orig) {
      // New element — include type, position, and text if any
      const desc = `${el.type} "${el.text ?? el.label?.text ?? ""}" at (${Math.round(el.x)},${Math.round(el.y)})`;
      added.push(desc);
    } else {
      // Check position/size changes
      if (Math.round(orig.x) !== Math.round(el.x) || Math.round(orig.y) !== Math.round(el.y) ||
        Math.round(orig.width) !== Math.round(el.width) || Math.round(orig.height) !== Math.round(el.height)) {
        moved.push(`${el.id} → (${Math.round(el.x)},${Math.round(el.y)}) ${Math.round(el.width)}x${Math.round(el.height)}`);
      }
      // Check style/content property changes — include actual new values
      const details: string[] = [];
      for (const key of STYLE_KEYS) {
        if (JSON.stringify(orig[key]) !== JSON.stringify(el[key])) {
          const newVal = el[key];
          const valStr = typeof newVal === "string" ? `"${newVal}"` : JSON.stringify(newVal);
          details.push(`${key}=${valStr}`);
        }
      }
      // Also check label text changes
      if (JSON.stringify(orig.label) !== JSON.stringify(el.label)) {
        const newText = el.label?.text ?? "";
        details.push(`label="${newText}"`);
      }
      if (details.length > 0) {
        modified.push(`${el.id}: ${details.join(", ")}`);
      }
    }
  }

  for (const id of initialElementsById.keys()) {
    if (!currentIds.has(id)) removed.push(id);
  }

  const parts: string[] = [];
  if (added.length) parts.push(`Added: ${added.join("; ")}`);
  if (removed.length) parts.push(`Removed: ${removed.join(", ")}`);
  if (moved.length) parts.push(`Moved/resized: ${moved.join("; ")}`);
  if (modified.length) parts.push(`Modified: ${modified.join("; ")}`);
  if (!parts.length) return "";
  const cpRef = checkpointId ? ` (checkpoint: ${checkpointId})` : "";
  return `User edited diagram${cpRef}. ${parts.join(". ")}`;
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
 * Excalidraw onChange handler. Persists to localStorage and sends updated
 * elements + PNG + diff to model context — only when user actually changed
 * something (debounced). Does NOT call setState to avoid infinite re-render loops.
 */
export function onEditorChange(app: App, elements: readonly any[]) {
  const currentSnapshot = JSON.stringify(elements.map((el: any) => el.id + ":" + (el.version ?? 0)));
  if (currentSnapshot === initialSnapshot) return;

  const live = [...elements].filter((el: any) => !el.isDeleted);
  latestEditedElements = live;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(live));
      } catch { }
    }
    if (checkpointId) {
      app.callServerTool({
        name: "save_checkpoint",
        arguments: { id: checkpointId, data: JSON.stringify({ elements: live }) },
      }).catch(() => { });
    }
    // Compute diff and include it alongside the PNG in model context
    const diff = computeDiff(live);
    captureContextPng(app, live, checkpointId, diff || undefined).catch(() => { });
  }, DEBOUNCE_MS);
}
