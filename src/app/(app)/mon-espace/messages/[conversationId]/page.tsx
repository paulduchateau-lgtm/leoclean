import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FilClient } from "@/app/(app)/mon-espace/messages/[conversationId]/fil";
import { EspaceFerme } from "@/components/espace-ferme";
import { IntervenantAvatar } from "@/components/intervenant-avatar";
import { SiteHeader } from "@/components/site-header";
import { espaceClient } from "@/lib/auth/espaces";
import { lireLeFilDuClient } from "@/lib/messagerie/client";

/**
 * Le fil avec un intervenant.
 *
 * **On y voit qui on a en face.** « Le même intervenant, chaque semaine » est
 * la promesse centrale du service : écrire à un identifiant la contredit. Le
 * prénom et la photo sont donc en tête — et à défaut de photo, les initiales,
 * qui est le cas courant puisque `photoUrl` est facultative et le restera.
 *
 * Le nom de famille n'est jamais publié, ici comme ailleurs.
 */

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FilClientPage({
  params,
}: PageProps<"/mon-espace/messages/[conversationId]">) {
  const { conversationId } = await params;
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect(`/connexion?callbackUrl=/mon-espace/messages/${conversationId}`);
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-espace/messages", libelle: "Mes messages" }}
      />
    );
  }

  const fil = await lireLeFilDuClient(
    espace.db,
    espace.profil.id,
    espace.user.id,
    conversationId,
  );
  // Un fil qui n'est pas le sien est introuvable, comme s'il n'existait pas :
  // le distinguer confirmerait un identifiant à un curieux.
  if (!fil) notFound();

  const nom = fil.interlocuteur ?? "Votre intervenant";

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        <p className="text-sm">
          <Link
            href="/mon-espace/messages"
            className="text-brand hover:underline"
          >
            ← Mes messages
          </Link>
        </p>

        <div className="mt-4 flex items-center gap-3">
          <IntervenantAvatar nom={nom} photoUrl={fil.photoUrl} taille={52} />
          <div>
            <h1 className="font-heading text-2xl font-black tracking-tight">
              {nom}
            </h1>
            <p className="text-sm text-muted-foreground">
              Votre intervenant Léo Clean
            </p>
          </div>
        </div>

        <FilClient
          conversationId={conversationId}
          interlocuteur={nom}
          messages={fil.messages}
        />
      </main>
    </>
  );
}
