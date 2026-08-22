import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FOURNISSEURS_ACTIFS } from "@/lib/auth/fournisseurs";
import { MESSAGE_ECHEC } from "@/lib/auth/identifiants";
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
  const params = await searchParams;
  const raw = params.callbackUrl;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  // On n'accepte qu'un chemin interne : une URL absolue transformerait la
  // connexion en redirection ouverte vers un site tiers.
  const callbackUrl =
    candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";

  /*
   * **Déjà connecté : on va où la personne allait, pas à l'accueil.**
   *
   * La destination était lue *après* cette redirection, si bien que quiconque
   * avait déjà une session et cliquait « Se connecter » atterrissait sur la
   * page d'accueil — en ayant demandé son espace. Le cas est le plus fréquent
   * qui soit : les deux portes de la vitrine et celle de la face pro visent
   * toutes `/connexion?callbackUrl=…`, précisément pour qu'une seule adresse
   * serve le visiteur connecté comme l'autre.
   */
  if (await getCurrentUser()) {
    redirect(callbackUrl);
  }

  /*
   * Auth.js redirige ici avec `?error=CredentialsSignin` quand la connexion est
   * postée hors de notre formulaire — par un gestionnaire de mots de passe qui
   * soumet directement, par exemple. Sans ce rappel, la personne reverrait le
   * formulaire vide et croirait que rien ne s'est passé.
   */
  const echecIdentifiants = params.error === "CredentialsSignin";

  /* La face d'où l'on vient, lue sur la destination demandée. */
  const versLEspacePro =
    callbackUrl === "/intervenant" || callbackUrl.startsWith("/intervenant/");

  return (
    <>
      {/*
        **Une seule page, deux contextes.** L'écran est le même — mêmes
        fournisseurs, même entonnoir, mêmes règles — mais quelqu'un qui vient de
        la face professionnelle doit se reconnaître : arriver sur « pour suivre
        vos ménages » après avoir cliqué « J'ai déjà un compte » depuis l'espace
        pro fait croire qu'on s'est trompé de porte.

        Le contexte se déduit de la destination et de rien d'autre : un
        paramètre supplémentaire serait une seconde vérité à tenir d'accord avec
        la première.
      */}
      <h1 className="text-2xl font-black tracking-tight">
        {versLEspacePro ? "Espace professionnel" : "Se connecter"}
      </h1>
      <p className="mt-2 mb-6 text-sm text-pretty text-muted-foreground">
        {versLEspacePro
          ? "Vos missions, vos disponibilités, vos revenus et votre dossier."
          : "Pour suivre vos ménages, vos factures et votre intervenant attitré."}
      </p>

      {echecIdentifiants ? (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          {MESSAGE_ECHEC}
        </p>
      ) : null}

      <SignInForm
        callbackUrl={callbackUrl}
        fournisseurs={FOURNISSEURS_ACTIFS}
      />
    </>
  );
}
