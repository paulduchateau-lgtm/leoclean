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

  it("n'écrit pas « garanti » tant que la garantie n'est pas définie", () => {
    // Trois situations sans réponse : le mot ne veut rien dire, et l'employer
    // à vide le viderait aussi pour le jour où il sera mérité. On dit à la
    // place ce qu'on tient — le délai de versement — et jamais « à date fixe »,
    // qui décrirait un engagement mensuel qu'on ne prend pas.
    expect(text.toLowerCase()).not.toContain("garanti");
    expect(text).toContain("versé sous 5 jours ouvrés");
    expect(text).not.toContain("date fixe");
  });

  it("affiche le partage complet, chaque ligne déduite des deux autres", () => {
    // 29 € payés, 18 € nets, 11 € de coordination sur une heure — soit 87 €,
    // 54 € et 33 € sur l'exemple de trois heures. Aucune des trois n'est
    // écrite : la page les calcule, donc elles ne peuvent pas se contredire.
    expect(text).toContain("87,00 €");
    expect(text).toContain("54,00 €");
    expect(text).toContain("33,00 €");
  });

  it("marque encore ce qui n'est pas arbitré, sans l'inventer", () => {
    // Les trois situations de garantie n'ont pas de réponse : la page le
    // montre plutôt que de combler, et c'est aussi ce qui la tient hors de
    // l'index. Le jour où elles sont écrites, la pastille disparaît et le mot
    // « garanti » apparaît, sans autre modification.
    expect(text).toContain("à préciser");
    expect(text).toContain("Le client ne paie pas");
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

  it("reste hors de l'index tant que ses conditions ne sont pas arbitrées", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
