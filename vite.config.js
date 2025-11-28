import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"), // Carpeta donde está React
  base: "./",
  build: {
    outDir: "../../dist",      // Carpeta donde se genera la build final
    emptyOutDir: true
  },
  plugins: [react()]
});
