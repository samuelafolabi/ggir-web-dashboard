import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Geist, Geist_Mono } from "next/font/google";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

type Author = {
  name: string;
  role: string;
  email?: string;
  orcid?: string;
};

const authors: Author[] = [
  {
    name: "Vincent T van Hees",
    role: "Author & Maintainer",
    email: "v.vanhees@accelting.com",
  },
  {
    name: "Jairo H Migueles",
    role: "Author",
    email: "jairo@jhmigueles.com",
    orcid: "0000-0003-0366-6935",
  },
  {
    name: "Samuel T Afolabi",
    role: "Contributor",
    email: "samuelafolabimails@gmail.com",
    orcid: "0009-0002-7325-6405",
  },
  { name: "Severine Sabia", role: "Contributor" },
  { name: "Matthew R Patterson", role: "Contributor" },
  { name: "Zhou Fang", role: "Contributor" },
  { name: "Joe Heywood", role: "Contributor" },
  { name: "Joan Capdevila Pujol", role: "Contributor" },
  { name: "Lena Kushleyeva", role: "Contributor" },
  { name: "Mathilde Chen", role: "Contributor" },
  { name: "Manasa Yerramalla", role: "Contributor" },
  {
    name: "Patrick Bos",
    role: "Contributor",
    email: "egpbos@gmail.com",
    orcid: "0000-0002-6033-960X",
  },
  { name: "Taren Sanders", role: "Contributor" },
  { name: "Chenxuan Zhao", role: "Contributor" },
  {
    name: "Ian Meneghel Danilevicz",
    role: "Contributor",
    orcid: "0000-0003-4541-0524",
  },
  {
    name: "Victor Barreto Mesquita",
    role: "Contributor",
    email: "victormesquita40@hotmail.com",
  },
  { name: "Gaia Segantin", role: "Contributor" },
];

const funders = [
  "Medical Research Council UK",
  "Accelting",
  "French National Research Agency",
];

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function AuthorCard({ author }: { author: Author }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{author.name}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {author.role}
        </span>
      </div>
      {(author.email || author.orcid) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {author.email && <span>{author.email}</span>}
          {author.orcid && (
            <a
              href={`https://orcid.org/${author.orcid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ORCID
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="max-w-md">
            <h3 className="text-sm font-semibold">About GGIR</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              GGIR is an open-source R package for processing multi-day raw
              accelerometer data. It generates reports on physical activity,
              sleep, and circadian rhythm from wearable sensor output.
            </p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="link" className="mt-2 h-auto p-0 text-sm">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  View Authors & Contributors
                </Button>
              </DialogTrigger>
              <DialogContent
                className={`max-h-[80vh] overflow-y-auto ${geistMono.className} sm:max-w-lg`}
              >
                <DialogHeader>
                  <DialogTitle>GGIR Authors & Contributors</DialogTitle>
                  <DialogDescription className={geistMono.className}>
                    The people behind the GGIR R package.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  {authors.map((author) => (
                    <AuthorCard key={author.name} author={author} />
                  ))}
                </div>
                <div className="mt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Funders
                  </h4>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    {funders.map((funder) => (
                      <li key={funder}>{funder}</li>
                    ))}
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Resources</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://cran.r-project.org/web/packages/GGIR/vignettes/GGIR.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/wadpac/GGIR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://cran.r-project.org/package=GGIR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  CRAN Package
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          GGIR Web Dashboard &middot; Built to visualize GGIR output data
        </div>
      </div>
    </footer>
  );
}
