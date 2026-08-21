"use client";

import {
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  declarerMonSiret,
  deposerMaPiece,
  jaiEnvoyeMaDemarche,
  jeSuisBloque,
} from "@/app/rejoindre/actions";
import { Button } from "@/components/ui/button";

/**
 * Le suivi d'un dossier, côté candidat.
 *
 * **« Je suis bloqué » est présent sur chaque écran des branches longues**, et
 * c'est le point de sauvetage le plus rentable du funnel : entre le moment où
 * quelqu'un ouvre le Guichet unique et celui où il abandonne, il y a une
 * question sans réponse.
 */

interface PieceVue {
  kind: string;
  libelle: string;
  statut: string;
  motif: string | null;
  engendree: boolean;
}

const ETATS_PIECE: Record<
  string,
  { texte: string; ton: "attente" | "encours" | "ok" | "refus" }
> = {
  ATTENDUE: { texte: "À déposer", ton: "attente" },
  DEPOSEE: { texte: "En cours de vérification", ton: "encours" },
  VALIDEE: { texte: "Validée", ton: "ok" },
  REFUSEE: { texte: "À redéposer", ton: "refus" },
};

function Pastille({ ton }: { ton: "attente" | "encours" | "ok" | "refus" }) {
  if (ton === "ok") {
    return <CheckIcon className="size-5 shrink-0 text-brand" aria-hidden />;
  }
  if (ton === "refus") {
    return (
      <CircleAlertIcon
        className="size-5 shrink-0 text-destructive"
        aria-hidden
      />
    );
  }
  if (ton === "encours") {
    return (
      <ClockIcon className="size-5 shrink-0 text-warning-dark" aria-hidden />
    );
  }
  return (
    <span
      aria-hidden
      className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-input"
    />
  );
}

