/* ==========================================================================
   Léo Clean — logique du tunnel de réservation (prototype)

   Rien n'est envoyé nulle part : le prototype sert à faire relire un parcours,
   pas à prendre des réservations. Les six écrans, leur ordre, les tarifs et les
   règles d'arrondi sont ceux du produit — voir CLAUDE.md et src/lib/pricing/.
   ========================================================================== */

/* --- Territoire ------------------------------------------------------------
   Communes et codes postaux repris de src/lib/territory.ts. */
const COMMUNES = [
  { nom: "Villenave-d’Ornon", cp: "33140" },
  { nom: "Gradignan", cp: "33170" },
  { nom: "Cestas", cp: "33610" },
  { nom: "Léognan", cp: "33850" },
  { nom: "Cadaujac", cp: "33140" },
  { nom: "La Brède", cp: "33650" },
  { nom: "Saint-Selve", cp: "33650" },
  { nom: "Martillac", cp: "33650" },
  { nom: "Saucats", cp: "33650" },
  { nom: "Saint-Médard-d’Eyrans", cp: "33650" },
  { nom: "Castres-Gironde", cp: "33640" },
  { nom: "Beautiran", cp: "33640" },
  { nom: "Cabanac-et-Villagrains", cp: "33650" },
  { nom: "Saint-Morillon", cp: "33650" },
  { nom: "Ayguemorte-les-Graves", cp: "33640" },
  { nom: "Isle-Saint-Georges", cp: "33640" },
];

/* Communes voisines hors zone : elles servent à répondre « non » nommément
   plutôt que par le silence. Un refus qui nomme la commune se comprend ;
   un champ qui ne réagit pas passe pour une panne. */
const HORS_ZONE = [
  "Bordeaux",
  "Pessac",
  "Talence",
  "Bègles",
  "Mérignac",
  "Canéjan",
  "Le Barp",
  "Langon",
];

/* --- Grille tarifaire ------------------------------------------------------
   Recopiée de src/lib/pricing/public-grid.ts. Le taux régulier couvre les deux
   rythmes récurrents ; le ponctuel s'applique à l'intervention unique. */
const TAUX = { REGULIER: 2800, PONCTUEL: 3000 }; // centimes par heure
const SURFACE_PAR_HEURE = 25; // m² traités en une heure
const OPTION_MINUTES = 30; // chaque option allonge la durée d'une demi-heure

const DUREES = [120, 150, 180, 210, 240, 300, 360]; // minutes, du minimum au plafond

const OPTIONS = [
  { id: "repassage", label: "Repassage", detail: "Une corbeille de linge" },
  {
    id: "vitres",
    label: "Vitres",
    detail: "Les fenêtres accessibles sans échelle",
  },
  { id: "four", label: "Four et plaques", detail: "Dégraissage complet" },
];

const RYTHMES = [
  {
    id: "WEEKLY",
    label: "Chaque semaine",
    hint: "Tarif régulier, intervenant attitré",
    taux: "REGULIER",
    icone: "repeat",
  },
  {
    id: "BIWEEKLY",
    label: "Tous les quinze jours",
    hint: "La formule la plus demandée",
    taux: "REGULIER",
    icone: "calendar-days",
    badge: "Le + choisi",
  },
  {
    id: "ONE_OFF",
    label: "Une seule fois",
    hint: "Sans engagement, tarif ponctuel",
    taux: "PONCTUEL",
    icone: "calendar",
  },
];

const HEURES = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "16:00",
  "16:30",
  "17:00",
];

/* Les six écrans, dans l'ordre. Le libellé du bouton annonce l'écran suivant :
   « continuer » ne dit pas vers quoi, et c'est précisément ce qu'on veut dire. */
