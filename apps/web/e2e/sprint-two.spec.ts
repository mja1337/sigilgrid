import { expect, test } from '@playwright/test';

test('Story, Practice, and Wager show a deck mix readout', async ({ page }) => {
  await page.goto('/#/story');
  await expect(page.getByTestId('story-deck-banner')).toContainText(/P|M|X|A/);
  await page.goto('/#/practice');
  await expect(page.getByTestId('practice-deck-banner')).toBeVisible();
});

test('Challenge rites stay off Home until the circuit is finished', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mode-challenges')).toHaveCount(0);
  await page.evaluate(() => {
    const key = 'sigilgrid.save.v1';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.campaign.completed = ['a4-r3'];
    save.wagerUnlocked = true;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await expect(page.getByTestId('mode-challenges')).toBeVisible();
  await page.getByTestId('mode-challenges').click();
  await expect(page.getByTestId('challenge-c-cross')).toBeVisible();
  await expect(page.getByTestId('challenge-deck-banner')).toBeVisible();
});

test('Wager roster lists three named rivals and locks Brine until a2-lock', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const key = 'sigilgrid.save.v1';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.wagerUnlocked = true;
    save.campaign.completed = ['a2-road', 'a2-mage'];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.goto('/#/wager');
  await expect(page.getByTestId('wager-rival-a2-road')).toBeVisible();
  await expect(page.getByTestId('wager-rival-a2-mage')).toBeVisible();
  await expect(page.getByTestId('wager-rival-a2-lock')).toContainText('Unlocks after a2-lock');
  await expect(page.getByTestId('wager-deck-banner')).toBeVisible();
});
