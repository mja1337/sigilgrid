import { DIRECTIONS, type Direction } from '@sigilgrid/core';
import { TEMPLATES } from './templates.ts';

export function validateTemplates(): string[] {
  const errors: string[] = [];
  if (TEMPLATES.length !== 100) errors.push(`count ${TEMPLATES.length}`);
  const ids = new Set<string>();
  for (const t of TEMPLATES) {
    if (ids.has(t.templateId)) errors.push(`dup ${t.templateId}`);
    ids.add(t.templateId);
    if (t.defaultArrows.length < 1 || t.defaultArrows.length > 7) {
      errors.push(`${t.templateId} arrows ${t.defaultArrows.length}`);
    }
    for (const a of t.defaultArrows) {
      if (!DIRECTIONS.includes(a as Direction)) errors.push(`${t.templateId} bad dir`);
    }
    for (const stat of [t.attack, t.physicalDefense, t.magicalDefense]) {
      if (stat < 0 || stat > 15) errors.push(`${t.templateId} stat`);
    }
    if (!['P', 'M', 'X', 'A'].includes(t.battleClass)) errors.push(`${t.templateId} class`);
  }
  return errors;
}
