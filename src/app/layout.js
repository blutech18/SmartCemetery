import "./globals.css";
import "./public.css";

export const metadata = {
  title: "Smart Cemetery — Navigation & Monitoring Platform",
  description:
    "Digitalizing burial records with interactive navigation, smart search, and real-time monitoring for Bolonsori Public Cemetery.",
  keywords: ["cemetery", "navigation", "burial records", "smart cemetery", "Bolonsori"],
  authors: [{ name: "Smart Cemetery Team" }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
