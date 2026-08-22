"use client";

import { Loader2Icon } from "lucide-react";
import { PhoneField } from "@/components/phone-field";
import Link from "next/link";
import { useState, useTransition } from "react";

import { requestMagicLink } from "@/app/(auth)/actions";
import { ouvrirUnDossier } from "@/app/rejoindre/actions";
import { BoutonsSociaux } from "@/components/boutons-sociaux";
import type { Fournisseur } from "@/lib/auth/fournisseurs";
import { Button } from "@/components/ui/button";
import {
  LIBELLES_PIECES,
  PIECES,
  PIECES_ENGENDRABLES,
} from "@/lib/candidature/parcours";
import { COMMUNES } from "@/lib/territory";

/**
 * L'éligibilité, en cinq questions.
 *
 * **Une question par écran, aucun compte.** Le compte se crée à la fin, sur le
 * lien magique — demander une inscription avant d'avoir montré quoi que ce soit
 * est le moyen le plus sûr de perdre quelqu'un qui hésite encore.
 *
 * **Aucune réponse ne disqualifie**, hormis la commune. « Je n'ai pas de
 * statut » et « aucune expérience » avancent au même titre que les autres : le
 * premier ouvre un accompagnement, le second se traite en entretien.
 */

type Question =
  "commune" | "deplacement" | "heures" | "experience" | "statut" | "identite";

const ORDRE: Question[] = [
  "commune",
  "deplacement",
  "heures",
  "experience",
  "statut",
  "identite",
];

const CHOIX = {
  deplacement: [
    ["VEHICULE", "En voiture"],
    ["DEUX_ROUES", "En deux-roues"],
    ["TRANSPORTS", "En transports"],
    ["A_PIED", "À pied"],
  ],
  heures: [
    ["MOINS_10", "Moins de 10 h"],
    ["DE_10_A_20", "10 à 20 h"],
    ["DE_20_A_35", "20 à 35 h"],
    ["PLUS_35", "Plus de 35 h"],
  ],
  experience: [
    ["AUCUNE", "Aucune"],
    ["OCCASIONNELLE", "Occasionnelle"],
    ["PLUSIEURS_ANNEES", "Plusieurs années"],
    ["PRO", "Professionnelle"],
  ],
  statut: [
    ["SIRET_ACTIF", "Oui, j'ai un SIRET actif"],
    ["EN_COURS", "C'est en cours de création"],
    ["AUCUN", "Non, pas encore"],
  ],
} as const;

const INTITULES: Record<Question, string> = {
  commune: "Vous habitez quelle commune ?",
  deplacement: "Comment vous déplacez-vous ?",
  heures: "Combien d'heures par semaine ?",
  experience: "Votre expérience du ménage à domicile ?",
  statut: "Avez-vous déjà un statut d'indépendant ?",
  identite: "Comment vous joindre ?",
};

