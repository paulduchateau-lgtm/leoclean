-- Le funnel d'inscription intervenant.
--
-- Jusqu'ici, s'inscrire passait par `npm run db:intervenant` : une commande
-- lancée à la main par l'exploitant. Tenable jusqu'à une dizaine de personnes,
-- goulot au-delà.
--
-- Le principe qui gouverne tout : un candidat sans SIRET n'est pas un candidat
-- disqualifié, c'est un candidat à quatre semaines. C'est là que se trouve le
-- vivier réel au sud de Bordeaux — quelqu'un qui sait faire le travail mais que
-- l'administratif arrête. L'attente est donc un état du parcours, pas une
-- sortie : le dossier avance pendant ce temps sur tout ce qui n'en dépend pas.
--
-- Hors du périmètre multi-tenant : une candidature précède l'appartenance, et
-- c'est justement ce qu'elle sert à obtenir.
CREATE TABLE "ProApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMMENCE',
    -- SIRET_EXISTANT | CREATION_AE
    "branchLegal" TEXT,
    -- SAP_EXISTANT | SAP_A_DECLARER
    "branchSap" TEXT,

    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,

    "declaredCity" TEXT,
    "declaredInsee" TEXT,
    "travelMode" TEXT,
    "hoursPerWeek" TEXT,
    "experience" TEXT,
    "presentation" TEXT,
    "photoPath" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" JSONB,

    "siret" TEXT,
    "siretVerifiedAt" TIMESTAMP(3),
    "legalName" TEXT,
    "apeCode" TEXT,
    "siretSubmittedAt" TIMESTAMP(3),
    "siretReceivedAt" TIMESTAMP(3),

    "sapNumber" TEXT,
    "sapVerifiedAt" TIMESTAMP(3),
    "sapSubmittedAt" TIMESTAMP(3),

    "interviewAt" TIMESTAMP(3),
    "interviewScores" JSONB,
    "interviewNotes" TEXT,

    -- Signature horodatée des trois documents, conservation cinq ans.
    "chartersSignedAt" TIMESTAMP(3),
    "chartersIp" TEXT,
    "chartersVersion" TEXT,

    -- Signaux d'attention, volontairement hors de tout score : un doublon
    -- d'IBAN ne se compense pas par de bons points ailleurs.
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "source" TEXT,

    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nudgesSent" INTEGER NOT NULL DEFAULT 0,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProApplication_userId_key" ON "ProApplication"("userId");
-- La file de revue se lit « par statut, du plus ancien au plus récent » : un bon
-- dossier oublié dix jours est un candidat perdu.
CREATE INDEX "ProApplication_status_lastActivityAt_idx" ON "ProApplication"("status", "lastActivityAt");
-- Détection de doublons : téléphone et SIRET sont les deux entrées.
CREATE INDEX "ProApplication_phone_idx" ON "ProApplication"("phone");
CREATE INDEX "ProApplication_siret_idx" ON "ProApplication"("siret");

CREATE TABLE "ProApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProApplicationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProApplicationEvent_applicationId_at_idx" ON "ProApplicationEvent"("applicationId", "at");

-- Distincte de `CleanerDocument`, qui suit un intervenant déjà actif : une
-- candidature n'a pas encore de profil, et confondre les deux ferait exister des
-- documents rattachés à personne.
CREATE TABLE "ProApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATTENDUE',
    "storagePath" TEXT,
    "issuedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    -- Motif rédigé en langage courant, jamais un code : un motif vague fait
    -- redéposer la même pièce.
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProApplicationDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProApplicationDocument_applicationId_kind_key" ON "ProApplicationDocument"("applicationId", "kind");
CREATE INDEX "ProApplicationDocument_status_idx" ON "ProApplicationDocument"("status");

ALTER TABLE "ProApplicationEvent"
    ADD CONSTRAINT "ProApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId")
    REFERENCES "ProApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProApplicationDocument"
    ADD CONSTRAINT "ProApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId")
    REFERENCES "ProApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
