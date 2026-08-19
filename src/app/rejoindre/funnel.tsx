"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { ouvrirUnDossier } from "@/app/rejoindre/actions";
import { Button } from "@/components/ui/button";
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

type Question = "commune" | "deplacement" | "heures" | "experience" | "statut" | "identite";

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

export function FunnelCandidature({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState<Question>("commune");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [issue, setIssue] = useState<"ouvert" | "hors-zone" | null>(null);
  const [affiche] = useState(() => Date.now());

  const index = ORDRE.indexOf(question);

  function repondre(cle: Question, valeur: string) {
    setReponses((etat) => ({ ...etat, [cle]: valeur }));
    setErreur(null);
    const suivante = ORDRE[index + 1];
    if (suivante) setQuestion(suivante);
  }

  if (issue === "hors-zone") {
    return (
      <div
        role="status"
        className={`rounded-2xl border border-border bg-secondary/40 p-6 ${className ?? ""}`}
      >
        <p className="font-semibold">On n&apos;est pas encore chez vous.</p>
        <p className="mt-2 text-muted-foreground">
          On ouvre une commune quand quelqu&apos;un peut y travailler à moins de
          vingt minutes — c&apos;est ce qui rend tenable « toujours la même
          personne ». On garde vos coordonnées et on vous écrit le jour où
          c&apos;est le cas. Sans rien vous envoyer d&apos;autre entre-temps.
        </p>
      </div>
    );
  }

  if (issue === "ouvert") {
    return (
      <div
        role="status"
        className={`rounded-2xl border border-success/40 bg-success/10 p-6 ${className ?? ""}`}
      >
        <p className="font-semibold">Votre dossier est ouvert.</p>
        <p className="mt-2 text-muted-foreground">
          Un lien vient de partir vers votre email. Il vous permet de reprendre
          où vous en êtes, depuis n&apos;importe quel appareil — rien de ce que
          vous avez saisi n&apos;est perdu.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-card p-6 ${className ?? ""}`}>
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
            onClick={() => {
              setReponses((etat) => ({ ...etat, commune: "hors-zone" }));
              setQuestion("identite");
            }}
            className="min-h-12 rounded-full border border-dashed border-input bg-background px-4 text-base"
          >
            Une autre commune
          </button>
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
              const resultat = await ouvrirUnDossier({
                communeInsee: reponses.commune ?? "hors-zone",
                travelMode: (reponses.deplacement ?? "VEHICULE") as never,
                hoursPerWeek: (reponses.heures ?? "DE_20_A_35") as never,
                experience: (reponses.experience ?? "AUCUNE") as never,
                statut: (reponses.statut ?? "AUCUN") as never,
                firstName: String(donnees.get("firstName") ?? ""),
                lastName: String(donnees.get("lastName") ?? ""),
                phone: String(donnees.get("phone") ?? ""),
                email: String(donnees.get("email") ?? ""),
                website: String(donnees.get("website") ?? ""),
                renderedAt: affiche,
              });

              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              setIssue(
                "horsZone" in resultat.data && resultat.data.horsZone
                  ? "hors-zone"
                  : "ouvert",
              );
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
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
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

          <div aria-hidden="true" className="absolute -left-[9999px]">
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
