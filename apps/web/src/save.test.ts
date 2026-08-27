import { describe, expect, it } from 'vitest';
import { defaultSettings } from './save.ts';

describe('settings', () => {
  it('defaults include accessibility toggles', () => {
    const s = defaultSettings();
    expect(s.tacticalPreview).toBe(true);
    expect(s.classicOpacity).toBe(false);
  });
});
