import { test, expect, type Page } from '@playwright/test';

async function seedSeals(page: Page, seals: number) {
  await page.goto('/#/');
  await page.evaluate((n) => {
    const raw = localStorage.getItem('sigilgrid.save.v1');
    if (!raw) return;
    const save = JSON.parse(raw);
    save.seals = n;
    localStorage.setItem('sigilgrid.save.v1', JSON.stringify(save));
  }, seals);
  await page.reload();
}

test('home surfaces rank, seals and mastery progress', async ({ page }) => {
  await seedSeals(page, 12);
  await expect(page.getByTestId('home-rank')).toBeVisible();
  await expect(page.getByTestId('home-seals')).toContainText('12');
  await expect(page.getByTestId('home-mastery')).toBeVisible();
  await expect(page.getByTestId('home-album')).toBeVisible();
});

test('all three pack tiers are offered, priced and gated by seals', async ({ page }) => {
  await seedSeals(page, 3);
  await page.goto('/#/collection');
  await page.getByTestId('tab-shop').click();

  await expect(page.getByTestId('pack-art-ashfall')).toBeVisible();
  await expect(page.getByTestId('pack-art-ember')).toBeVisible();
  await expect(page.getByTestId('pack-art-lantern')).toBeVisible();

  // 3 seals: the cheap pack is affordable, the dearer two are not.
  await expect(page.getByTestId('buy-ashfall')).toBeEnabled();
  await expect(page.getByTestId('buy-ember')).toBeDisabled();
  await expect(page.getByTestId('buy-lantern')).toBeDisabled();
});

test('buying a pack tears it open and adds the cards', async ({ page }) => {
  await seedSeals(page, 20);
  await page.goto('/#/collection');
  await page.getByTestId('tab-shop').click();

  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!).collection.length,
  );

  await page.getByTestId('buy-lantern').click();
  await expect(page.getByTestId('pack-opening')).toBeVisible();
  await page.getByTestId('pack-tear').click();
  await page.getByTestId('pack-skip').click();

  const cards = page.locator('[data-testid="pack-reveal"] .card-face');
  await expect(cards).toHaveCount(5);
  await page.getByTestId('pack-done').click();

  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!).collection.length,
  );
  expect(after).toBe(before + 5);
  await expect(page.getByTestId('seal-count')).toHaveText('10');
});

test('discarding a one-of-a-kind card warns about the points it costs', async ({ page }) => {
  await seedSeals(page, 0);
  await page.goto('/#/collection');
  await page.getByTestId('tab-album').click();

  await page.locator('.discard-btn').first().click();
  await expect(page.getByTestId('discard-confirm')).toBeVisible();
  await expect(page.getByTestId('discard-warning')).toContainText(/costs you \d+ collector points/);
  await expect(page.getByTestId('discard-warning')).toContainText('only copy');
});

test('a discard removes the card from the album and every deck', async ({ page }) => {
  await seedSeals(page, 0);
  await page.goto('/#/collection');
  await page.getByTestId('tab-album').click();

  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!).collection.length,
  );
  await page.locator('.discard-btn').first().click();
  await page.getByTestId('discard-confirm-yes').click();

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!));
  expect(save.collection.length).toBe(before - 1);
  const ids = new Set(save.collection.map((c: { instanceId: string }) => c.instanceId));
  for (const deck of save.decks) {
    for (const id of deck.instanceIds) expect(ids.has(id)).toBe(true);
  }
});

test('the deck builder shows five slots and saves only a full deck', async ({ page }) => {
  await seedSeals(page, 0);
  await page.goto('/#/collection');
  await page.getByTestId('tab-deck').click();

  await expect(page.locator('.deck-slot')).toHaveCount(5);
  await page.getByTestId('deck-clear').click();
  await expect(page.locator('.deck-slot.empty')).toHaveCount(5);
  await expect(page.getByTestId('deck-save')).toBeDisabled();

  // Deliberately a different five from the stored deck — re-picking the same
  // cards leaves the deck unchanged, and the button correctly stays "Saved".
  const candidates = page.locator('.album .card-face');
  for (let i = 5; i < 10; i++) await candidates.nth(i).click();
  await expect(page.locator('.deck-slot.filled')).toHaveCount(5);
  await expect(page.getByTestId('deck-save')).toBeEnabled();

  await page.getByTestId('deck-save').click();
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sigilgrid.save.v1')!);
    return s.decks.find((d: { id: string }) => d.id === s.activeDeckId).instanceIds.length;
  });
  expect(saved).toBe(5);
});
