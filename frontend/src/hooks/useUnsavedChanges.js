import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

/** Shown when leaving a page (or closing the tab) with unsaved edits. */
export const UNSAVED_CHANGES_MESSAGE =
  'Are you sure to move out, as the data is not saved.';

/**
 * Block in-app navigation while `dirtyRef.current` is true.
 * Uses a ref so `markSaved()` can clear the guard synchronously before `navigate()`.
 */
function useNavigationGuard(dirtyRef, message = UNSAVED_CHANGES_MESSAGE) {
  // Stable function: reads the ref at navigation time (not a stale boolean).
  const shouldBlock = useCallback(() => Boolean(dirtyRef.current), [dirtyRef]);
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (!dirtyRef.current) {
      blocker.proceed();
      return;
    }
    const proceed = window.confirm(message);
    if (proceed) {
      // Timeout avoids a race on POP navigations (same as RR's usePrompt).
      setTimeout(blocker.proceed, 0);
    } else {
      blocker.reset();
    }
  }, [blocker, dirtyRef, message]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirtyRef.current) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [dirtyRef],
    ),
  );
}

/**
 * Block in-app navigation (sidebar, back button, links) and tab close/refresh
 * while `isDirty` is true.
 */
export function useUnsavedChanges(isDirty, message = UNSAVED_CHANGES_MESSAGE) {
  const dirtyRef = useRef(Boolean(isDirty));
  dirtyRef.current = Boolean(isDirty);
  useNavigationGuard(dirtyRef, message);
}

/** Confirm discard for modal close / custom leave handlers. */
export function confirmDiscardUnsaved(isDirty, message = UNSAVED_CHANGES_MESSAGE) {
  if (!isDirty) return true;
  return window.confirm(message);
}

function stableSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Compare the current draft value against a baseline set via `markSaved`.
 * Until the first `markSaved` (e.g. after load), the form is treated as clean.
 *
 * @param {unknown} currentValue - serializable draft (form, lines, etc.)
 * @returns {{ isDirty: boolean, markSaved: (value?: unknown) => void }}
 */
export function useDirtyTracker(currentValue) {
  const [baseline, setBaseline] = useState(null);
  const currentRef = useRef(currentValue);
  currentRef.current = currentValue;

  const snapshot = useMemo(() => stableSerialize(currentValue), [currentValue]);

  const markSaved = useCallback((value) => {
    const next = value === undefined ? currentRef.current : value;
    setBaseline(stableSerialize(next));
  }, []);

  const isDirty = baseline != null && snapshot !== baseline;

  return { isDirty, markSaved };
}

/**
 * Convenience: track dirty state and register the navigation guard.
 * Call `markSaved()` after initial load and after a successful save
 * (before any redirect) so leaving is not blocked.
 */
export function useUnsavedDraft(currentValue, message = UNSAVED_CHANGES_MESSAGE) {
  const [baseline, setBaseline] = useState(null);
  const currentRef = useRef(currentValue);
  currentRef.current = currentValue;
  const dirtyRef = useRef(false);

  const snapshot = useMemo(() => stableSerialize(currentValue), [currentValue]);
  const isDirty = baseline != null && snapshot !== baseline;

  // Keep ref aligned with React state for blocker + beforeunload.
  dirtyRef.current = isDirty;

  const markSaved = useCallback((value) => {
    const next = value === undefined ? currentRef.current : value;
    const serialized = stableSerialize(next);
    // Clear guard immediately so navigate() after save is not prompted.
    dirtyRef.current = false;
    setBaseline(serialized);
  }, []);

  useNavigationGuard(dirtyRef, message);

  return { isDirty, markSaved };
}

/**
 * Mark a baseline once loading finishes for the current entity id.
 * Re-baselines when `loadKey` changes, or when `ready` goes false→true again
 * (e.g. after a save that reloads the form).
 */
export function useMarkSavedWhenReady(markSaved, { ready, loadKey }) {
  const armedRef = useRef(false);

  useEffect(() => {
    armedRef.current = false;
  }, [loadKey]);

  useEffect(() => {
    if (!ready) {
      armedRef.current = false;
      return;
    }
    if (armedRef.current) return;
    armedRef.current = true;
    markSaved();
  }, [ready, markSaved, loadKey]);
}
