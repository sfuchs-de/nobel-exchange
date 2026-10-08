import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { rosterIdentity, planRosterExtension } from "../shared/roster-extension";
const roster = JSON.parse(fs.readFileSync("public/candidates.json","utf8"));
const approval = JSON.parse(fs.readFileSync("research/roster-extension-2026-10-08.json","utf8"));
const base = roster.candidates.filter((c:any)=>!approval.additions.some((a:any)=>a.id===c.id));
const frozen = rosterIdentity(base);
describe("explicit additive roster migration",()=>{
  it("matches exactly the preserved 99-person identities and three approved additions",()=>{
    const plan=planRosterExtension(frozen,roster.candidates,roster.version,approval)!;
    expect(base).toHaveLength(99);
    expect(plan.additions.map(c=>c.id)).toEqual(approval.additions.map((c:any)=>c.id));
    expect(plan.version).toBe("economics-2026.4");
  });
  it("is a no-op for an unopened or already migrated roster",()=>{
    expect(planRosterExtension("",roster.candidates,roster.version,approval)).toBeNull();
    expect(planRosterExtension(rosterIdentity(roster.candidates),roster.candidates,roster.version,approval)).toBeNull();
  });
  it.each(["name","eligible","id"])("refuses existing identity changes: %s",key=>{
    const changed=structuredClone(roster.candidates);
    changed[0][key]=key==="eligible"?false:"changed";
    expect(planRosterExtension(frozen,changed,roster.version,approval)).toBeNull();
  });
  it("refuses removals, extra candidates, duplicate IDs or unapproved addition identities",()=>{
    for(const changed of [roster.candidates.slice(1),[...roster.candidates,base[0]],roster.candidates.map((c:any)=>c.id==="costas-arkolakis"?{...c,name:"Someone else"}:c)])
      expect(planRosterExtension(frozen,changed,roster.version,approval)).toBeNull();
  });
  it("refuses a different release or frozen baseline",()=>{
    expect(planRosterExtension(frozen,roster.candidates,"economics-2026.5",approval)).toBeNull();
    expect(planRosterExtension(rosterIdentity(base.slice(1)),roster.candidates,roster.version,approval)).toBeNull();
  });
});