const ETAPES = [
  { id: "adresse", titre: "Adresse", cta: "Choisir ma durée" },
  { id: "logement", titre: "Durée", cta: "Choisir mon rythme" },
  { id: "rythme", titre: "Rythme", cta: "Choisir mon créneau" },
  { id: "creneau", titre: "Créneau", cta: "Saisir mes coordonnées" },
  { id: "coordonnees", titre: "Coordonnées", cta: "Voir le récapitulatif" },
  { id: "recapitulatif", titre: "Récapitulatif", cta: "Envoyer ma demande" },
];

/* --- État ---------------------------------------------------------------- */
const etat = {
  etape: "adresse",
  adresse: "",
  commune: null, // objet de COMMUNES, ou null tant que le secteur n'est pas reconnu
  refus: null, // commune reconnue mais hors zone
  duree: 180,
  options: new Set(),
  rythme: "BIWEEKLY", // le rythme par défaut du produit
  jour: null, // index dans JOURS
  creneau: null,
  replis: new Set(),
};

/* --- Calendrier -----------------------------------------------------------
   Dix jours à partir de demain. Les dimanches et un jour sur cinq sont
   complets : une journée pleine s'affiche barrée plutôt que de disparaître,
   sinon son absence passe pour un défaut d'affichage. */
const JOURS = (() => {
  const jours = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 11; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const complet = d.getDay() === 0 || i === 4;
    /* Indisponibilités d'exemple, stables d'un rendu à l'autre. */
    const indispo = complet
      ? [...HEURES]
      : HEURES.filter((_, h) => (h + i) % 4 === 0);
    jours.push({ date: d, complet, indispo });
  }
  return jours;
})();

