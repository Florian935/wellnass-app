# PRISME-01 — Prisme raconte (maquette)

02/10/2026 · **Validée par Florian le 03/10/2026**, avec la [spec](../../docs/specs/functional/us/prisme01-prisme-raconte.md)
et le [plan](../../docs/plans/prisme01-prisme-raconte.md).

- Planche en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/7CV99wcvuB1wFxvYKS9FDb
- Source : [prisme01-prisme-raconte.html](prisme01-prisme-raconte.html) — page autonome, s'ouvre
  directement dans un navigateur (polices Google Fonts, aucun `support.js` nécessaire).
- ⚠️ **Planche HTML, pas une toile Claude Design** : elle a été écrite à la main, dans les couleurs et
  les polices de l'app (`colors.ts`, `stage.ts`, `fonts.ts`). À refaire en toile si la validation le
  demande.
- Antécédents : [analyse-assistant-prisme-2026-10.md](../../docs/product/analyse-assistant-prisme-2026-10.md)
  et son compte rendu en ligne avec la maquette jouable de l'assistant dans le Labo :
  https://claude.ai/artifact/2zptc9GuNxMTvxWJm8nioj

## Contenu (version 2, révisée après la relecture du 02/10/2026)

| Rangée | Écrans | Ce qu'ils montrent |
|---|---|---|
| 1 · Le soir | 1a à 1d | La carte « Ta journée » sur l'accueil dès 18 h (sans pas ni nuit), le texte vérifié et « D'où ça vient », le refus du garde-fou, « ta journée a bougé depuis » |
| 2 · La semaine | 2a | Le bilan hebdo : décision, tuiles, puis le texte de Prisme **sous** les chiffres |
| 3 · Le repas | 3a, 3b | La saisie rapide existante (4.5) avec « Demander à Prisme » sous la ligne non trouvée, puis la revue complétée (jouable) |
| 4 · L'accord | 4a, 4b | La feuille d'accord au nom du vrai fournisseur (Groq, États-Unis) et la case « 18 ans ou plus » ; Réglages › Prisme |
| 5 · Les absences | 5a | Hors ligne, quota ; mineur, humeur basse, fournisseur non autorisé |

## À savoir

- **Données fictives** : vendredi 2 octobre 2026, 21 h 10 ; séance de musculation (52 min,
  8 420 kg), 2 140 / 2 450 kcal, sortie longue de 14 km le lendemain à 9 h. Chaque fait correspond à
  un moteur qui existe déjà.
- **Jouable** : « Prisme raconte » (1a), les portions (3b), l'interrupteur (4b).
- **Retiré en version 2** : la photo (PRISME-02), le second accord bien-être, la nuit et les pas, les
  quotas dans les Réglages, la bêta fermée (ACCES-IA), NARR-01 dans la voix de Prisme (question Q1).
- **Non couverts** : thème sombre, textes EN, grandes polices, TalkBack.
