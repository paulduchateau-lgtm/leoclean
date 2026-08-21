import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  type Coffre,
  type Stockage,
  FichierRefuseError,
  cheminDeFichier,
  nettoyer,
  verifierFichier,
} from "./index";

/**
 * Stockage objet compatible S3 — Scaleway Object Storage.
 *
 * **Rien n'est jamais servi en direct.** Le bucket est privé et le restera :
 * les photos de mission valent preuve de réalisation, les pièces
 * justificatives portent une identité. Une lecture passe par une URL signée de
 * soixante secondes, engendrée à la demande et jamais mise en cache — une URL
 * signée mise en cache est une URL publique à retardement.
 *
 * **La vérification et le nettoyage font partie du dépôt**, ici comme dans
 * l'implémentation mémoire : le type est reconnu par les octets et non par le
 * nom, et les métadonnées sont retirées. Sans cela il suffirait d'un chemin
 * d'appel distrait pour qu'une photo de salon arrive avec les coordonnées GPS
 * du domicile d'un client.
 *
 * Scaleway est compatible S3 mais pas identique : la région fait partie de
 * l'endpoint (`https://s3.fr-par.scw.cloud`) et `forcePathStyle` est nécessaire,
 * l'adressage par sous-domaine de bucket n'étant pas garanti sur tous les
 * points d'accès.
 */

export interface ConfigurationS3 {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Durée de validité d'une URL de lecture, en secondes. */
export const URL_SIGNEE_SECONDES = 60;

const TYPES_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

export function stockageS3(configuration: ConfigurationS3): Stockage {
  const client = new S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });

  return {
    async deposer({ coffre, proprietaireId, identifiant, octets }) {
      const verdict = verifierFichier(octets, coffre as Coffre);
      if ("refus" in verdict) {
        throw new FichierRefuseError(verdict.refus, verdict.refus);
      }

      const propre = nettoyer(octets, verdict.type);
      const chemin = cheminDeFichier(
        coffre as Coffre,
        proprietaireId,
        identifiant,
        verdict.type,
      );

      await client.send(
        new PutObjectCommand({
          Bucket: configuration.bucket,
          Key: chemin,
          Body: propre,
          ContentType: TYPES_MIME[verdict.type] ?? "application/octet-stream",
          /*
           * `private` est déjà le défaut d'un bucket privé, mais l'écrire ici
           * rend l'intention lisible sur la seule ligne où quelqu'un pourrait
           * un jour poser `public-read` par commodité.
           */
          ACL: "private",
        }),
      );

      return { chemin, type: verdict.type, taille: propre.length };
    },

    async lireUrl(chemin) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: configuration.bucket, Key: chemin }),
        { expiresIn: URL_SIGNEE_SECONDES },
      );
    },

    async supprimer(chemin) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: configuration.bucket,
          Key: chemin,
        }),
      );
    },
  };
}
