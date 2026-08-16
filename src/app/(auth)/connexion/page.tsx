import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Connexion",
  // Une page de connexion n'a rien à faire dans l'index : elle ne répond à
  // aucune intention de recherche et dilue le maillage interne.
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/connexion">) {
  if (await getCurrentUser()) {
    redirect("/");
  }

  const params = await searchParams;
  const raw = params.callbackUrl;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  // On n'accepte qu'un chemin interne : une URL absolue transformerait la
  // connexion en redirection ouverte vers un site tiers.
  const callbackUrl =
    candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";

  return (
    <>
      <h1 className="text-2xl font-black tracking-tight">Se connecter</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Pour suivre vos ménages, vos factures et votre intervenant attitré.
      </p>

      <SignInForm callbackUrl={callbackUrl} />
    </>
  );
}
