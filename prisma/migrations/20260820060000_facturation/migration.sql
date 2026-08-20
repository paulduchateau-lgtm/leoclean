-- Les factures, et les attestations fiscales annuelles.
--
-- `Invoice` était modélisée depuis la phase 1 et n'a jamais été écrite. Trois
-- choses lui manquaient pour l'être.

-- 1. L'instantané du document.
--
-- **Une facture est immuable.** Une fois remise, elle ne se corrige que par un
-- avoir — un second document, et une explication. Or tout ce qu'elle imprime
-- vient aujourd'hui de sources vivantes : `site.ts` pour l'identité de
-- l'émetteur, `CleanerProfile` pour celle de l'intervenant, `Address` pour le
-- lieu. Un déménagement, un changement de raison sociale, une adresse
-- corrigée, et une facture de l'an dernier se réimprimerait différemment.
--
-- L'instantané fige donc le document à l'émission. C'est ce qui permet de le
-- rendre à l'identique dix ans plus tard, durée que le code de commerce impose
-- pour les pièces comptables.
ALTER TABLE "Invoice"
  ADD COLUMN "snapshot" JSONB;

-- 2. L'idempotence.
--
-- L'émission est déclenchée par l'ordonnanceur, qui repasse toutes les heures.
-- Sans contrainte, une seconde exécution émettrait une seconde facture pour la
-- même prestation — et la première resterait dans la suite, donc impossible à
-- retirer sans y faire un trou.
CREATE UNIQUE INDEX "Invoice_bookingId_type_key"
  ON "Invoice"("bookingId", "type")
  WHERE "bookingId" IS NOT NULL;

-- 3. Le compteur de la suite.
--
-- L'article 242 nonies A de l'annexe II au CGI exige une séquence
-- chronologique **continue, sans rupture**. Une `SEQUENCE` PostgreSQL ne
-- convient pas : elle ne revient pas en arrière quand la transaction échoue, et
-- laisse exactement le trou qu'on cherche à éviter.
--
-- Une ligne de compteur, incrémentée dans la transaction qui écrit la facture,
-- se comporte à l'inverse : l'échec annule les deux. Le verrou de ligne
-- sérialise en outre deux émissions simultanées sur la même série, ce qui est
-- le seul cas où deux factures pourraient prétendre au même rang.
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    -- `LC` pour la plateforme, `LC-<siren>` pour l'autofacturation d'un
    -- intervenant. Voir `facturation/numerotation.ts`.
    "serie" TEXT NOT NULL,
    -- Année civile française, l'exercice étant civil et local.
    "annee" INTEGER NOT NULL,
    "dernierRang" INTEGER NOT NULL DEFAULT 0,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceSequence_organizationId_serie_annee_key"
  ON "InvoiceSequence"("organizationId", "serie", "annee");

ALTER TABLE "InvoiceSequence"
  ADD CONSTRAINT "InvoiceSequence_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- L'attestation fiscale annuelle.
--
-- Elle se recalcule à partir des paiements, mais elle ne se **recompose** pas :
-- un document remis au contribuable et joint à sa déclaration doit pouvoir être
-- rendu à l'identique. On le fige, comme la facture.
CREATE TABLE "TaxCertificate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    -- Émetteur : nul quand c'est la plateforme qui atteste sa coordination,
    -- renseigné quand c'est l'intervenant qui atteste sa prestation. Deux
    -- organismes déclarés, deux attestations — le même découpage que les
    -- factures.
    "issuedByCleanerProfileId" TEXT,
    "annee" INTEGER NOT NULL,

    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Sommes effectivement versées dans l'année, remboursements déduits.
    "verseCents" INTEGER NOT NULL,
    -- Part ouvrant droit à l'avantage fiscal de l'article 199 sexdecies.
    "eligibleCents" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "TaxCertificate_pkey" PRIMARY KEY ("id")
);

-- Une attestation par client, par année et par émetteur. Deux index partiels
-- plutôt qu'un seul : PostgreSQL considère deux NULL comme distincts, si bien
-- qu'un index unique ordinaire n'empêcherait pas deux attestations de la
-- plateforme pour la même année.
CREATE UNIQUE INDEX "TaxCertificate_client_annee_plateforme_key"
  ON "TaxCertificate"("clientProfileId", "annee")
  WHERE "issuedByCleanerProfileId" IS NULL;

CREATE UNIQUE INDEX "TaxCertificate_client_annee_intervenant_key"
  ON "TaxCertificate"("clientProfileId", "annee", "issuedByCleanerProfileId")
  WHERE "issuedByCleanerProfileId" IS NOT NULL;

CREATE INDEX "TaxCertificate_organizationId_annee_idx"
  ON "TaxCertificate"("organizationId", "annee");
CREATE INDEX "TaxCertificate_clientProfileId_annee_idx"
  ON "TaxCertificate"("clientProfileId", "annee");

ALTER TABLE "TaxCertificate"
  ADD CONSTRAINT "TaxCertificate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxCertificate_clientProfileId_fkey"
    FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxCertificate_issuedByCleanerProfileId_fkey"
    FOREIGN KEY ("issuedByCleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Régime de TVA de l'intervenant.
--
-- `FRANCHISE_EN_BASE` par défaut : c'est la situation de tout auto-entrepreneur
-- sous le seuil, donc de la quasi-totalité des intervenants. La mention
-- « TVA non applicable, article 293 B du CGI » en découle, et une facture qui
-- la porterait à tort — ou l'omettrait — serait irrégulière.
ALTER TABLE "CleanerProfile"
  ADD COLUMN "vatRegime" TEXT NOT NULL DEFAULT 'FRANCHISE_EN_BASE',
  ADD COLUMN "vatRateBp" INTEGER;

-- Régime de TVA de l'organisation émettrice.
--
-- La plateforme facture sa coordination pour son propre compte, et une société
-- cliente du SaaS facture ses prestations : les deux sont des émetteurs, et
-- leur régime n'est pas celui d'un auto-entrepreneur. C'est une donnée et non
-- une constante du code — l'écrire en dur obligerait à un déploiement pour la
-- corriger, et ferait porter la même mention à tout le monde.
--
-- La valeur par défaut mérite d'être vérifiée avant la première facture : une
-- mention de TVA fausse rend la facture irrégulière dans les deux sens.
ALTER TABLE "Organization"
  ADD COLUMN "vatRegime" TEXT NOT NULL DEFAULT 'FRANCHISE_EN_BASE',
  ADD COLUMN "vatRateBp" INTEGER;

-- La seconde porte reste fermée : toute table nouvelle porte la RLS.
-- Voir docs/SECURITE-ACCES.md et src/lib/acces-api.integration.test.ts.
ALTER TABLE "InvoiceSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxCertificate"  ENABLE ROW LEVEL SECURITY;
