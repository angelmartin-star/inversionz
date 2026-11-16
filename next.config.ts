import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind CSS v4 vía loader de Turbopack
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // React-PDF se ejecuta tal cual en Node (no se empaqueta)
  serverExternalPackages: ["@react-pdf/renderer"],
  // Las fuentes del PDF se leen del disco: incluirlas en la función serverless de Vercel
  outputFileTracingIncludes: { "/api/report": ["./src/assets/fonts/**", "./src/assets/brand/**"] },
  // Portadas y textos del blog de BM: legibles desde el panel de Witei para subirlos
  async headers() {
    return [{ source: "/blog/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
