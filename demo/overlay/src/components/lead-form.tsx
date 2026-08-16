import { ContactChannels } from "@/components/contact-channels";
import { getCommuneByInsee } from "@/lib/territory";

/**
 * Formulaire de rappel — variante de la vitrine statique.
 *
 * Ce fichier remplace le formulaire réel le temps de l'export. Il n'importe
 * aucune server action, ce qui est la condition pour que Next produise un site
 * de fichiers.
 *
 * Le parti pris est de **ne pas afficher un formulaire mort**. Un champ qu'on
 * remplit sans que rien ne parte est pire qu'un formulaire absent : la demande
 * est perdue, et la personne croit avoir été entendue. On montre donc les
 * canaux qui, eux, fonctionnent vraiment — le téléphone, WhatsApp et l'email
 * sont les mêmes ici que sur le site de production.
 */
export function LeadForm({
  defaultCommuneInsee,
}: {
  defaultCommuneInsee?: string;
  sourcePath?: string;
}) {
  const commune = defaultCommuneInsee
    ? getCommuneByInsee(defaultCommuneInsee)
    : undefined;

  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-6 text-center">
      <p className="font-extrabold">
        Le formulaire de rappel n&apos;est pas actif sur cette démonstration
      </p>
      <p className="mx-auto mt-2 max-w-prose text-sm text-pretty text-muted-foreground">
        Il a besoin d&apos;un serveur pour enregistrer la demande, et cette
        vitrine n&apos;est faite que de fichiers. Ces trois canaux-là, en
        revanche, fonctionnent.
      </p>
      <ContactChannels communeName={commune?.name} className="mt-5" />
    </div>
  );
}
