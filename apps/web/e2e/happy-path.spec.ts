import { test, expect } from '@playwright/test';

test('fresh load completes tutorial 1', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Sigil Grid/i }).first()).toBeVisible();
  await page.getByTestId('mode-story').click();
  await page.getByTestId('encounter-t1').click();
  await expect(page.getByTestId('dialogue-pre')).toBeVisible();
  await page.getByTestId('dialogue-continue').click();
  await page.getByTestId('kickoff-continue').click();
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();

  for (let step = 0; step < 40; step++) {
    if (await page.getByTestId('match-over').isVisible().catch(() => false)) break;
    if (await page.getByTestId('kickoff-continue').isVisible().catch(() => false)) {
      await page.getByTestId('kickoff-continue').click();
    }
    const playerTurn = await page.getByTestId('turn-player').isVisible().catch(() => false);
    if (!playerTurn) {
      await page.waitForTimeout(300);
      continue;
    }
    const cards = page.locator('.hand-row .card-face');
    if ((await cards.count()) === 0) {
      await page.waitForTimeout(300);
      continue;
    }
    await cards.first().click();
    const cells = page.locator('.cell.legal');
    if ((await cells.count()) > 0) {
      await cells.first().click();
      await cells.first().click();
    }
    const orderBtn = page.getByTestId('battle-order-confirm');
    if (await orderBtn.isVisible().catch(() => false)) await orderBtn.click();
    const mastery = page.getByTestId('mastery-0');
    if (await mastery.isVisible().catch(() => false)) await mastery.click();
    const resolve = page.getByTestId('resolve-close');
    if (await resolve.isVisible().catch(() => false)) await resolve.click();
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId('match-over')).toBeVisible({ timeout: 60_000 });
});
