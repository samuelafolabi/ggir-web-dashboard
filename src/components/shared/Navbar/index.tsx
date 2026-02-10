import Image from "next/image";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/images/GGIR-MASTERLOGO-RGB.png";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto">
        <div className="flex items-center gap-2">
          <Image
            src={logo}
            alt="GGIR Logo"
            height={36}
            priority
          />
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
