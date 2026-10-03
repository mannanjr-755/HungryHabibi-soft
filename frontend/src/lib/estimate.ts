/** Same defaults as the customer menu, so staff and guests see one estimate. */

export const PHASE_MINUTES = {
  AVAILABLE: 0,
  WAITING: 15,
  SEATED: 25,
  ORDERING: 20,
  PREPARING: 12,
  SERVING: 15,
  BILLING: 5,
} as const;

export const TURN_MINUTES = 25;

export type GuestPhase =
  | "AVAILABLE"
  | "WAITING"
  | "SEATED"
  | "ORDERING"
  | "PREPARING"
  | "SERVING"
  | "BILLING";

export function remainingMinutes(baseline: number, elapsedMinutes: number): number {
  if (baseline <= 0) return 0;
  return Math.max(1, Math.round(baseline - Math.max(0, elapsedMinutes)));
}

export function formatEstimate(minutes: number): string {
  if (minutes <= 0) return "Available now";
  return `~${minutes} min`;
}

export function tableRemainingMinutes(phase: GuestPhase, elapsedMinutes: number): number {
  return remainingMinutes(PHASE_MINUTES[phase], elapsedMinutes);
}

export function waitlistMinutes(tableRemaining: number, position: number): number {
  if (position <= 1 && tableRemaining <= 0) return 0;
  return tableRemaining + Math.max(0, position - 1) * TURN_MINUTES;
}
