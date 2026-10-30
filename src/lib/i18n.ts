export const copy = {
  en: {
    title: "Community Policing", report: "Report", emergency: "Emergency? Call 999 / 112",
    send: "Send report", waiting: "Waiting to send", location: "Use my location",
    chooseStation: "Choose nearest station if GPS fails", track: "Track a report",
    language: "English / Luganda", voice: "Record voice note", submitted: "Report received",
    addDetails: "Add a note", submitNote: "Send update", police: "Police feed",
    photoHint: "Photo or video", photo: "Photo", video: "Video", gallery: "Choose from gallery", noPhoto: "No photo? Continue", whatHappened: "What happened?", skip: "Skip",
    describe: "Tell us what happened", stopRecording: "Stop recording", voiceReady: "Voice note recorded", reRecord: "Record again",
    typeHere: "Or type here", gpsOk: "Location captured", gpsFailed: "Location unavailable", gpsWaiting: "Finding your location…",
    unsupportedWarn: "Choose a picture and record or type what happened. Without them your report will be marked Unsupported.",
    anonNote: "Your name is never needed. This app does not replace emergency services.",
  },
  lg: {
    title: "Community Policing", report: "Waayo alipoota", emergency: "Ekikangabwa? Kuba 999 / 112",
    send: "Weereza alipoota", waiting: "Erindirira omukutu", location: "Kozesa ekifo kyange",
    chooseStation: "Londa poliisi GPS bw'egaana", track: "Goberera alipoota",
    language: "Luganda / English", voice: "Wandiika eddoboozi", submitted: "Alipoota efuniddwa",
    addDetails: "Yongerako obubaka", submitNote: "Weereza obubaka", police: "Alipoota za poliisi",
    // TODO(translation): native-speaker Luganda needed for the keys below; English placeholders.
    photoHint: "Photo or video", photo: "Photo", video: "Video", gallery: "Choose from gallery", noPhoto: "No photo? Continue", whatHappened: "What happened?", skip: "Skip",
    describe: "Tell us what happened", stopRecording: "Stop recording", voiceReady: "Voice note recorded", reRecord: "Record again",
    typeHere: "Or type here", gpsOk: "Location captured", gpsFailed: "Location unavailable", gpsWaiting: "Finding your location…",
    unsupportedWarn: "Choose a picture and record or type what happened. Without them your report will be marked Unsupported.",
    anonNote: "Your name is never needed. This app does not replace emergency services.",
  },
} as const;
export type Language = keyof typeof copy;
