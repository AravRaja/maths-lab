import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { ToastProvider } from "@/components/kit/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Lab kit",
  description: "Starter kit for monochrome maths demos. You write the core.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
