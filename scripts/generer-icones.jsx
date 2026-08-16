#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";

import { ImageResponse } from "next/og";

/**
 * Icônes d'application, engendrées une fois et versionnées.
 *
 * Elles sont produites plutôt que dessinées, pour la même raison que les cartes
 * de partage : le symbole et les couleurs viennent du design system, et une
 * icône redessinée à la main finirait par ne plus lui ressembler. Le résultat
 * est écrit dans `public/` et suivi en versions — un manifeste doit pointer
 * vers des fichiers stables, pas vers des routes au nom haché.
 *
 * Usage : node scripts/generer-icones.mjs
 */

const projet = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Couleurs recopiées du design system.
 *
 * Troisième surface où la règle ne peut pas s'appliquer — après l'email de
 * connexion et les cartes de partage — le moteur de rendu ne voyant pas la
 * feuille de styles. Chaque valeur porte le nom de son token.
 */
const MINT_400 = "#63e6be";
const INK_900 = "#16261f";

/**
 * Le symbole, sur fond menthe et tracé encre.
 *
 * La menthe pleine porte de l'encre, jamais du blanc : à 400 elle est trop
 * claire pour tenir le contraste. C'est la même règle que pour les boutons.
 *
 * `padding` ouvre la zone de sécurité des icônes masquables : Android peut
 * découper jusqu'à 20 % de chaque bord, et un symbole cadré au plus juste s'y
 * ferait rogner les pointes.
 */
function icone(taille, padding) {
  const dessin = taille - padding * 2;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: MINT_400,
      }}
    >
      <svg
        width={dessin}
        height={dessin}
        viewBox="165 27 57 57"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M184.59 46.6295C188.186 43.0118 191.333 38.8101 193.667 34.323C195.98 38.8375 199.157 43.0525 202.786 46.6663C206.429 50.295 210.681 53.4715 215.225 55.8017C210.686 58.1462 206.443 61.3392 202.809 64.9748C199.19 68.595 196.019 72.8098 193.704 77.3101C191.373 72.8182 188.223 68.5988 184.625 64.9653C181.015 61.3212 176.807 58.1176 172.288 55.7713C176.789 53.4344 180.985 50.2559 184.59 46.6295Z"
          stroke={INK_900}
          strokeWidth="8"
          strokeMiterlimit="16"
        />
      </svg>
    </div>
  );
}

/** `padding` en proportion : serré pour les icônes classiques, ample pour les masquables. */
const CIBLES = [
  { fichier: "icone-192.png", taille: 192, ratio: 0.12 },
  { fichier: "icone-512.png", taille: 512, ratio: 0.12 },
  { fichier: "icone-192-masquable.png", taille: 192, ratio: 0.22 },
  { fichier: "icone-512-masquable.png", taille: 512, ratio: 0.22 },
  { fichier: "apple-touch-icon.png", taille: 180, ratio: 0.14 },
];

async function main() {
  for (const { fichier, taille, ratio } of CIBLES) {
    const response = new ImageResponse(icone(taille, taille * ratio), {
      width: taille,
      height: taille,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const destination = path.join(projet, "public", fichier);
    fs.writeFileSync(destination, buffer);
    console.log(`${fichier} — ${taille}×${taille}, ${buffer.length} octets`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