export function SuiviDossier({
  dossier,
  pieces,
  depotOuvert,
  telephone,
}: {
  dossier: {
    statut: string;
    brancheStatut: string | null;
    progression: number;
    manques: string[];
    activable: boolean;
    siret: string | null;
    raisonSociale: string | null;
  };
  pieces: PieceVue[];
  depotOuvert: boolean;
  telephone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [siret, setSiret] = useState("");
  const [messageSiret, setMessageSiret] = useState<string | null>(null);
  const [aide, setAide] = useState(false);
  const [erreurPiece, setErreurPiece] = useState<string | null>(null);
  const [pieceEnCours, setPieceEnCours] = useState<string | null>(null);
  const entrees = useRef<Record<string, HTMLInputElement | null>>({});

  const enAttenteDeSiret =
    !dossier.siret && dossier.brancheStatut !== "CREATION_AE";
  const enCreation = dossier.brancheStatut === "CREATION_AE" && !dossier.siret;

  return (
    <>
      {/* --- La barre, qui ne recule jamais --- */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium">Votre dossier</p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {dossier.progression} %
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={dossier.progression}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement du dossier"
          className="mt-2 h-3 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${dossier.progression}%` }}
          />
        </div>
      </section>

      {/* --- La prochaine chose à faire, seule en avant --- */}
      {dossier.manques.length > 0 ? (
        <section className="mt-6 rounded-2xl border-2 border-brand bg-card p-5">
          <p className="text-xs tracking-overline text-muted-foreground uppercase">
            La prochaine étape
          </p>
          <p className="mt-1 font-heading text-xl font-extrabold">
            {dossier.manques[0]}
          </p>
          {/*
           * Le reste est replié. Dérouler onze lignes sous « la prochaine
           * étape » annulerait exactement ce que la mise en avant sert à
           * faire — et les libellés ne sont pas remis en minuscules : « SIRET »,
           * « URSSAF » et « SAP » sont des sigles, pas des mots.
           */}
          {dossier.manques.length > 1 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Puis {dossier.manques.length - 1} autre
                {dossier.manques.length > 2 ? "s" : ""} étape
                {dossier.manques.length > 2 ? "s" : ""}
              </summary>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                {dossier.manques.slice(1).map((manque) => (
                  <li key={manque}>{manque}</li>
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 font-semibold">
          {dossier.activable
            ? "Votre dossier est complet. On vous appelle pour la suite."
            : "Tout est déposé. Il ne reste que nos vérifications."}
        </p>
      )}

      {/* --- Le SIRET --- */}
      {enAttenteDeSiret ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-extrabold">
            Votre numéro SIRET
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quatorze chiffres, sur votre avis de situation SIRENE. On vérifie
            tout de suite et on récupère votre avis pour vous.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              inputMode="numeric"
              autoComplete="off"
              value={siret}
              onChange={(event) => setSiret(event.target.value)}
              placeholder="123 456 789 00012"
              className="min-h-13 min-w-56 flex-1 rounded-xl border border-input bg-background px-4 font-mono text-base"
            />
            <Button
              disabled={pending || siret.trim().length < 9}
              onClick={() =>
                startTransition(async () => {
                  setMessageSiret(null);
                  const resultat = await declarerMonSiret({ siret });
                  setMessageSiret(
                    resultat.ok
                      ? (resultat.data.message ??
                          `C'est bon${
                            resultat.data.raisonSociale
                              ? ` — ${resultat.data.raisonSociale}`
                              : ""
                          }.`)
                      : resultat.error,
                  );
                })
              }
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : null}
              Vérifier
            </Button>
          </div>
          {messageSiret ? (
            <p role="status" className="mt-3 text-sm">
              {messageSiret}
            </p>
          ) : null}

          <p className="mt-4 text-sm">
            <button
              type="button"
              className="text-brand underline"
              onClick={() =>
                startTransition(async () => {
                  await jaiEnvoyeMaDemarche({});
                })
              }
            >
              Je n&apos;en ai pas encore, je viens de faire la démarche
            </button>
          </p>
        </section>
      ) : null}

      {enCreation ? (
        <section className="mt-8 rounded-2xl border border-border bg-secondary/40 p-5">
          <h2 className="font-heading text-lg font-extrabold">
            On attend votre SIRET
          </h2>
          <p className="mt-1 text-pretty text-muted-foreground">
            L&apos;INSEE met une à trois semaines. Vous n&apos;avez rien à faire
            en attendant : dès que vous recevez votre numéro, revenez ici et
            entrez-le. Vos missions vous attendent.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              inputMode="numeric"
              value={siret}
              onChange={(event) => setSiret(event.target.value)}
              placeholder="Mon SIRET"
              className="min-h-13 min-w-56 flex-1 rounded-xl border border-input bg-background px-4 font-mono text-base"
            />
            <Button
              variant="outline"
              disabled={pending || siret.trim().length < 9}
              onClick={() =>
                startTransition(async () => {
                  const resultat = await declarerMonSiret({ siret });
                  setMessageSiret(
                    resultat.ok
                      ? (resultat.data.message ?? "C'est bon.")
                      : resultat.error,
                  );
                })
              }
            >
              Je l&apos;ai reçu
            </Button>
          </div>
          {messageSiret ? (
            <p role="status" className="mt-3 text-sm">
              {messageSiret}
            </p>
          ) : null}
        </section>
      ) : null}

      {dossier.raisonSociale ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Entreprise vérifiée : {dossier.raisonSociale}
          {dossier.siret ? ` · ${dossier.siret}` : ""}
        </p>
      ) : null}

      {/* --- Les pièces --- */}
      <section className="mt-10">
        <h2 className="font-heading text-lg font-extrabold">Vos pièces</h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          C&apos;est exactement la liste que nous annonçons à nos clients sous «
          professionnels vérifiés ». Rien de plus, rien de moins.
        </p>

        {!depotOuvert ? (
          /*
           * On le dit plutôt que d'afficher un champ qui échouerait : un dépôt
           * accepté puis perdu ferait redéposer, et perdrait la confiance au
           * moment où on demande une pièce d'identité.
           */
          <p className="mt-3 rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning-dark">
            Le dépôt en ligne n&apos;est pas encore ouvert. Appelez-nous au{" "}
            {telephone} : on prend vos documents autrement, et votre dossier
            avance quand même.
          </p>
        ) : null}

        {erreurPiece ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erreurPiece}
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-border border-y border-border">
          {pieces.map((piece) => {
            const etat = ETATS_PIECE[piece.statut] ?? ETATS_PIECE.ATTENDUE!;
            return (
              <li key={piece.kind} className="flex gap-3 py-4">
                <Pastille ton={etat.ton} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{piece.libelle}</p>
                  <p className="text-sm text-muted-foreground">
                    {piece.engendree && piece.statut === "VALIDEE"
                      ? "Récupérée pour vous depuis l'INSEE"
                      : etat.texte}
                  </p>
                  {/*
                   * Le motif est rédigé en langage courant, jamais un code :
                   * un motif vague fait redéposer la même pièce.
                   */}
                  {piece.motif ? (
                    <p className="mt-1 text-sm text-destructive">
                      {piece.motif}
                    </p>
                  ) : null}
                </div>

                {depotOuvert &&
                !piece.engendree &&
                piece.statut !== "VALIDEE" ? (
                  <>
                    <input
                      ref={(element) => {
                        entrees.current[piece.kind] = element;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="sr-only"
                      onChange={(event) => {
                        const fichier = event.target.files?.[0];
                        if (!fichier) return;
                        const donnees = new FormData();
                        donnees.set("kind", piece.kind);
                        donnees.set("fichier", fichier);
                        setPieceEnCours(piece.kind);
                        startTransition(async () => {
                          setErreurPiece(null);
                          const resultat = await deposerMaPiece(donnees);
                          setPieceEnCours(null);
                          if (!resultat.ok) setErreurPiece(resultat.error);
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => entrees.current[piece.kind]?.click()}
                      className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border-2 border-border px-4 text-sm font-bold"
                    >
                      {pieceEnCours === piece.kind ? (
                        <Loader2Icon
                          className="size-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <UploadIcon className="size-4" aria-hidden />
                      )}
                      {piece.statut === "REFUSEE" ? "Redéposer" : "Déposer"}
                    </button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* --- Le point de sauvetage --- */}
      <section className="mt-10 rounded-2xl border border-border bg-secondary/40 p-5">
        {aide ? (
          <p role="status" className="font-semibold">
            C&apos;est noté. Quelqu&apos;un vous rappelle, sans que vous ayez à
            faire quoi que ce soit.
          </p>
        ) : (
          <>
            <p className="font-semibold">Vous êtes bloqué ?</p>
            <p className="mt-1 text-muted-foreground">
              Dites-le et on vous rappelle. C&apos;est plus rapide que de
              chercher.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const resultat = await jeSuisBloque({
                      etape: dossier.manques[0] ?? dossier.statut,
                    });
                    if (resultat.ok) setAide(true);
                  })
                }
              >
                Demander un rappel
              </Button>
              <a
                href={`tel:${telephone.replace(/\s/g, "")}`}
                className="inline-flex min-h-12 items-center rounded-full px-5 font-bold text-brand underline"
              >
                Ou appelez le {telephone}
              </a>
            </div>
          </>
        )}
      </section>
    </>
  );
}
