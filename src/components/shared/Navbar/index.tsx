import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/images/GGIR-MASTERLOGO-RGB.png";

const NAV_LINKS = [
  { href: "/", label: "Upload" },
  { href: "/visualization", label: "Dashboard" },
  { href: "/epoch-explorer", label: "Epoch Explorer" },
];

export function Navbar() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto">
        <div className="flex items-center gap-6">
          <Image
            src={logo}
            alt="GGIR Logo"
            height={36}
            priority
          />
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = router.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
