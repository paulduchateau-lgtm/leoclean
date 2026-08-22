"use client";

import { CheckIcon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  deposerMaPiece,
  soumettreMonDossier,
} from "@/app/(app)/intervenant/dossier/actions";
import type { PieceVue } from "@/lib/cleaner/etat-compte";

/**
 * Les quatre pièces du dossier, cochées ou non.
 *
 * **Toutes sont affichées, y compris celles qu'on n'a pas.** Une liste qui ne
 * montre que ce qui manque dit ce qui va mal ; les quatre, avec leurs coches,
 * transforment un reproche en progression — et l'on voit d'un coup d'œil où
 * l'on en est.
 *
 * **Le bouton de soumission est en bas et ne s'active que si tout est là.** Il
 * reste visible et désactivé plutôt que caché : un bouton qui apparaît d'un
 * coup ne se cherche pas, il se découvre par hasard.
 */

const LIBELLES: Record<string, { titre: string; aide: string }> = {
  SIRET: {
    titre: "Justificatif d'immatriculation",
    aide: "Avis de situation SIRENE, ou extrait K.",
  },
  INSURANCE_RC_PRO: {
    titre: "Responsabilité civile professionnelle",
    aide: "L'attestation en cours de validité. Sa date de fin est demandée.",
  },
  IDENTITY: {
    titre: "Pièce d'identité",
    aide: "Carte d'identité, passeport ou titre de séjour.",
  },
  BANK_DETAILS: { titre: "RIB", aide: "À votre nom ou à celui de la société." },
};

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function Pieces({
  pieces,
  peutSoumettre,
  soumisLe,
  disponible,
}: {
  pieces: PieceVue[];
  peutSoumettre: boolean;
  soumisLe: string | null;
  /** Le coffre est-il configuré ? Sans lui, on le dit au lieu d'échouer. */
  disponible: boolean;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="mt-10">
      <h2 className="font-heading text-lg font-extrabold">Vos pièces</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quatre documents, et c&apos;est tout. Ce sont exactement ceux que nous
        promettons à vos clients sous « professionnels vérifiés ».
      </p>

      <ul className="mt-5 space-y-3">
        {pieces.map((piece) => (
          <LignePiece
            key={piece.type}
            piece={piece}
            disponible={disponible}
            pending={pending}
            onErreur={setErreur}
            startTransition={startTransition}
          />
        ))}
      </ul>

      {erreur ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <div className="mt-8 border-t border-border pt-6">
        {soumisLe ? (
          <p className="flex items-center gap-2 text-pretty text-brand">
            <CheckIcon className="size-5 shrink-0" aria-hidden />
            Dossier soumis le {JOUR.format(new Date(soumisLe))}. Nous revenons
            vers vous sous 48 heures ouvrées.
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled={!peutSoumettre || pending}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await soumettreMonDossier();
                  if (!resultat.ok) setErreur(resultat.message);
                })
              }
              className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand enabled:hover:-translate-y-px enabled:hover:bg-pineapple-400 disabled:opacity-45"
            >
              Soumettre mon dossier pour validation
            </button>
            {!peutSoumettre ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Le bouton s&apos;active dès que les quatre pièces sont déposées.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function LignePiece({
  piece,
  disponible,
  pending,
  onErreur,
  startTransition,
}: {
  piece: PieceVue;
  disponible: boolean;
  pending: boolean;
  onErreur: (message: string | null) => void;
  startTransition: (action: () => Promise<void>) => void;
}) {
  const champ = useRef<HTMLInputElement | null>(null);
  const [expire, setExpire] = useState("");
  const libelle = LIBELLES[piece.type] ?? { titre: piece.type, aide: "" };
  const demandeUneDate = piece.type === "INSURANCE_RC_PRO";

  const envoyer = (fichier: File) => {
    onErreur(null);
    const formData = new FormData();
    formData.append("piece", fichier);
    formData.append("type", piece.type);
    if (expire) formData.append("expiresAt", expire);

    startTransition(async () => {
      const resultat = await deposerMaPiece(formData);
      if (!resultat.ok) onErreur(resultat.message);
    });
  };

  return (
    <li
      className={`rounded-[var(--r-l)] border-2 p-4 ${
        piece.conforme ? "border-success/40 bg-success/5" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
            piece.conforme
              ? "bg-success text-white"
              : "border-2 border-destructive/50"
          }`}
        >
          {piece.conforme ? <CheckIcon className="size-4" /> : null}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">{libelle.titre}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {piece.detail ?? libelle.aide}
          </p>
          {piece.expireLe && piece.conforme ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Valable jusqu&apos;au {JOUR.format(new Date(piece.expireLe))}.
            </p>
          ) : null}

          {demandeUneDate ? (
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium">Valable jusqu&apos;au</span>
              <input
                type="date"
                value={expire}
                onChange={(event) => setExpire(event.target.value)}
                className="min-h-11 w-full max-w-56 rounded-[var(--r-m)] border-2 border-input bg-card px-3"
              />
            </label>
          ) : null}

          <input
            ref={champ}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(event) => {
              const fichier = event.target.files?.[0];
              if (fichier) envoyer(fichier);
              // Remis à zéro : redéposer le même fichier après une erreur ne
              // déclencherait sinon aucun changement.
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={!disponible || pending}
            onClick={() => champ.current?.click()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50"
          >
            <UploadIcon className="size-4" aria-hidden />
            {piece.etat === "MANQUANTE" ? "Déposer" : "Remplacer"}
          </button>
        </div>
      </div>
    </li>
  );
}
