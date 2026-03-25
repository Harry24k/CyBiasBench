import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "CyBiasBench: Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios",
  description:
    "A benchmark comparing attack technique preferences, success rates, and behavioral patterns across Claude, Codex, and Gemini in controlled cyber-attack scenarios. 3 agents, 3 targets, 4 conditions, 3 runs, 108 experiments.",
  openGraph: {
    title: "CyBiasBench",
    description: "Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
