import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Connexion impossible",
  robots: { index: false, follow: false },
};

/**
 * Les libellés d'erreur d'Auth.js sont techniques et anglophones. On les
 * traduit en explications actionnables : dans la quasi-totalité des cas, un
 * lien de connexion a simplement expiré ou déjà été utilisé.
 */
const MESSAGES: Record<string, string> = {
  Verification:
    "Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau, c'est immédiat.",
  AccessDenied:
    "L'accès a été refusé. Si vous pensez qu'il s'agit d'une erreur, écrivez-nous.",
  Configuration:
    "La connexion est momentanément indisponible de notre côté. Nous en sommes informés.",
};

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/connexion/erreur">) {
  const params = await searchParams;
  const raw = params.error;
  const code = Array.isArray(raw) ? raw[0] : raw;

  const message =
    (code && MESSAGES[code]) ??
    "La connexion n'a pas pu aboutir. Demandez un nouveau lien.";

  return (
    <div className="text-center">
      <TriangleAlertIcon
        className="mx-auto mb-4 size-9 text-warning"
        aria-hidden
      />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Connexion impossible
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>

      <Link href="/connexion" className={cn(buttonVariants(), "mt-6 w-full")}>
        Demander un nouveau lien
      </Link>

      <p className="mt-4 text-sm text-muted-foreground">
        Un problème persistant ? Écrivez-nous à{" "}
        <a href={`mailto:${SITE.email}`} className="text-primary underline">
          {SITE.email}
        </a>
        .
      </p>
    </div>
  );
}
