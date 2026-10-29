/** An invader back to Good after being Destroyed / Not visible (mirror of the backend ReactivationOut). */
export type Reactivation = {
  invader_id: number;
  date: string; // ISO, naive UTC from the backend
};

/** How long a reactivated invader keeps the "Reactivated" state color (backend REACTIVATION_WINDOW_DAYS). */
export const REACTIVATED_DAYS = 60;
