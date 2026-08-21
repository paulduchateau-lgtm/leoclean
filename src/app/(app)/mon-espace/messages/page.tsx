import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EspaceFerme } from "@/components/espace-ferme";
import { SiteHeader } from "@/components/site-header";
import { espaceClient } from "@/lib/auth/espaces";
import { lireLesFilsDuClient } from "@/lib/messagerie/client";

/**
 * Les fils de messages du client.
 *
 * **Le client écrivait déjà, sans avoir où retrouver ses fils.** Le panneau
 * s'ouvre depuis chaque intervention ; répondre supposait donc de se rappeler à
 * quelle réservation on avait écrit. Cet index est le symétrique de celui de
 * l'intervenant, et il porte la même règle : un fil par intervention, jamais
 * par personne.
 *
 * Le fil lui-même reste dans le panneau de l'intervention : le dupliquer ici
 * donnerait deux endroits où écrire le même message, et c'est l'un des deux
 * qu'on finirait par oublier de tenir à jour.
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

export default async function MessagesClientPage() {
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-espace/messages");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-espace", libelle: "Mes sessions" }}
      />
    );
  }

  const { db, user, profil } = espace;
  const fils = await lireLesFilsDuClient(db, profil.id, user.id);

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-heading text-3xl font-black tracking-tight">
          Mes messages
        </h1>

        {fils.length === 0 ? (
          <p className="mt-6 rounded-[var(--r-l)] border border-border bg-secondary/40 p-6 text-muted-foreground">
            Aucun message pour l&apos;instant. Vous pouvez écrire à votre
            intervenant depuis chaque intervention à venir, dès qu&apos;elle est
            confirmée.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border">
            {fils.map((fil) => (
              <li key={fil.conversationId}>
                <Link
                  href={`/mon-espace/messages/${fil.conversationId}`}
                  className="flex gap-3 py-4"
                >
                  {/* La pastille des non-lus : l'ananas est ici une pastille,
                      pas du texte — le seul emploi qui lui va sur blanc. */}
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                      fil.nonLus > 0 ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span
                        className={fil.nonLus > 0 ? "font-bold" : "font-medium"}
                      >
                        {fil.interlocuteur ?? "Votre intervenant"}
                        {fil.commune ? ` · ${fil.commune}` : ""}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {fil.dernierLe
                          ? JOUR.format(new Date(fil.dernierLe))
                          : ""}
                      </span>
                    </span>
                    {fil.dernierMessage ? (
                      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                        {fil.dernierMessage}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
