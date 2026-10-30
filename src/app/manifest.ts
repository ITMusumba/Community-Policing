import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Name shown when the web app is installed ("Add to Home screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COMPOLI",
    short_name: "COMPOLI",
    description: "Community Policing — Keeping Ourselves and Our Communities Safe",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#102a43",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
