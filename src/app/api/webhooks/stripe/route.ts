import type Stripe from "stripe";

import { forOrganization, prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { stripe, stripeEstConfigure } from "@/lib/paiement/stripe";

/**
 * Webhook Stripe.
 *
 * Deux garanties, et elles ne sont pas facultatives :
 *
 * 1. **La signature est vérifiée** avant toute lecture du contenu. Sans elle,
 *    n'importe qui pourrait annoncer un paiement réussi et faire marquer une
 *    réservation comme réglée.
 * 2. **Le traitement est idempotent** par `event.id`. Stripe rejoue un
 *    événement quand il n'obtient pas de réponse à temps ; sans garde, un
 *    remboursement pourrait être compté deux fois.
 *
 * La table `WebhookEvent` attendait depuis la phase 1.
 */

export const runtime = "nodejs";
/* Le corps brut est nécessaire à la vérification : aucun cache, aucun prérendu. */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!stripeEstConfigure() || !serverEnv.STRIPE_WEBHOOK_SECRET) {
    /*
     * On répond 503 et non 200 : un webhook accepté sans être traité serait
     * perdu définitivement, Stripe considérant l'événement comme délivré.
     */
    return new Response("Stripe n'est pas configuré", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Signature absente", { status: 400 });
  }

  const corps = await request.text();

  let evenement: Stripe.Event;
  try {
    evenement = stripe().webhooks.constructEvent(
      corps,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    );
  } catch (erreur) {
    console.error("Signature de webhook Stripe invalide", erreur);
    return new Response("Signature invalide", { status: 400 });
  }

  /*
   * L'insertion fait office de verrou : l'unicité de `eventId` est en base, si
   * bien que deux livraisons concurrentes ne peuvent pas passer toutes les
   * deux. Vérifier puis écrire laisserait un intervalle entre les deux.
   */
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "STRIPE",
        externalId: evenement.id,
        eventType: evenement.type,
        payload: evenement.data.object as object,
      },
    });
  } catch {
    // Déjà reçu : on répond 200 pour que Stripe cesse de rejouer.
    return Response.json({ deja_traite: true });
  }

  try {
    await traiter(evenement);
    await prisma.webhookEvent.updateMany({
      where: { provider: "STRIPE", externalId: evenement.id },
      data: { processedAt: new Date() },
    });
  } catch (erreur) {
    console.error(`Webhook Stripe « ${evenement.type} » non traité`, erreur);
    /*
     * On rend 500 pour que Stripe rejoue — et la ligne `WebhookEvent` est
     * retirée, sans quoi le rejeu serait écarté comme un doublon et l'événement
     * perdu pour de bon.
     */
    await prisma.webhookEvent
      .deleteMany({ where: { provider: "STRIPE", externalId: evenement.id } })
      .catch(() => {});
    return new Response("Traitement impossible", { status: 500 });
  }

  return Response.json({ recu: true });
}

async function traiter(evenement: Stripe.Event): Promise<void> {
  switch (evenement.type) {
    case "payment_intent.succeeded":
      return marquerPaiement(evenement, "CAPTURED");
    case "payment_intent.payment_failed":
      return marquerPaiement(evenement, "FAILED");
    case "payment_intent.canceled":
      return marquerPaiement(evenement, "CANCELLED");
    default:
      /*
       * Les autres types sont acceptés sans être traités : refuser ferait
       * rejouer indéfiniment un événement qu'on ne veut pas, et Stripe finirait
       * par désactiver l'endpoint.
       */
      return;
  }
}

async function marquerPaiement(
  evenement: Stripe.Event,
  statut: "CAPTURED" | "FAILED" | "CANCELLED",
): Promise<void> {
  const intention = evenement.data.object as Stripe.PaymentIntent;

  const paiement = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: intention.id },
    select: { id: true, organizationId: true },
  });
  if (!paiement) return;

  const db = forOrganization(paiement.organizationId);
  await db.payment.update({
    where: { id: paiement.id },
    data: {
      status: statut,
      ...(statut === "CAPTURED"
        ? {
            capturedAt: new Date(),
            capturedAmountCents: intention.amount_received,
          }
        : {}),
      ...(statut === "FAILED"
        ? { failureCode: intention.last_payment_error?.code ?? "inconnu" }
        : {}),
    },
  });
}
