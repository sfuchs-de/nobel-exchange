import type { Snapshot } from "./types";

export type SaveState = {
  busy: boolean;
  closed: boolean;
  loaded: boolean;
  phase: Snapshot["phase"];
  total: number;
  picks: number;
  signedIn: boolean;
  displayName: string;
  dirty: boolean;
};

/** Explain the same constraints enforced by the save control; never adjust picks. */
export function portfolioSaveState(s: SaveState) {
  const blocked = (message: string) => ({ disabled: true, message });
  if (s.busy) return blocked("Saving your portfolio…");
  if (s.closed) return blocked("The market is closed. Your final portfolio is locked.");
  if (!s.loaded) return blocked("Waiting for the latest market state before saving.");
  if (s.phase !== "open") return blocked(s.phase === "paused"
    ? "Saving is temporarily paused by the administrator."
    : "Saving becomes available when the market opens.");
  if (s.picks < 1) return blocked("Choose 1–10 economists, then allocate all 100 credits.");
  if (s.picks > 10) return blocked("Keep at most 10 economists in your portfolio.");
  if (s.total < 100) {
    const n = 100 - s.total;
    return blocked(`Allocate ${n} more ${n === 1 ? "credit" : "credits"} to enable saving. Use “Split evenly” for a quick 100-credit portfolio.`);
  }
  if (s.total > 100) {
    const n = s.total - 100;
    return blocked(`Remove ${n} ${n === 1 ? "credit" : "credits"} to bring your total to 100.`);
  }
  if (s.signedIn && s.displayName.trim().length < 2)
    return blocked("Enter a public display name with at least two characters.");
  if (s.signedIn && !s.dirty) return blocked("Your saved portfolio is up to date.");
  return { disabled: false, message: s.signedIn
    ? "Ready to save. Your picks count only after you press Save portfolio."
    : "Ready. Quick join or sign in with Google to save these picks." };
}
