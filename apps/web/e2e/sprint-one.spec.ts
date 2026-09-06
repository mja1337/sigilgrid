import { expect, test } from '@playwright/test';

test('Daily Rift presents a named deterministic challenge', async ({ page }) => {
  await page.goto('/#/daily');
  const card = page.getByTestId('daily-challenge');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/seed \d{8}/);
  await expect(card).toContainText(/Streak/);
  await expect(card.getByRole('link', { name: 'Enter rift' })).toHaveAttribute('href', /mode=daily/);
});

test('tutorial coaching advances after selecting a card and can be skipped', async ({ page }) => {
  await page.goto('/#/play?mode=story&encounter=t1&seed=45');
  await page.getByTestId('dialogue-continue').click();
  await page.getByTestId('kickoff-continue').click();
  await expect(page.getByTestId('tutorial-hint')).toContainText('Step 1 of 3');
  await page.locator('.hand-column .card-face').first().click();
  await expect(page.getByTestId('tutorial-hint')).toContainText('Step 2 of 3');
  await page.getByRole('button', { name: 'Skip guidance' }).click();
  await expect(page.getByTestId('tutorial-hint')).toHaveCount(0);
});

test('Replay Theatre steps through a stored match', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const key = 'sigilgrid.save.v1';
    const save = JSON.parse(localStorage.getItem(key)!);
    const player = save.collection[0];
    const opponent = { ...save.collection[1], instanceId: 'o-replay-test', provenance: 'event' };
    save.replays = [{
      protocolVersion: 1,
      config: {
        seed: 77,
        playerCards: [player],
        opponentCards: [opponent],
        blockedCells: Array.from({ length: 14 }, (_, index) => index + 2),
        firstPlayer: 'player',
      },
      actions: [
        { type: 'place', instanceId: player.instanceId, cell: 0 },
        { type: 'place', instanceId: opponent.instanceId, cell: 1 },
      ],
      createdAt: '2026-09-06T00:00:00.000Z',
      mode: 'practice',
      label: 'Replay test',
      result: 'player',
    }];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.goto('/#/settings');
  await page.getByRole('link', { name: /Replay test/ }).click();
  await expect(page.getByRole('heading', { name: 'Replay test' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('replay-action')).toContainText('1/2');
});

test('web app manifest exposes install icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512']);
});
