import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        quiz: resolve(__dirname, "quiz.html"),
        germany: resolve(__dirname, "germany.html"),
        france: resolve(__dirname, "france.html"),
      },
    },
  },
});
