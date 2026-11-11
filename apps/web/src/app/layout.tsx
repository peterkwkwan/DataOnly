import type { Metadata } from "next";
import { SiteChrome } from "@/components/site-chrome";
import { AuthProvider } from "@/context/auth-context";
import { SavedProvider } from "@/context/saved-context";
import "@/styles/dataonly.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DataOnly — Expert data marketplace",
    template: "%s · DataOnly",
  },
  description:
    "Discover unique, expert-curated datasets from verified creators across every industry.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SavedProvider>
            <SiteChrome>{children}</SiteChrome>
          </SavedProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
