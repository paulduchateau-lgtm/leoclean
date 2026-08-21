import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Fil } from "@/app/(app)/intervenant/messages/[conversationId]/fil";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { filDe } from "@/lib/messagerie/conversation";
import { lireLeFil, MessageRefuseError } from "@/lib/messagerie/intervenant";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Un fil.
 *
 * Ouvrir la page marque les messages comme lus — c'est `lireLeFil` qui le fait,
 * dans le même appel : séparer les deux ferait dépendre l'accusé de lecture
 * d'un second aller-retour qui échoue parfois, et le client verrait « non lu »
 * sur un message qu'on a pourtant sous les yeux.
 */

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FilPage({
  params,
}: PageProps<"/intervenant/messages/[conversationId]">) {
  const { conversationId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=/intervenant/messages/${conversationId}`);
  }

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:read:own",
  );

  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profil) notFound();

  let messages;
  try {
    messages = await lireLeFil(db, profil.id, user.id, conversationId);
  } catch (erreur) {
    /*
     * Une intervention qui n'est pas la sienne rend 404, comme si elle
     * n'existait pas : distinguer « vous n'avez pas le droit » de « cela
     * n'existe pas » confirmerait un identifiant à un curieux.
     */
    if (erreur instanceof MessageRefuseError) notFound();
    throw erreur;
  }

  /*
   * L'en-tête nomme la personne, plus l'intervention : le fil suit la
   * relation. La dernière intervention connue reste affichée pour situer —
   * « Léognan, lundi dernier » — sans faire croire que le fil s'arrête avec
   * elle.
   */
  const fil = await filDe(db, conversationId, {
    cleanerProfileId: profil.id,
  });
  if (!fil) notFound();

  const derniere = await db.booking.findFirst({
    where: { clientProfileId: fil.clientProfileId },
    orderBy: { scheduledStart: "desc" },
    select: {
      scheduledStart: true,
      address: { select: { cityName: true } },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <p className="text-sm">
        <Link
          href="/intervenant/messages"
          className="text-brand hover:underline"
        >
          ← Mes messages
        </Link>
      </p>

      <h1 className="mt-3 font-heading text-2xl font-black tracking-tight">
        {fil.interlocuteur ?? "Client"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {derniere?.address.cityName ?? "—"}
      </p>

      <Fil conversationId={conversationId} messages={messages} />
    </main>
  );
}
