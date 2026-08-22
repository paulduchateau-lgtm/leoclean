"use client";

import { seConnecterAvec } from "@/app/(auth)/actions";
import type { Fournisseur } from "@/lib/auth/fournisseurs";

/**
 * Les fournisseurs sociaux réellement configurés.
 *
 * **Extrait pour servir deux parcours, pas un.** La connexion les proposait ;
 * l'inscription d'un intervenant, non — un candidat n'avait que le lien
 * magique, donc un aller-retour par sa boîte mail avant même d'avoir commencé.
 * Recopier le bloc aurait donné deux listes qui divergent le jour où un
 * fournisseur s'ajoute.
 *
 * La liste est vide quand rien n'est configuré, et le composant ne rend alors
 * rien : l'écran n'affiche jamais un bouton qui mène à une erreur.
 *
 * **Composant client**, et il le faut : le formulaire de connexion en est un,
 * et un composant serveur ne s'y imbrique pas. `seConnecterAvec` reste une
 * server action — l'appeler depuis le client est précisément ce qu'une server
 * action autorise, et c'est ce que faisait déjà l'écran de connexion.
 */
export function BoutonsSociaux({
  fournisseurs,
  callbackUrl,
  separateur = true,
}: {
  fournisseurs: readonly Fournisseur[];
  callbackUrl: string;
  /** Le « ou » qui sépare des autres chemins. Inutile quand il n'y en a pas. */
  separateur?: boolean;
}) {
  if (fournisseurs.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        {fournisseurs.map((fournisseur) => (
          <form
            key={fournisseur.id}
            action={async () => {
              await seConnecterAvec(fournisseur.id, callbackUrl);
            }}
          >
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-5 font-bold transition-colors hover:border-teal-300 hover:bg-teal-50"
            >
              Continuer avec {fournisseur.nom}
            </button>
          </form>
        ))}
      </div>

      {separateur ? (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-sm text-muted-foreground">ou</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
      ) : null}
    </>
  );
}
