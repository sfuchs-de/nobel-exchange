import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const rosterPath = fileURLToPath(
  new URL("./public/candidates.json", import.meta.url),
);
const virtualId = "\0virtual:nobel-roster";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "nobel-reviewed-roster",
      resolveId(id) {
        if (id === "virtual:nobel-roster") return virtualId;
      },
      load(id) {
        if (id !== virtualId) return;
        this.addWatchFile(rosterPath);
        return `export default ${JSON.stringify(JSON.parse(readFileSync(rosterPath, "utf8")))};`;
      },
      handleHotUpdate({ file, server }) {
        if (file !== rosterPath) return;
        const mod = server.moduleGraph.getModuleById(virtualId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
        return [];
      },
    },
  ],
  base: "/nobel-exchange/",
  server: { proxy: { "/api": { target: "http://127.0.0.1:8796", ws: true } } },
});
