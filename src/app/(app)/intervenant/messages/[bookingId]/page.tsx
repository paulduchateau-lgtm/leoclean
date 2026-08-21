import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Fil } from "@/app/(app)/intervenant/messages/[bookingId]/fil";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
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
}: PageProps<"/intervenant/messages/[bookingId]">) {
  const { bookingId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=/intervenant/messages/${bookingId}`);
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
    messages = await lireLeFil(db, profil.id, user.id, bookingId);
  } catch (erreur) {
    /*
     * Une intervention qui n'est pas la sienne rend 404, comme si elle
     * n'existait pas : distinguer « vous n'avez pas le droit » de « cela
     * n'existe pas » confirmerait un identifiant à un curieux.
     */
    if (erreur instanceof MessageRefuseError) notFound();
    throw erreur;
  }

  const intervention = await db.booking.findFirst({
    where: { id: bookingId },
    select: {
      scheduledStart: true,
      address: { select: { cityName: true } },
      clientProfile: { select: { user: { select: { name: true } } } },
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
        {intervention?.clientProfile.user.name?.split(" ")[0] ?? "Client"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {intervention?.address.cityName}
      </p>

      <Fil bookingId={bookingId} messages={messages} />
    </main>
  );
}
