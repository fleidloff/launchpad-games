import { defineConfig } from "vite";

export default defineConfig({
  base: "/launchpad-games/",
  test: {
    environment: "jsdom",
    globals: true,
  },
});
