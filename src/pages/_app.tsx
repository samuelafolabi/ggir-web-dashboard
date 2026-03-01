import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/components/theme-provider";
import { DataProvider } from "@/context/DataContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DataProvider>
        <Component {...pageProps} />
      </DataProvider>
    </ThemeProvider>
  );
}
