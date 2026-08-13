import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Returns a callback with a stable identity across renders that always
 * invokes the latest version of `fn`. Use this for handlers you pass down
 * as props so children (and effects) don't re-run just because the parent
 * re-rendered with a new inline arrow.
 *
 * Contract:
 * - Identity: stable for the lifetime of the component.
 * - Freshness: always calls the most recently rendered `fn` (closes over
 *   latest props/state), updated in a layout effect so it's ready before
 *   any child effects fire in the same commit.
 * - Do NOT call during render — only from events/effects.
 */
export function useStableCallback<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
