/** Only the exact reviewed additive release may migrate a frozen roster. */
export type RosterIdentity = { id: string; name: string; eligible: boolean };
export type RosterExtension = {
  fromVersion: string; toVersion: string; fromCount: number;
  approvedOn: string; reason: string; additions: RosterIdentity[];
};
export function rosterIdentity(candidates: RosterIdentity[]) {
  return JSON.stringify(candidates.map(({id,name,eligible}) => ({id,name,eligible}))
    .sort((a,b) => a.id.localeCompare(b.id)));
}
export function planRosterExtension(frozen: string, current: RosterIdentity[], version: string, approval: RosterExtension) {
  if (!frozen || frozen === rosterIdentity(current) || version !== approval.toVersion) return null;
  const addedIds = new Set(approval.additions.map(c => c.id));
  if (!approval.reason || approval.reason.length < 20 || addedIds.size !== approval.additions.length ||
      new Set(current.map(c=>c.id)).size !== current.length || current.length !== approval.fromCount + addedIds.size) return null;
  const original = current.filter(c=>!addedIds.has(c.id));
  if (original.length !== approval.fromCount || rosterIdentity(original) !== frozen) return null;
  const fresh = current.filter(c=>addedIds.has(c.id));
  if (fresh.some(c=>!c.eligible) || rosterIdentity(fresh) !== rosterIdentity(approval.additions)) return null;
  return {version:approval.toVersion, approvedOn:approval.approvedOn, reason:approval.reason,
    additions:approval.additions.map(({id,name})=>({id,name}))};
}
