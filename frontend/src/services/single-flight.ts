/**
 * Runs at most one `task` at a time: a call made while one is running gets the
 * running one's promise instead of starting another.
 */
export function createSingleFlight() {
  let inFlight: Promise<void> | null = null;
  return {
    run(task: () => Promise<void>): Promise<void> {
      if (inFlight) return inFlight;
      inFlight = task().finally(() => { inFlight = null; });
      return inFlight;
    },
    get running(): boolean {
      return inFlight !== null;
    },
  };
}
