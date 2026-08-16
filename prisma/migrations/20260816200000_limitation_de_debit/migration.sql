-- ---------------------------------------------------------------------------
-- Limitation de débit.
--
-- Le compteur vit en base plutôt qu'en mémoire : un déploiement sans serveur
-- n'a pas de mémoire partagée, et un compteur par instance ne compte rien.
--
-- `key` porte l'action et la source. L'adresse IP y figure sous forme de
-- condensat : un compteur n'a pas besoin de savoir qui, seulement combien.
-- ---------------------------------------------------------------------------
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- Les fenêtres périmées se purgent par balayage : sans cet index, la purge
-- deviendrait un parcours complet à mesure que la table grossit.
CREATE INDEX "RateLimit_windowAt_idx" ON "RateLimit"("windowAt");
