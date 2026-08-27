import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@sigilgrid/content';
import { CARD_ART_COUNT } from './CardArt.tsx';

describe('card art', () => {
  it('has a Tetra Master portrait for every catalog card', () => {
    expect(TEMPLATES).toHaveLength(100);
    expect(new Set(TEMPLATES.map((t) => t.cardNumber)).size).toBe(100);
    expect(CARD_ART_COUNT).toBe(100);
  });
});
