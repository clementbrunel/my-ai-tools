/*
  Contenu d'une carte : modèle neutre à copier dans projets/<nom>/contenu.js.
  - **texte** = gras (couleur d'accent), \n = retour à la ligne.
  - Supprimer un champ (ou le laisser vide) le masque sur la carte.
*/
window.CARTE = {
  // Couleurs (facultatif) : reprendre celles de palette.json / assets/palette.png
  couleurs: {
    cream: "#FBF6EE", paper: "#FFFDF8", ink: "#4A3B36", inkSoft: "#7D6A62",
    accent: "#C27B5F", accent2: "#D8A7A0", accent3: "#9BB09A",
  },

  couverture: {
    titre: "Joyeux anniversaire",
    sousTitre: "Prénom",
    mode: "plein",          // "plein" = image bord à bord ; "cadre" = photo encadrée façon Polaroid
    afficherTexte: true,    // false si l'image porte déjà son propre titre
    // images: ["recto.png", "recto.jpg"],   // ordre de recherche (facultatif)
  },

  // Encart au dos ; mettre `dos: null` pour un dos vierge
  dos: {
    surtitre: "Bon pour",
    titre: "un cadeau surprise",
    ligne: "à découvrir très bientôt",
    bas: "offert par Signature",
  },

  interieurGauche: {
    citation: "« Les plus belles choses\nprennent un peu de temps. »",
    // vignette: "vignette.png", fond: "fond-interieur.png",
  },

  message: {
    ouverture: "Cher·e Prénom,",
    paragraphes: [
      "Premier paragraphe du message, avec un passage **mis en valeur**.",
      "Deuxième paragraphe : ce que contient le cadeau, quand il arrivera.",
    ],
    separateurApres: 2,     // trait décoratif après le 2e paragraphe (0 = aucun)
    encadre: "Date clé : **[date]**",
    signature: "Signature",
    date: "",
  },
};
