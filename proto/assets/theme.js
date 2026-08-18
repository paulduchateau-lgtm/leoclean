/* Bascule entre les variantes du prototype.
   « tropical » — FF8243 · FFC0CB · FCE883 · 069494, mangue en action.
   « pop »    — coolors 6a46b8 · 63e6be · fec601 · ea7317, menthe en action.
   « menthe » — la palette du produit (src/styles/tokens), celle de dev.leoclean.fr.
   « foret »  — la palette leaf/clay/marigold du design system fourni en zip.
   Le choix est retenu d'une page à l'autre. Chargé dans <head> sans defer :
   le thème doit être posé avant le premier rendu, sinon la page clignote. */
(function () {
  /* La clé est versionnée : en changer remet tout le monde sur la variante
     du moment, sans quoi un choix fait avant son existence la masquerait. */
  var CLE = "proto-theme-v4";
  var ORDRE = ["tropical", "menthe", "pop", "foret"];
  var NOMS = {
    tropical: "tropical punch",
    pop: "pop (violet)",
    menthe: "menthe",
    foret: "vert forêt",
  };

  var theme;
  try {
    theme = localStorage.getItem(CLE);
  } catch (e) {
    /* stockage indisponible (navigation privée stricte) */
  }
  if (ORDRE.indexOf(theme) === -1) theme = ORDRE[0];
  document.documentElement.dataset.theme = theme;

  var bouton;
  function suivant() {
    return ORDRE[(ORDRE.indexOf(theme) + 1) % ORDRE.length];
  }
  function libelle() {
    return "Voir la variante " + NOMS[suivant()];
  }
  function basculer() {
    theme = suivant();
    try {
      localStorage.setItem(CLE, theme);
    } catch (e) {
      /* tant pis, le choix ne survivra pas à la page */
    }
    document.documentElement.dataset.theme = theme;
    bouton.textContent = libelle();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var banniere = document.querySelector(".proto-banner");
    if (!banniere) return;
    bouton = document.createElement("button");
    bouton.type = "button";
    bouton.textContent = libelle();
    bouton.style.cssText =
      "margin-left:12px;padding:4px 12px;border-radius:999px;border:1px solid currentColor;" +
      "background:transparent;color:inherit;font:600 12px/1.4 inherit;font-family:inherit;cursor:pointer";
    bouton.addEventListener("click", basculer);
    banniere.appendChild(bouton);
  });
})();
