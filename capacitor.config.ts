import type { CapacitorConfig } from "@capacitor/cli";

// CAP_SERVER_URL (e.g. https://community-policing-nine.vercel.app) makes the Android app load the live site,
// so every web deploy reaches the app without a new APK. Leave it unset to bundle the static export from out/.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "ug.communitypolicing.app",
  appName: "COMPOLI",
  webDir: "out",
  server: {
    androidScheme: "https",
    ...(serverUrl ? { url: serverUrl, cleartext: false } : {}),
  },
};

export default config;
