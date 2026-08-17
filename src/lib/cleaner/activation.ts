import type { DocumentStatus, DocumentType } from "@prisma/client";

import { checkInsurance, checkSiret } from "@/lib/cleaner/identifiants";

/**
 * Ce qui manque à un intervenant avant qu'il puisse recevoir des missions.
 *
 * Module **pur**, sur le modèle de `PENDING_IDENTITY_FIELDS` : la liste est
 * dérivée de l'état du dossier, jamais posée à la main. Un drapeau « vérifié »
 * qu'on lèverait séparément finirait par mentir — le seul état vrai est celui
 * des pièces.
 *
 * **La liste est exactement celle promise aux clients** sous « professionnels
 * vérifiés », et celle affichée aux candidats sur `/travailler-avec-nous`. Les
 * trois surfaces disent la même chose, et n'importe qui peut le vérifier.
 */

/** Les quatre pièces exigées, et ce qu'elles bloquent. */
export const REQUIRED_DOCUMENTS: readonly DocumentType[] = [
  "SIRET",
  "INSURANCE_RC_PRO",
  "IDENTITY",
  "BANK_DETAILS",
];

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  SIRET: "justificatif d'immatriculation",
  INSURANCE_RC_PRO: "attestation de responsabilité civile professionnelle",
  IDENTITY: "pièce d'identité",
  BANK_DETAILS: "RIB",
};

export interface ActivationInput {
  siret: string | null;
  /** Numéro de déclaration SAP de l'intervenant, quand il l'a obtenu. */
  sapDeclarationNumber: string | null;
  insuranceExpiresAt: Date | null;
  documents: readonly { type: DocumentType; status: DocumentStatus }[];
  now: Date;
}

export interface ActivationState {
  /** Rien ne manque : le dossier peut être activé. */
  ready: boolean;
  /** Ce qui manque, rédigé pour être lu par l'intervenant. */
  missing: string[];
  /** Ce qui n'empêche pas d'être activé, mais qu'il faut savoir. */
  warnings: string[];
}

/**
 * État du dossier, tel que l'intervenant doit le lire.
 *
 * **Le numéro SAP ne bloque pas l'activation**, et c'est un arbitrage : la
 * déclaration met des semaines à être instruite, et refuser de faire
 * travailler quelqu'un en attendant reviendrait à ne recruter personne au
 * lancement. Il figure donc en avertissement — mais tant qu'il manque, la part
 * de cet intervenant n'ouvre aucun crédit d'impôt au client, et c'est écrit.
 */
export function activationState(input: ActivationInput): ActivationState {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (input.siret === null) {
    missing.push("votre SIRET");
  } else if (!checkSiret(input.siret).valid) {
    missing.push("un SIRET valide — celui enregistré ne passe pas sa clé");
  }

  const insurance = checkInsurance(input.insuranceExpiresAt, input.now);
  if (!insurance.valid) {
    missing.push(
      "une attestation de responsabilité civile professionnelle en cours de validité",
    );
  } else if (insurance.expiringSoon) {
    warnings.push(
      "Votre attestation d'assurance expire bientôt : pensez à envoyer la nouvelle.",
    );
  }

  const approved = new Set(
    input.documents
      .filter((document) => document.status === "APPROVED")
      .map((document) => document.type),
  );
  const rejected = new Set(
    input.documents
      .filter((document) => document.status === "REJECTED")
      .map((document) => document.type),
  );

  for (const type of REQUIRED_DOCUMENTS) {
    if (approved.has(type)) continue;
    missing.push(
      rejected.has(type)
        ? `${DOCUMENT_LABELS[type]} — celui envoyé a été refusé`
        : DOCUMENT_LABELS[type],
    );
  }

  if (input.sapDeclarationNumber === null) {
    warnings.push(
      "Sans numéro de déclaration SAP, votre part n'ouvre pas de crédit d'impôt à vos clients. Vous pouvez travailler sans, mais c'est un argument en moins.",
    );
  }

  return { ready: missing.length === 0, missing, warnings };
}
