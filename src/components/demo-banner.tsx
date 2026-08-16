import { SITE } from "@/lib/site";

/**
 * Bandeau de la vitrine statique.
 *
 * Une démonstration qui ne s'annonce pas est une tromperie, même involontaire :
 * le site affiche un vrai numéro, une vraie adresse et de vrais tarifs, et
 * quelqu'un pourrait croire y avoir réservé. Le bandeau est donc en tête de
 * document, avant tout le reste, et il n'est pas fermable.
 */
export function DemoBanner() {
  return (
    <p className="border-b border-peach-200 bg-peach-50 px-6 py-2 text-center text-sm font-medium text-peach-800">
      Démonstration — aucune réservation n&apos;est enregistrée. Pour une
      demande réelle&nbsp;:{" "}
      <a href={`tel:${SITE.phoneE164}`} className="font-medium underline">
        {SITE.phone}
      </a>
    </p>
  );
}
