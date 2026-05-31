import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Nav } from "./components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vexnor — Next.js Example",
  description: "Isomorphic SQL execution with Vexnor and Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-white text-gray-900 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
