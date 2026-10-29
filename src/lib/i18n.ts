export const copy = {
  en: {
    title: "Community Policing", report: "Report", emergency: "Emergency? Call 999 / 112",
    send: "Send report", waiting: "Waiting to send", location: "Use my location",
    chooseStation: "Choose nearest station if GPS fails", track: "Track a report",
    language: "English / Luganda", voice: "Record voice note", submitted: "Report received",
    addDetails: "Add a note", submitNote: "Send update", police: "Police feed",
  },
  lg: {
    title: "Community Policing", report: "Waayo alipoota", emergency: "Ekikangabwa? Kuba 999 / 112",
    send: "Weereza alipoota", waiting: "Erindirira omukutu", location: "Kozesa ekifo kyange",
    chooseStation: "Londa poliisi GPS bw'egaana", track: "Goberera alipoota",
    language: "Luganda / English", voice: "Wandiika eddoboozi", submitted: "Alipoota efuniddwa",
    addDetails: "Yongerako obubaka", submitNote: "Weereza obubaka", police: "Alipoota za poliisi",
  },
} as const;
export type Language = keyof typeof copy;