export function FunnelCandidature({
  className,
  fournisseurs = [],
}: {
  className?: string;
  /** Fournisseurs sociaux réellement configurés. Vide, rien ne s'affiche. */
  fournisseurs?: readonly Fournisseur[];
}) {
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState<Question>("commune");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [issue, setIssue] = useState<"ouvert" | null>(null);
  /*
   * Commune tapée à la main, quand elle n'est pas dans le référentiel.
   * Habiter ailleurs n'empêche pas de travailler ici : la commune sert au
   * calcul de tournée, pas à l'éligibilité.
   */
  const [communeLibre, setCommuneLibre] = useState<string | null>(null);
  const [affiche] = useState(() => Date.now());
  /* L'adresse saisie, pour la nommer et pouvoir renvoyer le lien. */
  const [email, setEmail] = useState("");
  const [renvoye, setRenvoye] = useState(false);

  const index = ORDRE.indexOf(question);

  function repondre(cle: Question, valeur: string) {
    setReponses((etat) => ({ ...etat, [cle]: valeur }));
    setErreur(null);
    const suivante = ORDRE[index + 1];
    if (suivante) setQuestion(suivante);
  }

  if (issue === "ouvert") {
    return (
      <div role="status" className={className}>
        <div className="rounded-2xl border border-success/40 bg-success/10 p-6">
          <p className="font-semibold">Votre dossier est ouvert.</p>
          {/*
           * **Le lien n'est pas un accusé de réception, c'est la porte.**
           * L'écran annonçait « un lien vient de partir » comme une politesse,
           * et le dépôt des pièces se trouve derrière — donc personne ne
           * comprenait comment déposer quoi que ce soit. On nomme donc
           * l'adresse, on dit à quoi le lien sert, et on offre de le renvoyer :
           * un email qui n'arrive pas ferme le parcours entier.
           */}
          <p className="mt-2 text-pretty text-muted-foreground">
            <strong className="text-foreground">
              Ouvrez le lien que nous venons d&apos;envoyer à {email}
            </strong>{" "}
            : c&apos;est lui qui vous donne accès à votre dossier, et c&apos;est
            ainsi qu&apos;on s&apos;assure que personne d&apos;autre n&apos;y
            dépose de documents à votre place.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending || renvoye}
              onClick={() =>
                startTransition(async () => {
                  await requestMagicLink({
                    email,
                    callbackUrl: "/rejoindre/dossier",
                  });
                  /*
                   * On confirme l'envoi sans le conditionner au résultat : le
                   * même message quoi qu'il arrive, sinon ce bouton dirait qui
                   * possède un compte.
                   */
                  setRenvoye(true);
                })
              }
            >
              {renvoye ? "Lien renvoyé" : "Je n'ai rien reçu"}
            </Button>
            <Link
              href="/rejoindre/dossier"
              className="text-sm font-medium text-brand underline underline-offset-4"
            >
              J&apos;ai déjà cliqué sur le lien →
            </Link>
          </div>

          {/*
            **Le raccourci qui évite la boîte mail.** Le lien magique reste la
            voie par défaut — il vérifie l'adresse, et c'est sur elle que le
            dossier se rattache. Mais un candidat qui a un compte Google entre
            sans aller-retour, et un aller-retour par la messagerie est
            l'endroit où l'on perd le plus de candidatures.
            Le rattachement fonctionne pareil : ces fournisseurs vérifient
            l'adresse avant de la transmettre.
          */}
          {fournisseurs.length > 0 ? (
            <div className="mt-5 border-t border-success/30 pt-5">
              <p className="mb-3 text-sm text-muted-foreground">
                Ou entrez directement, sans passer par votre messagerie :
              </p>
              <BoutonsSociaux
                fournisseurs={fournisseurs}
                callbackUrl="/rejoindre/dossier"
                separateur={false}
              />
            </div>
          ) : null}
        </div>

        {/*
         * Ce bloc manquait, et son absence était le défaut le plus coûteux du
         * parcours : on répondait à six questions, on lisait « dossier
         * ouvert », et rien ne disait qu'il restait des pièces à fournir. La
         * personne repartait en croyant avoir postulé.
         *
         * La liste est **lue dans `parcours.ts`**, jamais recopiée : c'est
         * exactement celle qu'on promet aux clients sous « professionnels
         * vérifiés » et celle que la revue de dossier exige. Trois surfaces,
         * une seule vérité — une liste écrite ici finirait par en annoncer une
         * quatrième.
         */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-extrabold">
            Ce qu&apos;il vous restera à fournir
          </h2>
          <p className="mt-1 text-pretty text-muted-foreground">
            Rien à faire tout de suite. Vous les déposerez à votre rythme, une
            par une, et votre dossier avance entre-temps.
          </p>

          <ul className="mt-4 space-y-2">
            {PIECES.filter((piece) => !PIECES_ENGENDRABLES.includes(piece)).map(
              (piece) => (
                <li key={piece} className="flex gap-2">
                  <span aria-hidden className="text-brand">
                    ·
                  </span>
                  <span>{LIBELLES_PIECES[piece]}</span>
                </li>
              ),
            )}
          </ul>

          {/*
           * L'avis de situation SIRENE ne figure pas dans la liste : on le
           * récupère depuis l'INSEE. Faire télécharger au candidat ce qu'on
           * vient de lire est un abandon gratuit, et le dire évite qu'il le
           * cherche.
           */}
          <p className="mt-4 text-sm text-pretty text-muted-foreground">
            Votre avis de situation SIRENE, nous le récupérons pour vous.
          </p>

          <p className="mt-4 text-sm text-pretty text-muted-foreground">
            Vous les déposerez depuis votre dossier, une fois le lien ouvert.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-border bg-card p-6 ${className ?? ""}`}
    >
      <p className="font-mono text-sm text-muted-foreground">
        Question {index + 1} sur {ORDRE.length}
      </p>
      <h2 className="mt-2 font-heading text-2xl font-extrabold text-balance">
        {INTITULES[question]}
      </h2>

      {question === "commune" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {COMMUNES.map((commune) => (
            <button
              key={commune.insee}
              type="button"
              onClick={() => repondre("commune", commune.insee)}
              className="min-h-12 rounded-full border border-input bg-background px-4 text-base hover:border-brand"
            >
              {commune.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCommuneLibre("")}
            aria-pressed={communeLibre !== null}
            className="min-h-12 rounded-full border border-dashed border-input bg-background px-4 text-base"
          >
            Une autre commune
          </button>
        </div>
      ) : null}

      {/*
       * Une commune hors de nos seize n'arrête plus rien. Le rayon court est
       * une contrainte sur les **missions**, pas sur le domicile de celui qui
       * les fait : quelqu'un de Bordeaux centre dessert Villenave-d'Ornon sans
       * difficulté. On dit ce que cela implique, et on laisse continuer.
       */}
      {question === "commune" && communeLibre !== null ? (
        <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Où habitez-vous ?</span>
            <input
              autoFocus
              value={communeLibre}
              onChange={(event) => setCommuneLibre(event.target.value)}
              placeholder="Bordeaux, Pessac, Talence…"
              className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
            />
          </label>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Nos missions sont sur nos {COMMUNES.length} communes du sud de
            Bordeaux. Vous pouvez y travailler sans y habiter — on regardera
            ensemble si le trajet vous convient.
          </p>
          <Button
            className="mt-3"
            disabled={communeLibre.trim().length < 2}
            onClick={() => setQuestion("deplacement")}
          >
            Continuer
          </Button>
        </div>
      ) : null}

      {question !== "commune" && question !== "identite" ? (
        <div className="mt-5 flex flex-col gap-2">
          {CHOIX[question].map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              onClick={() => repondre(question, valeur)}
              className="min-h-13 rounded-xl border border-input bg-background px-4 text-left text-base hover:border-brand"
            >
              {libelle}
            </button>
          ))}
          {question === "statut" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune de ces réponses ne vous écarte. Sans statut, on vous
              accompagne jusqu&apos;au bout des démarches.
            </p>
          ) : null}
        </div>
      ) : null}

      {question === "identite" ? (
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const donnees = new FormData(event.currentTarget);
            setErreur(null);

            startTransition(async () => {
              const adresse = String(donnees.get("email") ?? "");
              setEmail(adresse);

              const resultat = await ouvrirUnDossier({
                ...(reponses.commune
                  ? { communeInsee: reponses.commune }
                  : { communeLibre: communeLibre ?? undefined }),
                travelMode: (reponses.deplacement ?? "VEHICULE") as never,
                hoursPerWeek: (reponses.heures ?? "DE_20_A_35") as never,
                experience: (reponses.experience ?? "AUCUNE") as never,
                statut: (reponses.statut ?? "AUCUN") as never,
                firstName: String(donnees.get("firstName") ?? ""),
                lastName: String(donnees.get("lastName") ?? ""),
                phone: String(donnees.get("phone") ?? ""),
                email: adresse,
                website: String(donnees.get("website") ?? ""),
                renderedAt: affiche,
              });

              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              setIssue("ouvert");
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Prénom</span>
              <input
                name="firstName"
                required
                maxLength={80}
                autoComplete="given-name"
                className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nom</span>
              <input
                name="lastName"
                required
                maxLength={80}
                autoComplete="family-name"
                className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Téléphone</span>
              <PhoneField
                id="rejoindre-phone"
                name="phone"
                required
                className="rounded-xl"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
              />
            </label>
          </div>

          {/*
           * Le piège doit être invisible **et** hors du flux. `-left-[9999px]`
           * ne l'était pas : Tailwind 4 n'émet pas cette forme, la classe
           * tombait, et le champ s'affichait en plein milieu du formulaire.
           * Un candidat qui écrivait dedans voyait sa candidature acceptée à
           * l'écran et jetée en silence — exactement ce que le piège doit
           * faire aux robots, appliqué à un humain. On reprend la boîte
           * collabée de `lead-form.tsx`, qui, elle, tient.
           */}
          <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
            <label>
              Ne rien écrire ici
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {erreur ? (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : null}
            Ouvrir mon dossier
          </Button>
          <p className="text-sm text-muted-foreground">
            On vous envoie un lien pour reprendre où vous en êtes. Pas de mot de
            passe à retenir.
          </p>
        </form>
      ) : null}

      {index > 0 && issue === null ? (
        <button
          type="button"
          onClick={() => setQuestion(ORDRE[index - 1]!)}
          className="mt-5 text-sm text-muted-foreground underline"
        >
          ← Revenir
        </button>
      ) : null}
    </div>
  );
}
