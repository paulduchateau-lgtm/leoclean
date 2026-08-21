import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EspaceFerme } from "@/components/espace-ferme";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { lireLesFils } from "@/lib/messagerie/intervenant";
import { IntervenantAvatar } from "@/components/intervenant-avatar";
import { SITE } from "@/lib/site";

/**
 * Mes messages.
 *
 * **Les fils non lus passent devant**, puis les plus récents. Une intervention
 * sans message n'apparaît pas : la liste sert à répondre, pas à recenser — un
 * écran qui liste tout ce qui pourrait recevoir un message est un écran qu'on
 * n'ouvre plus au bout d'une semaine.
 */

export const metadata: Metadata = {
  title: "Mes messages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

export default async function MessagesPage() {
  /*
   * `espaceIntervenant` traduit l'absence d'appartenance en résultat
   * plutôt qu'en exception : `requireOrganization` lève, et l'exception
   * remontait jusqu'au rendu — une erreur 500 sur un état parfaitement
   * ordinaire du produit.
   */
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant/messages");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const { db, user, profil } = espace;

  const fils = profil ? await lireLesFils(db, profil.id, user.id) : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/intervenant" className="text-brand hover:underline">
          ← Mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
        Mes messages
      </h1>

      {fils.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
          Aucun message. Vos clients peuvent vous écrire depuis leur espace, sur
          chaque intervention. Pour une urgence, ils appellent le {SITE.phone}.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {fils.map((fil) => (
            <li key={fil.conversationId}>
              <Link
                href={`/intervenant/messages/${fil.conversationId}`}
                className="flex gap-3 py-4"
              >
                <span className="relative shrink-0">
                  <IntervenantAvatar
                    nom={fil.interlocuteur ?? "Client"}
                    photoUrl={fil.photoUrl}
                    taille={44}
                  />
                  {fil.nonLus > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background bg-primary"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span
                      className={fil.nonLus > 0 ? "font-bold" : "font-medium"}
                    >
                      {fil.interlocuteur ?? "Client"}
                      {fil.commune ? ` · ${fil.commune}` : ""}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {fil.dernierLe
                        ? JOUR.format(new Date(fil.dernierLe))
                        : ""}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {fil.dernierMessage}
                  </span>
                  {/* La dernière intervention situe le fil sans prétendre
                      qu'il s'arrête avec elle : le fil suit la personne. */}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {fil.quand
                      ? `Dernière intervention le ${JOUR.format(new Date(fil.quand))}`
                      : "Aucune intervention rattachée"}
                    {fil.nonLus > 0
                      ? ` · ${fil.nonLus} non lu${fil.nonLus > 1 ? "s" : ""}`
                      : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
