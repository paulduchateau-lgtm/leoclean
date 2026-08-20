import {
  type Facture,
  mentionsObligatoires,
  quantiteLisible,
} from "@/lib/facturation/document";
import { formatEuros } from "@/lib/pricing";

/**
 * Le document imprimable d'une facture.
 *
 * **Du HTML, pas un PDF engendré.** Une bibliothèque de PDF ajouterait une
 * dépendance lourde à une construction sans serveur pour produire ce que le
 * navigateur sait déjà faire : « Imprimer » puis « Enregistrer au format PDF »
 * donne un vrai fichier, sur tous les appareils, sans que rien n'ait à être
 * installé ni maintenu.
 *
 * Ce qui rend le document stable n'est pas son format mais **son instantané** :
 * tout ce qui est imprimé ici a été figé à l'émission. Une facture de l'an
 * dernier se réimprime à l'identique même si l'émetteur a déménagé.
 */

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const LIBELLES_TYPE: Record<string, string> = {
  CLIENT_SERVICE: "Prestation de ménage à domicile",
  CLIENT_COORDINATION: "Mise en relation et coordination",
};

function Partie({
  titre,
  nom,
  lignes,
  complement,
}: {
  titre: string;
  nom: string;
  lignes: readonly string[];
  complement?: readonly (string | null)[];
}) {
  return (
    <div>
      <p className="text-xs tracking-overline text-muted-foreground uppercase">
        {titre}
      </p>
      <p className="mt-1 font-semibold">{nom}</p>
      {lignes.map((ligne) => (
        <p key={ligne} className="text-sm">
          {ligne}
        </p>
      ))}
      {complement
        ?.filter((ligne): ligne is string => Boolean(ligne))
        .map((ligne) => (
          <p key={ligne} className="text-sm text-muted-foreground">
            {ligne}
          </p>
        ))}
    </div>
  );
}

export function DocumentFacture({
  facture,
  type,
}: {
  facture: Facture;
  type: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6 print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-2xl font-black">Facture</p>
          <p className="mt-1 font-mono text-sm">{facture.numero}</p>
        </div>
        <div className="text-right text-sm">
          <p>Émise le {JOUR.format(new Date(facture.emiseLe))}</p>
          {/*
           * Date et lieu d'exécution : mentions obligatoires de l'arrêté du
           * 3 octobre 1983 pour une prestation de services à un particulier.
           */}
          <p className="text-muted-foreground">
            Prestation du {JOUR.format(new Date(facture.executeeLe))}
          </p>
          <p className="text-muted-foreground">à {facture.lieu}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Partie
          titre="Prestataire"
          nom={facture.emetteur.nom}
          lignes={facture.emetteur.adresse}
          complement={[
            facture.emetteur.formeJuridique,
            `SIRET ${facture.emetteur.siret}`,
          ]}
        />
        <Partie
          titre="Client"
          nom={facture.destinataire.nom}
          lignes={facture.destinataire.adresse}
        />
      </div>

      <table className="mt-8 w-full text-sm">
        <caption className="sr-only">
          Décompte détaillé des prestations facturées
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2">
              Désignation
            </th>
            <th scope="col" className="py-2 text-right">
              Quantité
            </th>
            <th scope="col" className="py-2 text-right">
              Prix unitaire
            </th>
            <th scope="col" className="py-2 text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {facture.lignes.map((ligne) => (
            <tr key={ligne.designation} className="border-b border-border">
              <td className="py-3">
                {ligne.designation}
                <span className="block text-xs text-muted-foreground">
                  {LIBELLES_TYPE[type] ?? ""}
                </span>
              </td>
              <td className="py-3 text-right font-mono tabular-nums">
                {quantiteLisible(ligne)}
              </td>
              <td className="py-3 text-right font-mono tabular-nums">
                {formatEuros(ligne.prixUnitaireCents)}
              </td>
              <td className="py-3 text-right font-mono tabular-nums">
                {formatEuros(ligne.totalCents)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="py-2 text-right">
              Total hors taxes
            </td>
            <td className="py-2 text-right font-mono tabular-nums">
              {formatEuros(facture.totalHtCents)}
            </td>
          </tr>
          {/*
           * La ligne de TVA n'apparaît que si elle existe : en franchise en
           * base, afficher « TVA 0,00 € » laisserait croire à une exonération
           * calculée là où il n'y a pas d'assujettissement.
           */}
          {facture.tvaCents > 0 ? (
            <tr>
              <td colSpan={3} className="py-2 text-right">
                TVA
                {facture.emetteur.tauxTvaBp
                  ? ` (${facture.emetteur.tauxTvaBp / 100} %)`
                  : ""}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {formatEuros(facture.tvaCents)}
              </td>
            </tr>
          ) : null}
          <tr className="border-t-2 border-foreground">
            <td colSpan={3} className="py-3 text-right font-bold">
              Total à payer
            </td>
            <td className="py-3 text-right font-mono text-lg font-black tabular-nums">
              {formatEuros(facture.totalTtcCents)}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-8 space-y-1.5 border-t border-border pt-4 text-xs text-pretty text-muted-foreground">
        {/*
         * Les mentions sont engendrées depuis les faits de la facture, jamais
         * recopiées : une mention de TVA qui ne suivrait pas le régime réel de
         * l'émetteur rendrait la facture irrégulière, et un gabarit est
         * précisément l'endroit où l'on oublie de la changer.
         */}
        {mentionsObligatoires(facture).map((mention) => (
          <p key={mention}>{mention}</p>
        ))}
      </footer>
    </article>
  );
}
