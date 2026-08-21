import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * `useSearchParams` n'a pas de contexte hors du routeur : le champ code
 * parrain le lit, et il est le seul à le faire. On le neutralise plutôt que de
 * monter un routeur, la question posée ici étant celle du contenu rendu.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const { default: TravaillerAvecNous, metadata } =
  await import("@/app/travailler-avec-nous/page");
const { PARRAINAGE, FACTS } = await import("@/lib/facts");

const html = renderToStaticMarkup(<TravaillerAvecNous />);
const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("landing intervenants — ce que la page ne doit jamais dire", () => {
  it("n'emploie aucun vocabulaire d'affectation", () => {
    // Ce n'est pas une préférence de ton. Un logiciel qui ordonne la journée
    // d'un indépendant est un indice de subordination s'il le subit, et n'en
    // est pas un s'il le pilote : la copy est en proposition, ou la page
    // devient une pièce à charge dans une requalification en salariat.
    for (const interdit of [
      "votre planning du jour",
      "on vous affecte",
      "nous vous affectons",
      "votre tournée",
      "vous devez accepter",
    ]) {
      expect(text.toLowerCase()).not.toContain(interdit);
    }
  });

  it("écrit bien la proposition et le refus", () => {
    expect(text).toMatch(/vous (est proposée|sont proposées|propose)/i);
    expect(text.toLowerCase()).toContain("vous acceptez ou vous refusez");
    expect(text.toLowerCase()).toContain("modifiable à tout moment");
  });

  it("n'invente aucune métrique d'activité", () => {
    expect(text).not.toMatch(
      /\d[\d\s]*(intervenants?|missions? réalisées?|avis)/i,
    );
    expect(text).not.toMatch(/intervenants? actifs?/i);
    expect(text).not.toMatch(/note moyenne/i);
  });

  it("n'écrit « garanti » qu'en disant contre quoi", () => {
    // Le mot est mérité depuis que les trois situations ont une réponse. Il
    // reste conditionné : la page ne l'écrit que parce que `canSayGuaranteed()`
    // l'y autorise, et les trois réponses sont sur la page, pas dans les CGU.
    expect(text.toLowerCase()).toContain("garanti");
    expect(text).toContain("Le client ne paie pas");
    expect(text).toContain("Le client paie en retard");
    expect(text).toContain("Le client annule tardivement");
    expect(text).not.toContain("date fixe");
  });

  it("ne promet aucune alerte automatique sur l'impayé", () => {
    // Le gel de l'intervention suivante est une règle tenue à la main : rien
    // ne pose `SUSPENDED` sur une réservation impayée, et aucune notification
    // ne part vers l'intervenant. L'annoncer comme un écran serait démenti au
    // premier impayé — c'est-à-dire au pire moment.
    expect(text).not.toMatch(
      /alerte automatique|vous êtes alerté|notification automatique/i,
    );
  });

  it("affiche le partage complet, chaque ligne déduite des deux autres", () => {
    // 28 € payés, 23 € nets, 5 € de coordination sur une heure — soit 84 €,
    // 69 € et 15 € sur l'exemple de trois heures. Aucune des trois n'est
    // écrite : la page les calcule, donc elles ne peuvent pas se contredire.
    expect(text).toContain("84,00 €");
    expect(text).toContain("69,00 €");
    expect(text).toContain("15,00 €");
  });

  it("ne marque plus rien « à préciser »", () => {
    // La pastille signalait une valeur non arbitrée. Les cinq le sont : elle
    // doit avoir disparu d'elle-même, sans autre modification que les valeurs
    // écrites dans `facts.ts` — c'est ce que promettait sa conception.
    expect(text).not.toContain("à préciser");
  });

  it("dit que les premières missions du filleul ne sont pas commissionnées", () => {
    // Le code n'est pas rétroactif : la commission court à partir de la
    // cinquième mission. La copy le dit plutôt que de le laisser découvrir au
    // premier versement.
    expect(text).toContain("sans rattrapage sur les précédentes");
  });

  it("n'affiche aucun gain de trajet chiffré", () => {
    expect(text).not.toMatch(/jusqu'à \d+ ?(min|minutes|%)/i);
    expect(text).not.toMatch(/\d+ ?minutes? économisées?/i);
  });

  it("n'emploie jamais « IA » comme argument", () => {
    // Le modèle de langage est mentionné pour ce qu'il fait réellement ici —
    // interpréter des contraintes écrites en texte libre — et rien d'autre.
    expect(text).not.toMatch(/\bIA\b/);
    expect(text).toContain("modèle de langage");
  });

  it("ne se présente pas comme une offre d'emploi", () => {
    // `JobPosting` induirait en erreur autant les moteurs que le candidat :
    // il ne s'agit pas d'un poste salarié.
    expect(html).not.toContain("JobPosting");
    expect(html).toContain("FAQPage");
  });

  it("ne présente pas le parrainage comme une démarche à effectuer", () => {
    // Un droit qu'il faut réclamer est un droit qui érode la confiance.
    for (const interdit of [
      "vous pouvez demander",
      "sur demande",
      "réclamer",
    ]) {
      expect(text.toLowerCase()).not.toContain(interdit);
    }
    expect(text).toContain("Vous percevez");
  });

  it("n'annonce pas un agenda dont la voie technique n'est pas tranchée", () => {
    expect(text).not.toContain("Apple");
    expect(text).toContain("Google Agenda");
  });
});

describe("landing intervenants — ce qu'elle doit dire", () => {
  it("ouvre sur la double porte, avant tout défilement", () => {
    // Un gérant de société ne doit pas lire trois écrans destinés aux
    // indépendants avant de comprendre qu'on lui parle aussi.
    const h1 = html.indexOf("<h1");
    const societes = html.indexOf("Je représente une société de ménage");
    const chiffres = html.indexOf("de trajet au maximum");

    expect(societes).toBeGreaterThan(h1);
    expect(societes).toBeLessThan(chiffres);
  });

  it("garde le bloc agenda collé au bloc qui dit ce qu'on en lit", () => {
    // Demander l'accès à l'agenda personnel d'un indépendant est une intrusion
    // réelle : rien ne doit s'intercaler entre la demande et ses limites.
    const journee = html.indexOf("Votre journée, rangée");
    const lecture = html.indexOf("Ce qu&#x27;on lit, ce qu&#x27;on ne lit pas");
    const suivant = html.indexOf("Comment ça se passe");

    expect(journee).toBeGreaterThan(-1);
    expect(lecture).toBeGreaterThan(journee);
    expect(suivant).toBeGreaterThan(lecture);
  });

  it("décrit les deux consentements séparément", () => {
    expect(text).toContain("deux autorisations");
    expect(text.toLowerCase()).toContain("heures occupées");
    expect(text.toLowerCase()).toContain("lieux");
  });

  it("dit que connecter son agenda est facultatif et sans effet sur les missions", () => {
    expect(text.toLowerCase()).toContain("la connexion est facultative");
    expect(text.toLowerCase()).toContain(
      "ne réduit pas les missions proposées",
    );
  });

  it("libelle toute fonction non livrée", () => {
    expect(text).toContain("Disponible au lancement");
  });

  it("tire le parrainage de FACTS, jamais de valeurs écrites à la main", () => {
    expect(text).toContain(`${PARRAINAGE.rateBp / 100} %`);
    expect(text).toContain(String(PARRAINAGE.qualifyingBookings));
    expect(text).toContain(`${PARRAINAGE.months} mois`);
    // Le plafond est la seule limite du dispositif : il est annoncé.
    expect(text).toMatch(/150,00\s?€|150\s?€/);
  });

  it("annonce le même rayon que la page client", () => {
    expect(text).toContain(`${FACTS.maxDriveMinutes} min`);
  });

  it("entre dans l'index, ses conditions étant arbitrées", () => {
    // `pageMetadata` ne pose plus de `robots` restrictif : la page suit la
    // règle générale du site, qui n'indexe que la production.
    expect(metadata.robots).toBeUndefined();
  });
});

describe("landing intervenants — les deux portes de l'espace professionnel", () => {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!);

  it("rend le retour vers le site client avant tout le reste", () => {
    // Quelqu'un qui cherchait un ménage chez lui doit repartir au premier
    // regard. Le critère vérifiable est l'ordre : le retour précède le titre,
    // donc il est lisible sans défilement.
    const retour = html.indexOf("Site client");
    const h1 = html.indexOf("<h1");

    expect(retour).toBeGreaterThan(-1);
    expect(retour).toBeLessThan(h1);
    expect(hrefs).toContain("/");
  });

  it("propose les deux entrées, jamais une seule", () => {
    // Les deux personnes qui pressent « Espace pro » ne cherchent pas la même
    // chose : l'une veut son planning, l'autre veut savoir comment commencer.
    // N'en servir qu'une en perdrait l'autre.
    expect(hrefs).toContain("/connexion?callbackUrl=/intervenant");
    expect(hrefs).toContain("/rejoindre");
  });

  it("vise la connexion, jamais l'espace intervenant en direct", () => {
    // `/intervenant` sait afficher son propre refus quand la session existe
    // sans porter le droit ; y envoyer un visiteur non connecté depuis une
    // page publique ferait un aller-retour de plus pour le même écran.
    expect(hrefs.filter((href) => href.startsWith("/intervenant"))).toEqual([]);
  });

  it("n'annonce aucun accès que le dossier ne donne pas encore", () => {
    // Se connecter ne donne l'espace qu'à un dossier activé. Annoncer un
    // tableau de bord serait démenti à l'écran suivant.
    expect(text.toLowerCase()).not.toContain("tableau de bord");
  });
});
