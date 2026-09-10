import { describe, expect, it } from 'vitest';
import { preparationStateFromName, resolvePreparationState } from './preparation-state';

describe('preparationStateFromName', () => {
  it('reconnaît « cuit » et ses accords', () => {
    expect(preparationStateFromName('Riz basmati cuit')).toBe('cooked');
    expect(preparationStateFromName('Pâtes cuites')).toBe('cooked');
    expect(preparationStateFromName('Poulet (blanc, cuit)')).toBe('cooked');
  });

  it('reconnaît « cru » et ses accords', () => {
    expect(preparationStateFromName('Carotte crue')).toBe('raw');
    expect(preparationStateFromName('Épinards crus')).toBe('raw');
  });

  it('reconnaît l’anglais', () => {
    expect(preparationStateFromName('Brown rice, cooked')).toBe('cooked');
    expect(preparationStateFromName('Raw spinach')).toBe('raw');
  });

  it('🔴 ne se déclenche pas sur un mot qui CONTIENT le marqueur', () => {
    // « biscuit » contient « cuit », « crudités » et « écru » contiennent « cru ».
    expect(preparationStateFromName('Biscuit sablé')).toBeNull();
    expect(preparationStateFromName('Crudités variées')).toBeNull();
    expect(preparationStateFromName('Tissu écru')).toBeNull();
  });

  it('ignore les accents et la casse', () => {
    expect(preparationStateFromName('PÂTES CUITES')).toBe('cooked');
    expect(preparationStateFromName('Bœuf CRU')).toBe('raw');
  });

  it('rend null quand le nom ne dit rien', () => {
    expect(preparationStateFromName('Banane')).toBeNull();
    expect(preparationStateFromName('')).toBeNull();
  });

  it('préfère « cuit » quand les deux apparaissent — l’état final prime', () => {
    expect(preparationStateFromName('Jambon cru cuit')).toBe('cooked');
  });
});

describe('resolvePreparationState', () => {
  it('fait primer la valeur déclarée sur le nom', () => {
    expect(resolvePreparationState('raw', 'Riz cuit')).toBe('raw');
  });

  it('retombe sur le nom quand rien n’est déclaré', () => {
    expect(resolvePreparationState(null, 'Riz cuit')).toBe('cooked');
    expect(resolvePreparationState(undefined, 'Carotte crue')).toBe('raw');
  });

  it('rend null quand ni l’un ni l’autre ne dit rien', () => {
    expect(resolvePreparationState(null, 'Banane')).toBeNull();
  });
});
