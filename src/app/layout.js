import "./globals.css";
import "./public.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

// Self-hosted by next/font: no remote @import, no render-blocking request.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata = {
  title: "Smart Cemetery — Navigation & Monitoring Platform",
  description:
    "Digitalizing burial records with interactive navigation, smart search, and real-time monitoring for Bolonsori Public Cemetery.",
  keywords: ["cemetery", "navigation", "burial records", "smart cemetery", "Bolonsori"],
  authors: [{ name: "Smart Cemetery Team" }],
};

const themeInitializer = `
  (function () {
    try {
      var stored = localStorage.getItem("theme");
      var systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      var theme = stored === "light" || stored === "dark"
        ? stored
        : (systemLight ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.style.colorScheme = theme;
    } catch (error) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          theme="system"
          closeButton
          expand
          gap={12}
          visibleToasts={3}
          duration={4000}
          offset={{ top: 24, right: 24 }}
          mobileOffset={{ top: 16, right: 16, left: 16 }}
          toastOptions={{
            style: {
              borderRadius: "12px",
              width: "auto",
              minWidth: "fit-content",
              background: "var(--bg-surface)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              boxShadow: "var(--shadow-lg)",
              padding: "14px 18px",
            },
            classNames: {
              error: "toast-error-matched",
            },
          }}
          containerAriaLabel="Notifications"
        />
      </body>
    </html>
  );
}
