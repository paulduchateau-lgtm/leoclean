import { genererLesRecurrences } from "@/lib/abonnement/generateur";
import { traiterLesPaiements } from "@/lib/paiement/travaux";
import { purgerSelonLaRetention } from "@/lib/rgpd/retention";
import { traiterLesEcheances } from "@/lib/assignments/echeances";
import { serverEnv } from "@/lib/env";

/**
 * Point d'entrée de l'ordonnanceur.
 *
 * Les quatre minuteries de la diffusion, l'expiration des propositions et la
 * purge des compteurs de débit n'ont jusqu'ici été appelées par personne. Cette
 * route est ce qui les fait exister : un travail planifié la frappe, elle
 * exécute ce qui est échu, et rend le compte de ce qu'elle a fait.
 *
 * **Elle n'est pas publique.** Vercel envoie `Authorization: Bearer` avec le
 * secret du projet sur ses appels planifiés ; sans ce secret, la route refuse.
 * Laissée ouverte, elle permettrait à n'importe qui de déclencher un
 * élargissement au secteur — donc de solliciter tous les intervenants d'un coup,
 * autant de fois qu'il le voudrait.
 *
 * **Le secret manquant ferme la route plutôt que de l'ouvrir.** C'est la
 * direction inverse de celle retenue pour l'indexation, et pour une raison
 * inverse : un oubli de variable qui désindexe le site est visible et
 * réparable, un oubli qui ouvre un déclencheur ne se voit pas.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const attendu = serverEnv.CRON_SECRET;
  if (!attendu) {
    return Response.json(
      { erreur: "Ordonnanceur non configuré : CRON_SECRET est absente." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${attendu}`) {
    return Response.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const rapport = await traiterLesEcheances();

  /*
   * La génération des récurrences vient après les échéances, et séparément :
   * une erreur dans l'une ne doit pas empêcher l'autre. Elle est idempotente,
   * donc la repasser toutes les heures ne produit rien de plus.
   */
  let recurrences;
  try {
    recurrences = await genererLesRecurrences();
  } catch (erreur) {
    console.error("Génération des récurrences interrompue", erreur);
    recurrences = { erreur: true };
  }

  // Le compte rendu part dans les journaux de l'hébergeur : c'est la seule
  // trace de ce qui s'est passé pendant que personne ne regardait.
  /*
   * Les paiements viennent en dernier et séparément : un échec de Stripe ne
   * doit ni empêcher la diffusion des missions ni la génération des
   * récurrences, qui sont ce qui fait tourner le service.
   */
  let paiements;
  try {
    paiements = await traiterLesPaiements();
  } catch (erreur) {
    console.error("Traitement des paiements interrompu", erreur);
    paiements = { erreur: true };
  }

  /*
   * La purge de rétention vient en dernier : elle n'a aucune urgence, et une
   * erreur ne doit rien empêcher. Personne ne se plaint qu'on garde ses données
   * trop longtemps — c'est précisément pour cela qu'il faut une horloge.
   */
  let retention;
  try {
    retention = await purgerSelonLaRetention();
  } catch (erreur) {
    console.error("Purge de rétention interrompue", erreur);
    retention = { erreur: true };
  }

  console.info("Ordonnanceur", {
    ...rapport,
    recurrences,
    paiements,
    retention,
  });

  return Response.json({ ...rapport, recurrences, paiements, retention });
}
