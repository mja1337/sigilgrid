import { test, expect, type Page } from '@playwright/test';

/**
 * Plays tutorial t1 to a player win. Seed 45 with a last-legal-cell policy is
 * a reliable win, which keeps the loot assertions deterministic instead of
 * depending on how the dice fall.
 */
const WINNING_SEED = 45;

async function playToWin(page: Page) {
  await page.goto(`/#/play?mode=story&encounter=t1&seed=${WINNING_SEED}`);
  await page.evaluate(() => {
    const raw = localStorage.getItem('sigilgrid.save.v1');
    if (!raw) return;
    const s = JSON.parse(raw);
    s.settings.animationSpeed = 'fast';
    s.settings.fastResolve = true;
    localStorage.setItem('sigilgrid.save.v1', JSON.stringify(s));
  });
  await page.reload();
  await page.getByTestId('dialogue-continue').click();
  await page.getByTestId('kickoff-continue').click();

  for (let i = 0; i < 70; i++) {
    if (await page.getByTestId('dialogue-post').isVisible().catch(() => false)) return;
    if (await page.getByTestId('match-over').isVisible().catch(() => false)) {
      await page.getByTestId('match-continue').click();
      await page.waitForTimeout(120);
      continue;
    }
    const cards = page.locator('.hand-column .card-face');
    if ((await cards.count()) > 0) {
      await cards.first().click();
      const legal = page.locator('.cell.legal');
      if ((await legal.count()) > 0) await legal.last().click();
    }
    const mastery = page.getByTestId('mastery-0');
    if (await mastery.isVisible().catch(() => false)) await mastery.click();
    const resolve = page.getByTestId('resolve-close');
    if (await resolve.isVisible().catch(() => false)) await resolve.click();
    await page.waitForTimeout(80);
  }
}

test('an unopposed capture no longer interrupts with a popup', async ({ page }) => {
  await page.goto('/#/play?mode=practice&seed=42');
  await page.getByTestId('kickoff-continue').click();

  let sawUnopposedCaption = false;
  for (let i = 0; i < 30; i++) {
    const overlay = page.getByTestId('combat-overlay');
    if (await overlay.isVisible().catch(() => false)) {
      const text = (await overlay.textContent()) ?? '';
      if (/unopposed/i.test(text)) sawUnopposedCaption = true;
      const close = page.getByTestId('resolve-close');
      if (await close.isVisible().catch(() => false)) await close.click();
    }
    if (await page.getByTestId('match-over').isVisible().catch(() => false)) break;
    const cards = page.locator('.hand-column .card-face');
    if ((await cards.count()) > 0) {
      await cards.first().click();
      if ((await page.locator('.cell.legal').count()) > 0) {
        await page.locator('.cell.legal').first().click();
      }
    }
    await page.waitForTimeout(140);
  }
  expect(sawUnopposedCaption).toBe(false);
});

test('winning a story rite offers the opponent cards you turned', async ({ page }) => {
  test.setTimeout(120_000);
  await playToWin(page);
  await expect(page.getByTestId('dialogue-post')).toContainText('player');

  await page.getByTestId('post-continue').click();
  await expect(page.getByTestId('dialogue-loot')).toBeVisible();

  // Loot is opt-in: nothing is selected until the player picks.
  await expect(page.getByTestId('loot-choice')).toContainText('Nothing selected');

  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!).collection.length,
  );
  await page.locator('.loot-option').first().click();
  await expect(page.getByTestId('loot-choice')).toContainText('Taking');
  await page.getByTestId('loot-confirm').click();

  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!).collection.length,
  );
  expect(after).toBeGreaterThan(before);
});

test('declining loot takes nothing', async ({ page }) => {
  test.setTimeout(120_000);
  await playToWin(page);
  await page.getByTestId('post-continue').click();
  await expect(page.getByTestId('loot-confirm')).toContainText('Take nothing');
  await page.getByTestId('loot-confirm').click();

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('sigilgrid.save.v1')!));
  expect(save.collection.every((c: { instanceId: string }) => !c.instanceId.startsWith('taken-'))).toBe(true);
});
