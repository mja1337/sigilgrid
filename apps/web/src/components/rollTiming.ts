/**
 * Battle roll pacing, shared by the board pips and the resolve caption so the
 * numbers stop spinning at the same instant the verdict appears.
 */
export const ROLL_SPIN_MS = 770;

/** Held beat between the roll settling and the result landing. Suspense. */
export const ROLL_SUSPENSE_MS = 200;

export const ROLL_SETTLE_MS = ROLL_SPIN_MS + ROLL_SUSPENSE_MS;
