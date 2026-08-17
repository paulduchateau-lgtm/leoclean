/**
 * Disponibilité des fonctions annoncées au public.
 *
 * Même logique que `fiscal.ts` : la page se prépare, la copy s'adapte, et rien
 * n'est affirmé à tort. Un site qui décrit au présent une fonction qui n'existe
 * pas fait une promesse — et une promesse faite à un indépendant qui organise
 * sa semaine dessus coûte davantage qu'une déception de lecteur.
 *
 * Trois états, et un seul point de bascule par fonction :
 *
 * - `live` — la fonction existe, la copy est au présent, aucun libellé.
 * - `beta` — elle existe partiellement, la copy porte « En test avec nos
 *   premiers intervenants ».
 * - `roadmap` — elle n'existe pas encore. Le bloc **reste visible**, au futur
 *   assumé, avec « Disponible au lancement ». On ne cache pas la fonction : on
 *   dit qu'elle n'est pas là. Ce qui est interdit, c'est la capture d'écran
 *   d'une interface inexistante ou une démonstration simulée.
 */

export type FeatureStage = "live" | "beta" | "roadmap";

export const FEATURES = {
  /** Lecture des disponibilités depuis l'agenda personnel de l'intervenant. */
  calendarSync: "roadmap" as FeatureStage,

  /** Ordonnancement des interventions d'une journée pour réduire la route. */
  routeOptimizer: "roadmap" as FeatureStage,

  /**
   * Espace intervenant : missions, planning, factures, messagerie.
   *
   * La phase 8 du dépôt, non commencée. Le drapeau existe pour que la page
   * d'offre décrive l'outil sans laisser croire qu'on peut s'y connecter
   * aujourd'hui.
   */
  espaceIntervenant: "roadmap" as FeatureStage,

  /**
   * Minutes de route économisées, mesurées.
   *
   * `null` tant que rien n'est mesuré, et rien ne s'affiche alors — ni chiffre,
   * ni fourchette, ni « jusqu'à ». Un gain annoncé sans mesure est
   * invérifiable par celui à qui on le promet, et c'est exactement le reproche
   * fait aux plateformes que cette page prétend ne pas imiter.
   */
  savedTravelMinutes: null as number | null,

  /**
   * Agenda Apple.
   *
   * Faux tant que la voie technique n'est pas tranchée : il n'existe pas d'API
   * serveur équivalente à celle de Google, et il faudrait passer par CalDAV ou
   * par un import ICS en lecture seule. Annoncer « Apple Calendrier » avant
   * cet arbitrage engagerait sur une intégration qui n'a pas de solution
   * retenue.
   */
  appleCalendar: false,
} as const;

/**
 * Libellé de disponibilité, ou `null` quand la fonction est livrée.
 *
 * Dérivé plutôt qu'écrit dans chaque bloc : c'est ce qui rend vrai « basculer
 * sur `live` ne demande aucune autre modification ».
 */
export function stageLabel(stage: FeatureStage): string | null {
  switch (stage) {
    case "live":
      return null;
    case "beta":
      return "En test avec nos premiers intervenants";
    case "roadmap":
      return "Disponible au lancement";
  }
}

/** La fonction est-elle utilisable aujourd'hui ? */
export function isAvailable(stage: FeatureStage): boolean {
  return stage === "live" || stage === "beta";
}

/**
 * Agendas que l'on peut annoncer.
 *
 * Une liste dérivée, parce qu'une phrase qui énumère « Google Agenda ou Apple
 * Calendrier » est précisément le genre de détail qu'on oublie de corriger le
 * jour où l'un des deux ne se fait pas.
 */
export const SUPPORTED_CALENDARS: readonly string[] = [
  "Google Agenda",
  ...(FEATURES.appleCalendar ? ["Apple Calendrier"] : []),
];
