/**
 * ⚠️⚠️ ÉCRAN DE SPIKE — PAS UN ÉCRAN DE PRODUIT ⚠️⚠️
 *
 * Volontairement moche, volontairement non traduit, volontairement non accessible. Il existe pour
 * MESURER six inconnues sur un vrai téléphone, et pour être **supprimé** ensuite : un seul
 * `git revert` du commit qui l'apporte retire l'écran, sa déclaration de route et son entrée.
 *
 * Protocole et critères de décision : docs/specs/technical/spike-3d-corps.md.
 *
 * 🔴 Ne pas s'en inspirer pour l'éditeur réel. Notamment, un canvas `aria-hidden` piloté par des
 * curseurs est ici acceptable parce qu'on mesure une performance ; dans le produit, ces curseurs
 * devront porter `accessibilityRole="adjustable"` et leurs valeurs, comme le fait déjà
 * `BodyShapeControl`. La 3D ne doit jamais devenir le seul moyen de régler sa silhouette.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BodySpikeStage } from '@/components/body/spike3d/BodySpikeStage';
import type { BodySpikeStats } from '@/components/body/spike3d/BodySpikeScene3D.dom';
import {
  BODY_SPIKE_GOALS,
  BODY_SPIKE_PROPORTIONS,
  bodySpikeState,
  neutralSpikeInput,
  type BodySpikeGoal,
  type BodySpikeProportion,
  type BodySpikeVariant,
} from '@/components/body/spike3d/body-spike-state';

const PAS_PROPORTION = 0.25;
const PAS_INTENTION = 1;

export default function SpikeCorps3DScreen() {
  const router = useRouter();
  const [variant, setVariant] = useState<BodySpikeVariant>('single');
  const [proportions, setProportions] = useState<Partial<Record<BodySpikeProportion, number>>>({});
  const [goals, setGoals] = useState<Partial<Record<BodySpikeGoal, number>>>({});
  const [stats, setStats] = useState<BodySpikeStats | null>(null);

  const state = useMemo(
    () => bodySpikeState({ ...neutralSpikeInput(), variant, proportions, goals }),
    [variant, proportions, goals],
  );

  const pousserTout = () => {
    setProportions(Object.fromEntries(BODY_SPIKE_PROPORTIONS.map((z) => [z, 2])));
    setGoals(Object.fromEntries(BODY_SPIKE_GOALS.map((z) => [z, 4])));
  };

  const remettreANeutre = () => {
    setProportions({});
    setGoals({});
  };

  return (
    <View style={styles.screen}>
      <BodySpikeStage state={state} onStats={setStats} />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.warning}>
          SPIKE TECHNIQUE — écran de mesure, pas une fonctionnalité. À supprimer après la recette.
        </Text>

        {/* ── L'instrumentation : ce que le spike doit rapporter ───────────────────────────────── */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Mesures</Text>
          <Text style={styles.metric}>Images par seconde : {stats ? stats.fps : '—'}</Text>
          <Text style={styles.metric}>
            Première image : {stats ? `${stats.premiereImageMs} ms` : '—'}
          </Text>
          <Text style={styles.metric}>Maillages : {stats ? stats.meshes : '—'}</Text>
          <Text style={styles.metric}>
            Morphs par maillage : {stats ? stats.morphsParMaillage.join(' · ') : '—'}
          </Text>
          <Text style={styles.metric}>
            Influences demandées : {state.requested} / 14 — plafond three r128 :{' '}
            {stats ? stats.limite : 8} par maillage
          </Text>
          {state.requested > 8 && variant === 'single' ? (
            <Text style={styles.alert}>
              Plus de 8 influences sur un maillage unique : three en ignore une partie SANS erreur.
              Compter à l’œil combien de zones bougent réellement — c’est la mesure.
            </Text>
          ) : null}
        </View>

        {/* ── Le basculement entre les deux variantes ──────────────────────────────────────────── */}
        <View style={styles.row}>
          {(['single', 'split'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVariant(v)}
              style={[styles.chip, variant === v && styles.chipOn]}>
              <Text style={styles.chipText}>
                {v === 'single' ? 'Maillage unique (14 morphs)' : 'Découpé (3 × ≤ 8)'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable onPress={pousserTout} style={styles.chip}>
            <Text style={styles.chipText}>Tout pousser au max</Text>
          </Pressable>
          <Pressable onPress={remettreANeutre} style={styles.chip}>
            <Text style={styles.chipText}>Neutre</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.chip}>
            <Text style={styles.chipText}>Retour</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Proportions — de −2 à +2</Text>
        {BODY_SPIKE_PROPORTIONS.map((zone) => (
          <Curseur
            key={`prop-${zone}`}
            nom={zone}
            valeur={proportions[zone] ?? 0}
            min={-2}
            max={2}
            pas={PAS_PROPORTION}
            onChange={(v) => setProportions((c) => ({ ...c, [zone]: v }))}
          />
        ))}

        <Text style={styles.section}>Intentions — de 0 à 4</Text>
        {BODY_SPIKE_GOALS.map((zone) => (
          <Curseur
            key={`goal-${zone}`}
            nom={zone}
            valeur={goals[zone] ?? 0}
            min={0}
            max={4}
            pas={PAS_INTENTION}
            onChange={(v) => setGoals((c) => ({ ...c, [zone]: v }))}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Un curseur à boutons plutôt qu'un vrai `Slider` : un glissé continu enverrait des dizaines de
 * poussées par seconde à travers le pont, et mesurerait la latence du pont au lieu de celle des
 * morphs. Les pas discrets sont d'ailleurs ceux du produit (0,25 et 1).
 */
function Curseur({
  nom,
  valeur,
  min,
  max,
  pas,
  onChange,
}: {
  nom: string;
  valeur: number;
  min: number;
  max: number;
  pas: number;
  onChange: (valeur: number) => void;
}) {
  const borner = (v: number) => Math.max(min, Math.min(max, Math.round(v / pas) * pas));
  return (
    <View style={styles.curseur}>
      <Text style={styles.curseurNom}>
        {nom} : {valeur}
      </Text>
      <Pressable onPress={() => onChange(borner(valeur - pas))} style={styles.bouton}>
        <Text style={styles.boutonText}>−</Text>
      </Pressable>
      <Pressable onPress={() => onChange(borner(valeur + pas))} style={styles.bouton}>
        <Text style={styles.boutonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#100c0e' },
  body: { padding: 14, paddingBottom: 48, gap: 10 },
  warning: { color: '#ffb4a2', fontSize: 12, fontWeight: '700' },
  panel: { backgroundColor: '#1d1619', borderRadius: 10, padding: 12, gap: 4 },
  panelTitle: { color: '#f4e6d8', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  metric: { color: '#d9c7b8', fontSize: 13 },
  alert: { color: '#ffb4a2', fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#2a2024', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chipOn: { backgroundColor: '#6b0028' },
  chipText: { color: '#f4e6d8', fontSize: 13 },
  section: { color: '#c9a96e', fontSize: 14, fontWeight: '700', marginTop: 10 },
  curseur: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  curseurNom: { color: '#d9c7b8', fontSize: 13, flex: 1 },
  bouton: {
    backgroundColor: '#2a2024',
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonText: { color: '#f4e6d8', fontSize: 18 },
});
