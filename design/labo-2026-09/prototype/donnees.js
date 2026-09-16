/* Le Labo — données FICTIVES du prototype : la semaine en cours, ce que le Labo propose, ses enquêtes,
 * et ce qu'il a appris. Un personnage hybride : 10 km sous 48:00 le 15/11, total SBD 372 kg, 77,6 kg.
 * Les codes cités existent dans le catalogue d'analyses ; les chiffres sont inventés. */
(function () {
  'use strict';

  window.LaboDonnees = {
    semaine: {
      titre: 'du lundi 14 au dimanche 20/09',
      aujourdhui: 1,
      cycle: { semaine: 3, sur: 8 },
      jours: [{ l: 'L', d: '14', nom: 'lundi' }, { l: 'M', d: '15', nom: 'mardi' }, { l: 'M', d: '16', nom: 'mercredi' }, { l: 'J', d: '17', nom: 'jeudi' }, { l: 'V', d: '18', nom: 'vendredi' }, { l: 'S', d: '19', nom: 'samedi' }, { l: 'D', d: '20', nom: 'dimanche' }],
      muscu: [{ n: 'Haut', long: 'Haut du corps', fait: true }, null, { n: 'Jambes', long: 'Jambes · squat 5×5' }, null, { n: 'Haut +', long: 'Haut + tirage' }, null, null],
      course: [null, { n: '6 km', long: 'Footing 6,2 km', fait: true }, null, { n: '6×800', long: 'Fractionné 6×800 m' }, null, { n: '12 km', long: 'Sortie longue 12 km' }, null],
      proteines: [1.6, 1.4, null, null, null, null, null],
      nuits: [{ h: '7:40', ok: 1 }, { h: '6:10', ok: 0 }, null, null, null, null, null],
      reel: { seances: 3, seancesFaites: 1, km: 25, kmFaits: 6.2, proteines: 1.5, cibleProteines: 1.8, kcal: -310, cibleKcal: -250 },
    },

    // Ce que le Labo a vu dans la semaine, et le geste qui règle chaque point.
    propositions: [
      {
        id: 'swap', ton: 'warn', paire: ['muscu', 'course'], genre: 'collision',
        titre: 'Jambes mercredi, fractionné jeudi',
        texte: 'Squat lourd la veille : environ 3 s perdues par 800 m. Chez toi, c’est arrivé 3 semaines sur 3 depuis août.',
        source: 'MR-08 · tes 3 dernières semaines',
        geste: 'Échanger mercredi et vendredi',
        fait: 'Jambes passe à vendredi, le haut du corps à mercredi.',
        effet: { run: -12 }, effetTexte: '10 km −12 s d’ici le 15/11',
        change: { p: 'muscu', titre: 'Musculation · cette semaine', detail: 'Mercredi : Haut + tirage · Vendredi : Jambes, squat 5×5', ou: 'Accueil, Musculation' },
      },
      {
        id: 'prot', ton: 'warn', paire: ['nutrition', 'muscu'], genre: 'manque',
        titre: 'Protéines à 1,5 g/kg depuis lundi',
        texte: 'Ta cible est 1,8 g/kg : il manque environ 23 g par jour. Un skyr et deux œufs au petit-déjeuner suffisent.',
        source: 'MN-06 · tes repas de lundi et mardi',
        geste: 'Ajouter à mon petit-déjeuner type',
        fait: 'Skyr et œufs ajoutés à ton petit-déjeuner type.',
        effet: { sbd: 3 }, effetTexte: 'total SBD +3 kg d’ici le 15/11',
        change: { p: 'nutrition', titre: 'Nutrition · repas type', detail: 'Petit-déjeuner : + skyr 150 g, + 2 œufs (26 g de protéines)', ou: 'Nutrition' },
      },
      {
        id: 'nuit', ton: 'info', paire: ['socle', 'course'], genre: 'risque',
        titre: 'Nuit courte lundi (6 h 10)',
        texte: 'Chez toi, une nuit sous 6 h 30 coûte environ 4 s/km au fractionné du lendemain. Si mercredi est courte aussi, jeudi passe en 5×800 m.',
        source: 'TRI-03 · appris sur 11 nuits',
        geste: 'Activer l’allègement automatique',
        fait: 'Décidé mercredi soir, selon ta nuit.',
        effet: { run: -4 }, effetTexte: 'protège ta séance de jeudi',
        change: { p: 'course', titre: 'Course · jeudi 17/09', detail: 'Fractionné 6×800 m, ou 5×800 m si la nuit de mercredi fait moins de 6 h 30', ou: 'Accueil, Course' },
      },
    ],

    // Les courbes qui calent, et ce que le Labo trouve en croisant les piliers.
    enquetes: [
      {
        id: 'squat', question: 'Mon squat stagne', detecte: 'e1RM 142 kg depuis 3 semaines', code: 'MUSC-08 · META-11',
        focus: ['muscu', 'course'], unite: 'kg', serie: [128, 132, 135, 138, 141, 142, 142, 142], plat: 5,
        suspects: [
          { titre: 'Jambes la veille du fractionné', preuve: '3 semaines sur 3 depuis le 24/08', force: 0.82, niveau: 'fort', code: 'MR-08', paire: ['muscu', 'course'], lien: 'swap' },
          { titre: 'Protéines basses les jours de jambes', preuve: '1,4 g/kg en moyenne ces jours-là', force: 0.5, niveau: 'moyen', code: 'MN-18', paire: ['nutrition', 'muscu'], lien: 'prot' },
          { titre: 'Déficit un peu plus creusé que prévu', preuve: '−310 kcal/j au lieu de −250', force: 0.24, niveau: 'faible', code: 'MN-08', paire: ['nutrition', 'muscu'] },
        ],
        ecarte: 'le sommeil : 7 h 20 en moyenne les veilles de jambes, comme avant le plateau.',
        test: { id: 'jambes48', titre: 'Jambes 48 h avant le fractionné', texte: '3 semaines, l’ordre tiré au sort chaque semaine. Le Labo mesure ton e1RM squat et l’allure des 800 m, sans rien saisir.', verdict: 'verdict le 06/10' },
      },
      {
        id: 'fractions', question: 'Mes 800 m ralentissent', detecte: 'dernière fraction 3:58, première 3:46', code: 'RN-16 · META-11',
        focus: ['course', 'socle'], unite: 's', serie: [236, 235, 233, 234, 237, 238, 239, 238], plat: 3,
        suspects: [
          { titre: 'Nuit courte la veille', preuve: '4 séances lentes sur 6 après moins de 6 h 30', force: 0.74, niveau: 'fort', code: 'TRI-03', paire: ['socle', 'course'], lien: 'nuit' },
          { titre: 'Peu de glucides les jours de fractionné', preuve: '3,1 g/kg ces jours-là, 5 conseillés', force: 0.55, niveau: 'moyen', code: 'RN-06', paire: ['nutrition', 'course'] },
          { titre: 'Jambes la veille', preuve: '3 séances sur 6', force: 0.4, niveau: 'moyen', code: 'MR-08', paire: ['muscu', 'course'], lien: 'swap' },
        ],
        ecarte: 'la chaleur : tes séances lentes ne tombent pas les jours chauds.',
        test: { id: 'glucides', titre: 'Glucides +1,5 g/kg les jours de fractionné', texte: 'Déjà en cours depuis le 07/09.', verdict: 'verdict le 29/09', enCours: true },
      },
      {
        id: 'poids', question: 'Mon poids ne bouge plus', detecte: '76,4 kg ± 0,3 depuis 3 semaines', code: 'NUTR-19 · META-11',
        focus: ['nutrition'], unite: 'kg', serie: [77.6, 77.3, 77.0, 76.8, 76.5, 76.4, 76.5, 76.4], plat: 5,
        suspects: [
          { titre: 'Week-ends au-dessus de ta cible', preuve: '+620 kcal en moyenne samedi et dimanche', force: 0.7, niveau: 'fort', code: 'NUTR-21', paire: ['nutrition', 'socle'] },
          { titre: 'Dîners non saisis', preuve: '4 dîners sur 14 absents du journal', force: 0.52, niveau: 'moyen', code: 'NUTR-17', paire: ['nutrition', 'socle'] },
          { titre: 'Dépense de course surestimée', preuve: 'ton allure réelle brûle ~8 % de moins que l’estimation', force: 0.3, niveau: 'faible', code: 'RN-03', paire: ['course', 'nutrition'] },
        ],
        ecarte: 'la rétention d’eau : ton poids ne remonte pas après les jours de fractionné.',
        test: { id: 'saisie', titre: 'D’abord mesurer, pas restreindre', texte: 'Pas d’expérience sur les calories. Deux semaines à saisir aussi les week-ends, même à peu près, pour vérifier l’écart.', verdict: 'rappel samedi et dimanche à 21 h', rappel: true },
      },
    ],

    // Ce que le Labo sait du personnage, et à quoi ça sert dans l'app.
    acquis: {
      semaines: 12,
      encours: [
        { id: 'glucides', titre: 'Glucides +1,5 g/kg les jours de fractionné', jour: 9, sur: 21, suivi: '8 jours sur 9 respectés', verdict: 'verdict scellé le 29/09' },
      ],
      cartes: [
        { statut: 'verifie', paire: ['muscu', 'course'], titre: 'Tes jambes récupèrent en 48 h, pas en 24', preuve: 'expérience du 03/08 au 24/08, ordre tiré au sort', sert: 'placer tes jambes dans la semaine' },
        { statut: 'solide', paire: ['socle', 'course'], titre: 'Une nuit sous 6 h 30 te coûte ~4 s/km au fractionné du lendemain', preuve: '11 nuits depuis juin · écart de 2 à 6 s', sert: 'l’allègement automatique du fractionné' },
        { statut: 'probable', paire: ['nutrition', 'muscu'], titre: 'À 1,8 g/kg, ta force monte même à −250 kcal', preuve: '9 semaines · e1RM squat +9 kg', sert: 'ta cible de protéines' },
        { statut: 'rien', paire: ['nutrition', 'muscu'], titre: 'Pas de lien entre ton café d’avant séance et la charge soulevée', preuve: '14 séances comparées', sert: 'rien : tu peux arrêter d’y penser' },
      ],
    },
  };
})();
