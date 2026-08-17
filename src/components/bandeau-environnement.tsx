import { SITE } from "@/lib/site";

/**
 * Bandeau des environnements qui ne sont pas la production.
 *
 * Même raison que le bandeau de la vitrine statique, et elle vaut d'autant
 * plus ici que la dev est une copie conforme : mêmes écrans, mêmes tarifs,
 * même numéro de téléphone, et un tunnel qui va jusqu'à la confirmation. Rien
 * à l'écran ne distingue une réservation de test d'une vraie — sauf ceci.
 *
 * Il n'est pas fermable, et il est en tête de document : un bandeau qu'on
 * referme au premier clic n'avertit que la personne qui savait déjà.
 */
export function BandeauEnvironnement() {
  return (
    <p className="border-b border-peach-200 bg-peach-50 px-6 py-2 text-center text-sm font-medium text-peach-800">
      Environnement de test — les données sont fictives et aucune intervention
      n&apos;est réellement planifiée. Pour une demande réelle&nbsp;:{" "}
      <a href={`tel:${SITE.phoneE164}`} className="font-medium underline">
        {SITE.phone}
      </a>
    </p>
  );
}
