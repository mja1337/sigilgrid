import { test, expect } from '@playwright/test';

test('export and import are available to players, not just in dev', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByTestId('save-export')).toBeVisible();
  await expect(page.getByTestId('save-import')).toBeVisible();
});

test('exporting downloads a save file that round-trips', async ({ page }) => {
  await page.goto('/#/settings');

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-export').click(),
  ]).then(([d]) => d);

  expect(download.suggestedFilename()).toMatch(/^sigilgrid-save-\d{4}-\d{2}-\d{2}\.json$/);
  const stream = await download.createReadStream();
  const text = await new Promise<string>((resolve, reject) => {
    let out = '';
    stream.on('data', (c) => (out += c));
    stream.on('end', () => resolve(out));
    stream.on('error', reject);
  });

  const parsed = JSON.parse(text);
  expect(parsed.version).toBe(1);
  expect(Array.isArray(parsed.collection)).toBe(true);
  expect(parsed.collection.length).toBeGreaterThan(0);
});

test('a corrupt save is refused and the existing one survives', async ({ page }) => {
  await page.goto('/#/settings');
  page.on('dialog', (d) => d.accept('{"version":1,"nonsense":true}'));
  await page.getByTestId('save-paste').click();

  await expect(page.getByTestId('save-status')).toContainText(/not a Sigil Grid save/i);

  // The real damage would show on reload: a bricked save crashes the app.
  await page.goto('/#/collection');
  await expect(page.locator('.album .card-face').first()).toBeVisible();
});

test('an imported save actually restores progress', async ({ page }) => {
  await page.goto('/#/settings');

  // Take the real exported save, alter a value a player would notice, and
  // feed it back through the paste path.
  const edited = await page.evaluate(() => {
    const raw = localStorage.getItem('sigilgrid.save.v1')!;
    const save = JSON.parse(raw);
    save.seals = 42;
    save.loreIds = ['ember-market'];
    return JSON.stringify(save);
  });

  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(edited) : d.accept()));
  await page.getByTestId('save-paste').click();
  await expect(page.getByTestId('save-status')).toContainText('Save loaded.');

  // Visible in the UI...
  await page.goto('/#/');
  await expect(page.getByText(/42 seals/)).toBeVisible();

  // ...and still there after a reload, i.e. it really was persisted.
  await page.reload();
  await expect(page.getByText(/42 seals/)).toBeVisible();
});
