import type { Metadata, Viewport } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import InstallApp from "@/components/InstallApp";
import "./globals.css";

export const metadata: Metadata = {
  title: "COMPOLI · Community Policing",
  description:
    "A mobile-first community safety platform for reporting incidents and following up securely.",
  applicationName: "COMPOLI",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "COMPOLI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102a43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <footer className="bg-slate-50 px-4 pb-6 pt-2 text-center text-xs text-slate-500">
          <p className="font-semibold uppercase tracking-wider">Community Policing</p>
          <p className="mt-0.5">Keeping Ourselves and Our Communities Safe</p>
        </footer>
        <InstallApp />
      </body>
    </html>
  );
}
