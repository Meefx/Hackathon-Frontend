import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollectFlow | Collections workspace",
  description: "A focused workspace for managing lending collections and overdue accounts.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
