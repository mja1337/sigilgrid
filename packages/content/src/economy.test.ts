import { describe, expect, it } from 'vitest';
import { createStarterCollection } from './instantiate.ts';
import { ownedTemplateIds, pickPack } from './economy.ts';
import { TEMPLATES } from './templates.ts';

describe('economy', () => {
  it('prefers unowned templates in a pack', () => {
    const owned = createStarterCollection();
    const unowned = TEMPLATES.filter((t) => !ownedTemplateIds(owned).has(t.templateId));
    const pack = pickPack(owned, 7, 3);
    expect(pack).toHaveLength(3);
    expect(pack.every((id) => unowned.some((t) => t.templateId === id))).toBe(true);
    expect(new Set(pack).size).toBe(3);
  });
});
