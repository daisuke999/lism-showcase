import { defineConfig } from "astro/config";

// https://docs.astro.build/en/guides/configuring-astro/
export default defineConfig({
  vite: {
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
    ],
  },
});
