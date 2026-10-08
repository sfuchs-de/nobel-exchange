/// <reference types="vite/client" />
declare module "virtual:nobel-roster" {
  const roster: typeof import("../public/candidates.json");
  export default roster;
}
