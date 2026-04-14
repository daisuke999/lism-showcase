import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// https://docs.astro.build/en/guides/configuring-astro/
export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    ssr: {
      noExternal: ["lism-css", "@lism-css/ui"],
    },
  },
  image: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.lism-css.com",
        pathname: "/**",
      },
    ],
  },
});
