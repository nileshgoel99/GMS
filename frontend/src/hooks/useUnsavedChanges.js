import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unstable_usePrompt as usePrompt, useBeforeUnload } from 'react-router-dom';

/** Shown when leaving a page (or closing the tab) with unsaved edits. */
export const UNSAVED_CHANGES_MESSAGE =
  'Are you sure to move out, as the data is not saved.';

/**
 * Block in-app navigation (sidebar, back button, links) and tab close/refresh
 * while `isDirty` is true.
 */
export function useUnsavedChanges(isDirty, message = UNSAVED_CHANGES_MESSAGE) {
  const dirty = Boolean(isDirty);

  usePrompt({ when: dirty, message });

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [dirty],
    ),
  );
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
  const { isDirty, markSaved } = useDirtyTracker(currentValue);
  useUnsavedChanges(isDirty, message);
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
