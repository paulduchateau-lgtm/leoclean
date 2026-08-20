import { randomUUID } from "node:crypto";

import "dotenv/config";

/**
 * Vérifie que le coffre répond réellement.
 *
 * Une configuration de stockage se croit bonne jusqu'au premier dépôt, qui a
 * lieu devant quelqu'un — un candidat qui téléverse sa pièce d'identité, un
 * intervenant qui photographie une pièce en fin de mission. Ce script fait le
 * même aller-retour, avec un fichier jetable, et **nomme ce qui manque** plutôt
 * que de rendre une trace d'erreur du SDK.
 *
 * Il écrit puis relit puis supprime : les trois droits dont le produit a
 * besoin, et aucun de plus. Une clé qui saurait écrire sans savoir supprimer
 * passerait un test de dépôt et échouerait à la première pièce remplacée.
 *
 * Usage :
 *   npm run stockage:verifier
 */

const REQUISES = [
  "SCALEWAY_S3_ENDPOINT",
  "SCALEWAY_S3_BUCKET",
  "SCALEWAY_ACCESS_KEY",
  "SCALEWAY_SECRET_KEY",
];

function echouer(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const fournisseur = process.env.STOCKAGE_PROVIDER;

if (fournisseur !== "scaleway") {
  echouer(
    `STOCKAGE_PROVIDER vaut « ${fournisseur ?? "rien" } », attendu « scaleway ».\n` +
      "  Sans elle, le dépôt est refusé et les écrans proposent le téléphone.",
  );
}

const manquantes = REQUISES.filter((nom) => !process.env[nom]);
if (manquantes.length > 0) {
  echouer(
    `Variables manquantes : ${manquantes.join(", ")}.\n` +
      "  Voir .env.example, section « Stockage objet ».",
  );
}

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
  await import("@aws-sdk/client-s3");
const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

const bucket = process.env.SCALEWAY_S3_BUCKET;
const endpoint = process.env.SCALEWAY_S3_ENDPOINT;
const region = process.env.SCALEWAY_S3_REGION ?? "fr-par";

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.SCALEWAY_ACCESS_KEY,
    secretAccessKey: process.env.SCALEWAY_SECRET_KEY,
  },
});

/* Un chemin qui ne peut appartenir à personne, et qui se reconnaît en console. */
const chemin = `verification/${randomUUID()}.txt`;
const contenu = `Vérification du coffre, ${new Date().toISOString()}`;

console.log(`Coffre  ${bucket}  (${region}, ${endpoint})`);

try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: chemin,
      Body: contenu,
      ContentType: "text/plain",
      ACL: "private",
    }),
  );
  console.log("  ✓ écriture");
} catch (erreur) {
  echouer(
    `Écriture refusée : ${erreur.name} — ${erreur.message}\n` +
      "  Vérifier que la clé d'API porte le droit d'écriture sur ce bucket,\n" +
      "  et que le nom du bucket et la région correspondent.",
  );
}

let url;
try {
  url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: chemin }),
    { expiresIn: 60 },
  );
} catch (erreur) {
  echouer(`URL signée impossible : ${erreur.message}`);
}

const reponse = await fetch(url);
if (!reponse.ok) {
  echouer(
    `L'URL signée rend ${reponse.status}.\n` +
      "  Le produit ne sert jamais un fichier en direct : si les URL signées ne\n" +
      "  fonctionnent pas, aucune pièce ne sera lisible.",
  );
}
const relu = await reponse.text();
if (relu !== contenu) {
  echouer("Le fichier relu diffère de celui qui a été écrit.");
}
console.log("  ✓ lecture par URL signée (60 s)");

/*
 * Le bucket doit être privé. On le vérifie en demandant le même objet **sans**
 * signature : une réponse 200 signifie que n'importe qui muni du chemin lirait
 * une pièce d'identité.
 */
const publique = await fetch(`${endpoint}/${bucket}/${chemin}`);
if (publique.ok) {
  echouer(
    "Le bucket répond SANS signature : il est public.\n" +
      "  Une pièce d'identité y serait lisible par quiconque connaît le chemin.\n" +
      "  Retirer la visibilité publique du bucket avant tout dépôt.",
  );
}
console.log(`  ✓ refus sans signature (${publique.status})`);

try {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: chemin }));
  console.log("  ✓ suppression");
} catch (erreur) {
  echouer(
    `Suppression refusée : ${erreur.message}\n` +
      "  Le droit de suppression est nécessaire : une pièce refusée est\n" +
      "  remplacée, et l'ancienne doit disparaître.",
  );
}

console.log("\nLe coffre est opérationnel.\n");
