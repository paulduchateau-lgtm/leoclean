import { ContactChannels } from "@/components/contact-channels";

/**
 * Liste d'attente hors zone — variante de la vitrine statique.
 *
 * Ce fichier remplace le formulaire réel le temps de l'export. Il n'importe
 * aucune server action, ce qui est la condition pour que Next produise un site
 * de fichiers.
 *
 * Même parti pris que le formulaire de rappel : **on n'affiche pas un
 * formulaire mort**. Un champ qu'on remplit sans que rien ne parte est pire
 * qu'un formulaire absent — la demande est perdue et la personne croit avoir
 * été entendue. On montre donc les canaux qui fonctionnent vraiment.
 */
export function ListeAttente({
  className,
}: {
  className?: string;
  sourcePath?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-secondary/50 p-6 text-center ${className ?? ""}`}
    >
      <p className="font-extrabold">
        La liste d&apos;attente n&apos;est pas active sur cette démonstration
      </p>
      <p className="mt-2 text-muted-foreground">
        Sur le vrai site, vous laissez ici votre commune et nous vous prévenons
        le jour où quelqu&apos;un y travaille à moins de vingt minutes. En
        attendant, ces canaux-là répondent pour de bon.
      </p>
      <ContactChannels className="mt-5" />
    </div>
  );
}
