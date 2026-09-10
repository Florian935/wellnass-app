import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GLASS_ML,
  DEFAULT_WATER_TARGET_ML,
  MAX_GLASSES_DISPLAYED,
  hydrationProgress,
  millilitresToLitres,
} from './hydration';

describe('hydrationProgress', () => {
  it('compte les verres entiers et l’avancement', () => {
    const p = hydrationProgress(1250, 2000, 250);
    expect(p.glasses).toBe(5);
    expect(p.targetGlasses).toBe(8);
    expect(p.ratio).toBeCloseTo(0.625);
    expect(p.reached).toBe(false);
  });

  it('utilise les défauts quand rien n’est réglé', () => {
    const p = hydrationProgress(DEFAULT_WATER_TARGET_ML);
    expect(p.targetMl).toBe(DEFAULT_WATER_TARGET_ML);
    expect(p.glasses).toBe(DEFAULT_WATER_TARGET_ML / DEFAULT_GLASS_ML);
    expect(p.reached).toBe(true);
  });

  it('borne l’avancement à 1 — la barre ne déborde pas de sa piste', () => {
    expect(hydrationProgress(4000, 2000).ratio).toBe(1);
  });

  it('signale l’objectif atteint sans le traiter comme une faute', () => {
    expect(hydrationProgress(2000, 2000).reached).toBe(true);
    expect(hydrationProgress(3000, 2000).reached).toBe(true);
  });

  it('arrondit les verres vers le bas — un demi-verre n’en est pas un', () => {
    expect(hydrationProgress(374, 2000, 250).glasses).toBe(1);
    expect(hydrationProgress(375, 2000, 250).glasses).toBe(1);
    expect(hydrationProgress(500, 2000, 250).glasses).toBe(2);
  });

  it('reste défini sans objectif : pas de division par zéro', () => {
    const p = hydrationProgress(500, 0);
    expect(p.ratio).toBe(0);
    expect(p.targetGlasses).toBe(0);
    expect(p.reached).toBe(false);
  });

  it('encaisse des entrées absurdes sans produire de NaN', () => {
    const p = hydrationProgress(Number.NaN, Number.NaN, 0);
    expect(p.totalMl).toBe(0);
    expect(p.ratio).toBe(0);
    expect(Number.isNaN(p.glasses)).toBe(false);
  });

  it('plafonne le nombre de verres affichés', () => {
    expect(hydrationProgress(0, 10000, 250).targetGlasses).toBe(MAX_GLASSES_DISPLAYED);
  });

  it('accepte un volume de verre personnalisé', () => {
    expect(hydrationProgress(1000, 2000, 500).glasses).toBe(2);
    expect(hydrationProgress(1000, 2000, 500).targetGlasses).toBe(4);
  });
});

describe('millilitresToLitres', () => {
  it('rend une décimale', () => {
    expect(millilitresToLitres(1250)).toBe(1.3);
    expect(millilitresToLitres(2000)).toBe(2);
    expect(millilitresToLitres(0)).toBe(0);
  });

  it('ne rend jamais de valeur négative', () => {
    expect(millilitresToLitres(-500)).toBe(0);
  });
});
