import { describe, expect, it } from "vitest";

import {
  FEATURES,
  SUPPORTED_CALENDARS,
  isAvailable,
  stageLabel,
} from "@/lib/features";

describe("disponibilité des fonctions annoncées", () => {
  it("ne pose aucun libellé sur une fonction livrée", () => {
    expect(stageLabel("live")).toBeNull();
  });

  it("annonce clairement ce qui n'est pas encore là", () => {
    // Le bloc reste visible : on ne cache pas la fonction, on dit qu'elle
    // n'existe pas encore. Ce qui est interdit, c'est de la décrire au présent
    // sans le dire.
    expect(stageLabel("roadmap")).toBe("Disponible au lancement");
    expect(stageLabel("beta")).toBe("En test avec nos premiers intervenants");
  });

  it("ne tient pour disponible que ce qui l'est", () => {
    expect(isAvailable("live")).toBe(true);
    expect(isAvailable("beta")).toBe(true);
    expect(isAvailable("roadmap")).toBe(false);
  });

  it("n'affiche aucun gain de trajet tant que rien n'est mesuré", () => {
    // Un gain annoncé sans mesure est invérifiable par celui à qui on le
    // promet — exactement le reproche fait aux plateformes que cette page
    // prétend ne pas imiter. Ni chiffre, ni fourchette, ni « jusqu'à ».
    expect(FEATURES.savedTravelMinutes).toBeNull();
  });

  it("n'annonce pas d'agenda dont la voie technique n'est pas tranchée", () => {
    // Apple ne fournit pas d'API serveur équivalente à celle de Google : il
    // faudrait passer par CalDAV ou par un import ICS. Tant que ce n'est pas
    // arbitré, la page ne nomme que Google.
    expect(FEATURES.appleCalendar).toBe(false);
    expect(SUPPORTED_CALENDARS).toEqual(["Google Agenda"]);
    expect(SUPPORTED_CALENDARS).not.toContain("Apple Calendrier");
  });
});
