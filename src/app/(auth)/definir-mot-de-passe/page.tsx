import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormulaireMotDePasse } from "@/app/(auth)/definir-mot-de-passe/formulaire";
import { lireLetatDeConnexion } from "@/lib/auth/identifiants";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Le premier mot de passe, après un lien magique.
 *
 * **C'est le seul moment où le dépôt autorise à en définir un** : la personne
 * vient de prouver qu'elle reçoit les emails de son adresse. Le lui proposer
 * plus tard, dans un écran de réglages, revient à ne jamais le lui proposer —
 * et à lui faire refaire un aller-retour par sa messagerie à chaque connexion.
 *
 * **L'écran s'efface pour qui en a déjà un.** Le proposer à nouveau ferait
 * croire qu'il a été perdu, et le seul chemin pour le changer exige l'ancien —
 * ce que cette page ne demande pas.
 */

export const metadata: Metadata = {
  title: "Votre mot de passe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DefinirMotDePassePage({
  searchParams,
}: PageProps<"/definir-mot-de-passe">) {
  const params = await searchParams;
  const brut = params.suite;
  const candidat = Array.isArray(brut) ? brut[0] : brut;

  /*
   * On n'accepte qu'un chemin interne, exactement comme la page de connexion :
   * une URL absolue transformerait ce détour en redirection ouverte vers un
   * site tiers.
   */
  const suite =
    candidat?.startsWith("/") && !candidat.startsWith("//") ? candidat : "/";

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(suite)}`);
  }

  const etat = await lireLetatDeConnexion(user.id);
  if (etat.aUnMotDePasse) redirect(suite);

  return (
    <>
      <h1 className="text-2xl font-black tracking-tight">
        Choisissez un mot de passe
      </h1>
      <p className="mt-2 mb-6 text-sm text-pretty text-muted-foreground">
        Vous êtes connecté. Un mot de passe vous évitera de repasser par votre
        messagerie à chaque fois — mais rien ne vous y oblige : le lien
        continuera de fonctionner.
      </p>

      <FormulaireMotDePasse suite={suite} />
    </>
  );
}
