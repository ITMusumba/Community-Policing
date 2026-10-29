import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ug.communitypolicing.app",
  appName: "Community Policing",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