const JOURS_SEMAINE = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const JOURS_ENTIERS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « Mercredi 19 août » — mois en minuscule, comme le veut le design system. */
const libelleJour = (d) =>
  `${JOURS_ENTIERS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;

/* --- Calculs -------------------------------------------------------------- */

/** Durée réellement facturée : la durée choisie, plus 30 min par option. */
function dureeTotale() {
  return etat.duree + etat.options.size * OPTION_MINUTES;
}

/** Prix d'une session, en centimes. Taux horaire × durée, au prorata. */
function prixCents() {
  const taux = TAUX[RYTHMES.find((r) => r.id === etat.rythme).taux];
  return Math.round((taux * dureeTotale()) / 60);
}

/** Formatage à la française : virgule décimale, espace insécable avant l'unité. */
function euros(cents) {
  const v = cents / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
  return s + " €";
}

function heuresLisibles(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** Surface habituellement couverte par une durée — indicative, jamais facturée. */
function surfacePour(minutes) {
  return Math.floor((minutes / 60) * SURFACE_PAR_HEURE);
}

/** Comparaison insensible aux accents, à la casse et aux apostrophes. */
const normaliser = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’-]/g, " ");

/**
 * Le morceau de la saisie qui peut désigner une commune.
 *
 * On tape « 12 rue des Vignes, Léogn » : chercher la chaîne entière dans un nom
 * de commune ne trouve évidemment rien. C'est ce qui suit la dernière virgule
 * qui porte la commune, et à défaut de virgule, les derniers mots.
 */
function fragmentsCommune(saisie) {
  const n = normaliser(saisie).trim();
  if (!n) return [];
  const mots = n.split(/\s+/);
  return [
    n.split(",").pop().trim(),
    mots.slice(-2).join(" "),
    mots[mots.length - 1],
    n,
  ].filter((f) => f.length >= 2);
}

/**
 * Remplace le morceau de commune en cours de frappe par la commune choisie.
 *
 * « 12 rue des Vignes, Léogn » suivi d'un clic sur Léognan doit rendre
 * « 12 rue des Vignes, Léognan » — pas « …, Léogn, Léognan ». On retire donc ce
 * qui était en train d'être tapé plutôt que d'ajouter à la suite.
 */
function completerAvec(saisie, commune) {
  const brut = saisie.trim();
  if (!brut) return commune.nom;
  const morceaux = brut
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  let dernier = morceaux.pop() || "";
  const estAmorce = (t) =>
    t.length > 1 &&
    (normaliser(commune.nom).startsWith(normaliser(t)) || /^\d{2,5}$/.test(t));

  if (estAmorce(dernier)) {
    dernier = "";
  } else {
    /* Sans virgule, l'amorce est le ou les derniers mots : « 8 allée du Parc
       gradi » doit rendre « 8 allée du Parc, Gradignan », pas garder « gradi ». */
    const mots = dernier.split(/\s+/);
    for (const n of [2, 1]) {
      if (mots.length > n && estAmorce(mots.slice(-n).join(" "))) {
        dernier = mots.slice(0, -n).join(" ");
        break;
      }
    }
  }
  return [...morceaux, ...(dernier ? [dernier] : []), commune.nom].join(", ");
}

/* --- Rendu ---------------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);
const icone = (nom, taille) =>
  `<svg class="i${taille ? " i-" + taille : ""}"><use href="#i-${nom}"/></svg>`;

function rendreEtapes() {
  const index = ETAPES.findIndex((e) => e.id === etat.etape);
  $("#steps").innerHTML = ETAPES.map((e, i) => {
    const cls = i < index ? "is-done" : i === index ? "is-current" : "";
    const dot = i < index ? icone("check", "14") : i + 1;
    const barre =
      i < ETAPES.length - 1
        ? `<span class="bar${i < index ? " is-done" : ""}"></span>`
        : "";
    return `<div class="step ${cls}"><span class="dot">${dot}</span><span class="step-label">${e.titre}</span></div>${barre}`;
  }).join("");
  $("#announce").textContent =
    `Étape ${index + 1} sur ${ETAPES.length} : ${ETAPES[index].titre}`;
}

/* --- Écran 1 : adresse et couverture -------------------------------------- */

/** Reconnaît une commune dans ce qui a été tapé : nom, ou code postal. */
function reconnaitre(saisie) {
  const n = normaliser(saisie);
  if (n.trim().length < 3) return { commune: null, refus: null };
  const parCode = COMMUNES.filter((c) => n.includes(c.cp));
  /* Un code postal peut couvrir deux communes : on ne tranche pas à sa place. */
  if (parCode.length === 1) return { commune: parCode[0], refus: null };
  const parNom = COMMUNES.find((c) => n.includes(normaliser(c.nom)));
  if (parNom) return { commune: parNom, refus: null };
  const dehors = HORS_ZONE.find((v) => n.includes(normaliser(v)));
  return { commune: null, refus: dehors || null };
}

/** Referme la liste **et** la vide : une suggestion périmée mais présente dans
    le document reste atteignable au clavier, et se ferait lire à voix haute. */
function fermerSuggestions() {
  const boite = $("#suggestions");
  boite.classList.remove("is-open");
  boite.innerHTML = "";
}

function rendreSuggestions() {
  const saisie = $("#adresse").value;
  const boite = $("#suggestions");
  const fragments = fragmentsCommune(saisie);
  /* Rien à suggérer si la commune est déjà reconnue : la liste masquerait
     l'encart de couverture, qui est la réponse attendue. */
  if (etat.commune || !fragments.length) {
    fermerSuggestions();
    return;
  }
  const trouvees = COMMUNES.filter((c) =>
    fragments.some((f) => normaliser(c.nom).includes(f) || c.cp.startsWith(f)),
  ).slice(0, 5);
  if (!trouvees.length) {
    fermerSuggestions();
    return;
  }
  boite.innerHTML = trouvees
    .map(
      (c) =>
        `<button type="button" data-suggestion="${c.nom}">${c.nom}<span class="t">${c.cp}</span></button>`,
    )
    .join("");
  boite.classList.add("is-open");
}

function rendreCouverture() {
  const hote = $("#coverage");
  if (etat.commune) {
    hote.innerHTML = `<div class="coverage ok">${icone("shield-check")}
      <span class="txt"><b>Nous intervenons à ${etat.commune.nom} (${etat.commune.cp})</b>
      Même tarif que partout ailleurs sur le secteur. Nous vous demanderons le numéro et l’étage au dernier écran.</span></div>`;
  } else if (etat.refus) {
    hote.innerHTML = `<div class="coverage ko">${icone("triangle-alert")}
      <span class="txt"><b>Nous n’intervenons pas encore à ${etat.refus}</b>
      Nos intervenants habitent les seize communes du sud de Bordeaux, et c’est ce qui nous permet de garder votre créneau d’une semaine sur l’autre. Écrivez-nous si vous voulez être prévenu quand nous nous en approchons.</span></div>`;
  } else {
    hote.innerHTML = "";
  }
  $("#communes-list").innerHTML = COMMUNES.map(
    (c) => `<span>${c.nom} ${c.cp}</span>`,
  ).join("");
}

/* --- Écran 2 : durée ------------------------------------------------------ */

function rendreDurees() {
  $("#durations").innerHTML = DUREES.map(
    (
      d,
    ) => `<button type="button" class="duration${etat.duree === d ? " is-on" : ""}" data-duree="${d}">
      <b>${heuresLisibles(d)}</b><span>idéal pour ${surfacePour(d)} m² environ</span></button>`,
  ).join("");

  $("#slider").value = String(etat.duree);
  $("#slider-value").textContent = heuresLisibles(etat.duree);
  $("#slider-hint").textContent =
    `Idéal pour ${surfacePour(etat.duree)} m² environ.`;

  $("#options").innerHTML = OPTIONS.map(
    (
      o,
    ) => `<label class="checkbox"><input type="checkbox" data-option="${o.id}"${etat.options.has(o.id) ? " checked" : ""}>
      <span class="box">${icone("check", "14")}</span>
      <span class="checkbox-text"><b>${o.label}</b><span>${o.detail} · +30 min</span></span></label>`,
  ).join("");
}

/* --- Écran 3 : rythme ----------------------------------------------------- */

function rendreRythmes() {
  $("#frequencies").innerHTML = RYTHMES.map((r) => {
    const taux = TAUX[r.taux];
    const prix = Math.round((taux * dureeTotale()) / 60);
    return `<button type="button" class="option${etat.rythme === r.id ? " is-selected" : ""}" data-rythme="${r.id}">
      <span class="bubble">${icone(r.icone, "24")}</span>
      <span class="option-body">
        <span class="option-title">${r.label}${r.badge ? `<span class="pill-badge">${r.badge}</span>` : ""}</span>
        <span class="option-desc">${r.hint} · ${euros(taux)}/h</span>
      </span>
      <span class="option-price">${euros(prix)}<small>par session de ${heuresLisibles(dureeTotale())}</small></span>
      <span class="option-check">${icone("check", "14")}</span>
    </button>`;
  }).join("");
}

/* --- Écran 4 : calendrier ------------------------------------------------- */

function rendreCalendrier() {
  if (etat.jour === null) etat.jour = JOURS.findIndex((j) => !j.complet);

  $("#days").innerHTML = JOURS.map((j, i) => {
    const d = j.date;
    return `<button type="button" class="day-btn${etat.jour === i ? " is-on" : ""}" data-jour="${i}"${j.complet ? " disabled" : ""}>
      <span class="dow">${JOURS_SEMAINE[d.getDay()]}</span>
      <span class="dom">${d.getDate()}</span>
      <span class="mon">${MOIS[d.getMonth()].slice(0, 4)}</span></button>`;
  }).join("");

  const jour = JOURS[etat.jour];
  $("#day-title").textContent =
    libelleJour(jour.date) + (jour.complet ? " — complet" : "");
  $("#hours").innerHTML = HEURES.map((h) => {
    const id = `${libelleJour(jour.date)}·${h}`;
    const off = jour.indispo.includes(h);
    const classe =
      etat.creneau === id ? " is-on" : etat.replis.has(id) ? " is-alt" : "";
    return `<button type="button" class="hour${classe}" data-creneau="${id}"${off ? " disabled" : ""}>${h}</button>`;
  }).join("");

  $("#slot-hint").innerHTML = etat.creneau
    ? `Créneau retenu : <b>${etat.creneau.replace("·", " à ")}</b>. Cliquez d’autres heures, même un autre jour, pour en faire des replis (${etat.replis.size}/4).`
    : "Cliquez l’heure qui vous arrange le mieux.";
}

/* --- Récapitulatif -------------------------------------------------------- */

function lignesRecap() {
  const rythme = RYTHMES.find((r) => r.id === etat.rythme);
  const opts = [...etat.options].map(
    (id) => OPTIONS.find((o) => o.id === id).label,
  );
  return [
    [
      "Adresse",
      etat.commune ? etat.adresse.trim() || etat.commune.nom : "—",
      "adresse",
    ],
    [
      "Durée",
      heuresLisibles(dureeTotale()) +
        (etat.options.size ? " (options comprises)" : ""),
      "logement",
    ],
    ["Options", opts.length ? opts.join(", ") : "aucune", "logement"],
    ["Rythme", rythme.label, "rythme"],
    [
      "Créneau",
      etat.creneau ? etat.creneau.replace("·", " à ") : "—",
      "creneau",
    ],
    [
      "Replis",
      etat.replis.size
        ? `${etat.replis.size} créneau${etat.replis.size > 1 ? "x" : ""}`
        : "aucun",
      "creneau",
    ],
  ];
}

function rendreRecap() {
  /* « modifier » ne s'affiche que sur les écrans déjà traversés : proposer de
     revenir sur une réponse qu'on n'a pas encore posée ferait sauter des
     étapes, et l'ordre du tunnel est ce qui garde la friction croissante. */
  const courant = ETAPES.findIndex((e) => e.id === etat.etape);
  $("#recap-lines").innerHTML = lignesRecap()
    .map(([k, v, etape]) => {
      const rang = ETAPES.findIndex((e) => e.id === etape);
      return `<div class="l"><span>${k}</span><b>${v}${
        rang < courant
          ? `<button type="button" data-aller="${etape}">modifier</button>`
          : ""
      }</b></div>`;
    })
    .join("");

  const rythme = RYTHMES.find((r) => r.id === etat.rythme);
  const taux = TAUX[rythme.taux];
  const lignes = [
    [
      `Ménage ${heuresLisibles(etat.duree)}`,
      euros(Math.round((taux * etat.duree) / 60)),
    ],
  ];
  if (etat.options.size) {
    lignes.push([
      `Options (+${etat.options.size * OPTION_MINUTES} min)`,
      euros(Math.round((taux * etat.options.size * OPTION_MINUTES) / 60)),
    ]);
  }
  lignes.push(["Frais de service", "aucun"]);

  /* Aucune mention de crédit d'impôt dans le tunnel : le montant affiché est
     celui qui sera prélevé. La réduction s'explique sur la page tarifs. */
  const bloc = `
    ${lignes.map(([k, v], i) => `<div class="line${i === lignes.length - 1 ? " is-muted" : ""}"><span>${k}</span><b>${v}</b></div>`).join("")}
    <div class="rule"></div>
    <div class="total"><span class="k">Par session</span><span class="v">${euros(prixCents())}</span></div>
    <div class="note">${icone("info", "18")}<span>Rien n’est prélevé aujourd’hui. La préautorisation part 24 h avant l’intervention, le débit 24 h après.</span></div>`;
  $("#recap-price").innerHTML = bloc;

  /* L'écran de confirmation porte déjà l'encart sur le moment du prélèvement :
     le répéter dans le bloc de prix dirait deux fois la même chose. */
  const cPrice = $("#c-price");
  if (cPrice)
    cPrice.innerHTML = bloc.slice(0, bloc.indexOf('<div class="note">'));

  $("#sticky-price").textContent = euros(prixCents());
  $("#sticky-detail").textContent =
    `${heuresLisibles(dureeTotale())} · ${rythme.label.toLowerCase()}`;
}

/** Ce qui manque pour avancer. Null si l'écran est complet. */
function blocage() {
  if (etat.etape === "adresse" && !etat.commune) {
    return etat.refus
      ? "Cette commune n’est pas desservie."
      : "Indiquez votre adresse ou votre commune.";
  }
  if (etat.etape === "creneau" && !etat.creneau)
    return "Choisissez un créneau.";
  if (etat.etape === "recapitulatif" && !$("#cgu").checked)
    return "Acceptez les conditions de réservation.";
  return null;
}

function rendreNav() {
  const index = ETAPES.findIndex((e) => e.id === etat.etape);
  const etape = ETAPES[index];
  const dernier = index === ETAPES.length - 1;
  const empeche = blocage();
  $("#nav").innerHTML = `
    ${index > 0 ? `<button type="button" class="btn btn-lg btn-secondary" data-retour>${icone("arrow-left", "18")}Retour</button>` : ""}
    <button type="button" class="btn btn-lg" data-suivant${empeche ? " disabled" : ""}>
      ${etape.cta}${icone(dernier ? "check" : "arrow-right", "18")}
    </button>
    ${empeche ? `<span class="caption">${empeche}</span>` : ""}`;
  $("#sticky-next").disabled = !!empeche;
  $("#sticky-next").innerHTML =
    etape.cta + icone(dernier ? "check" : "arrow-right", "18");
}

function rendre() {
  document.querySelectorAll("[data-step]").forEach((s) => {
    s.hidden = s.dataset.step !== etat.etape;
  });
  rendreEtapes();
  if (etat.etape === "adresse") rendreCouverture();
  if (etat.etape === "logement") rendreDurees();
  if (etat.etape === "rythme") rendreRythmes();
  if (etat.etape === "creneau") rendreCalendrier();
  if (etat.etape === "recapitulatif") {
    const champ = $("#adresse-confirm");
    if (!champ.value)
      champ.value =
        etat.adresse.trim() || (etat.commune ? etat.commune.nom : "");
  }
  rendreRecap();
  rendreNav();
}

/* --- Navigation ------------------------------------------------------------
   Chaque écran s'écrit dans l'historique : sur mobile, le retour arrière est le
   geste le plus employé, et sans cela son effet serait de tout perdre. */
function aller(etape, pousser = true) {
  etat.etape = etape;
  if (pousser) history.pushState({ etape }, "", "#" + etape);
  window.scrollTo({ top: 0, behavior: "smooth" });
  rendre();
}

window.addEventListener("popstate", (e) => {
  const etape = (e.state && e.state.etape) || ETAPES[0].id;
  /* Revenir depuis la confirmation doit rendre le tunnel, pas seulement changer
     l'écran actif sous un écran de confirmation resté affiché. */
  if (etape !== "confirmation") {
    $("#confirmation").hidden = true;
    $("#funnel").hidden = false;
    $("#sticky").style.display = "";
    etat.etape = etape;
    rendre();
  }
});

/* --- Écoutes -------------------------------------------------------------- */

$("#adresse").addEventListener("input", (e) => {
  etat.adresse = e.target.value;
  const { commune, refus } = reconnaitre(e.target.value);
  etat.commune = commune;
  etat.refus = refus;
  rendreSuggestions();
  rendreCouverture();
  rendreRecap();
  rendreNav();
});

document.addEventListener("click", (e) => {
  const suggestion = e.target.closest("[data-suggestion]");
  if (suggestion) {
    const commune = COMMUNES.find(
      (c) => c.nom === suggestion.dataset.suggestion,
    );
    $("#adresse").value = completerAvec($("#adresse").value, commune);
    etat.adresse = $("#adresse").value;
    etat.commune = commune;
    etat.refus = null;
    fermerSuggestions();
    rendre();
    return;
  }
  if (!e.target.closest(".address-box")) fermerSuggestions();

  const duree = e.target.closest("[data-duree]");
  if (duree) {
    etat.duree = Number(duree.dataset.duree);
    rendre();
    return;
  }

  const rythme = e.target.closest("[data-rythme]");
  if (rythme) {
    etat.rythme = rythme.dataset.rythme;
    rendre();
    return;
  }

  const jour = e.target.closest("[data-jour]");
  if (jour && !jour.disabled) {
    etat.jour = Number(jour.dataset.jour);
    rendreCalendrier();
    return;
  }

  const creneau = e.target.closest("[data-creneau]");
  if (creneau && !creneau.disabled) {
    const id = creneau.dataset.creneau;
    if (!etat.creneau) etat.creneau = id;
    else if (etat.creneau === id) {
      etat.creneau = null;
      etat.replis.clear();
    } else if (etat.replis.has(id)) etat.replis.delete(id);
    else if (etat.replis.size < 4) etat.replis.add(id);
    rendreCalendrier();
    rendreRecap();
    rendreNav();
    return;
  }

  const aller_ = e.target.closest("[data-aller]");
  if (aller_) {
    aller(aller_.dataset.aller);
    return;
  }

  if (e.target.closest("[data-retour]")) {
    history.back();
    return;
  }

  if (e.target.closest("[data-suivant]") || e.target.closest("#sticky-next")) {
    const index = ETAPES.findIndex((s) => s.id === etat.etape);
    if (index === ETAPES.length - 1) {
      confirmer();
      return;
    }
    aller(ETAPES[index + 1].id);
  }
});

$("#slider").addEventListener("input", (e) => {
  etat.duree = Number(e.target.value);
  /* Le curseur se met à jour seul : re-rendre la grille entière à chaque
     mouvement ferait perdre le pouce au milieu du geste. */
  $("#slider-value").textContent = heuresLisibles(etat.duree);
  $("#slider-hint").textContent =
    `Idéal pour ${surfacePour(etat.duree)} m² environ.`;
  document.querySelectorAll("[data-duree]").forEach((b) => {
    b.classList.toggle("is-on", Number(b.dataset.duree) === etat.duree);
  });
  rendreRecap();
});

document.addEventListener("change", (e) => {
  if (e.target.matches("[data-option]")) {
    const id = e.target.dataset.option;
    e.target.checked ? etat.options.add(id) : etat.options.delete(id);
    rendreRecap();
  }
  if (e.target.id === "cgu") rendreNav();
});

/** Fin de parcours : la demande part, elle n'est pas confirmée. */
function confirmer() {
  const rythme = RYTHMES.find((r) => r.id === etat.rythme);
  $("#c-service").textContent =
    `Ménage ${heuresLisibles(dureeTotale())} · ${rythme.label.toLowerCase()}`;
  $("#c-when").textContent = etat.creneau
    ? `${etat.creneau.replace("·", " à ")}${etat.replis.size ? ` · ${etat.replis.size} repli${etat.replis.size > 1 ? "s" : ""}` : ""}`
    : "—";
  rendreRecap();
  $("#funnel").hidden = true;
  $("#sticky").style.display = "none";
  $("#confirmation").hidden = false;
  window.scrollTo({ top: 0 });
  history.pushState({ etape: "confirmation" }, "", "#confirmation");
}

/* --- Amorçage ------------------------------------------------------------- */
const depart = location.hash.slice(1);
etat.etape = ETAPES.some((s) => s.id === depart) ? depart : ETAPES[0].id;
history.replaceState({ etape: etat.etape }, "", "#" + etat.etape);
rendre();
