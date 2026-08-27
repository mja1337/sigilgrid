import { test, expect } from '@playwright/test';

/** Walks into a practice match and dismisses the coin-toss modal. */
async function startPractice(page: import('@playwright/test').Page) {
  await page.goto('/#/play?mode=practice&seed=42');
  await page.getByTestId('kickoff-continue').click();
  await expect(page.locator('.board')).toBeVisible();
}

test('play screen never scrolls horizontally', async ({ page }, testInfo) => {
  await startPractice(page);
  // Deliberately NOT documentElement.clientWidth: under mobile emulation the
  // layout viewport grows to swallow overflowing content, so it would report
  // no overflow no matter how far the hand spilled past the screen. The
  // configured device width is the only honest reference.
  const deviceWidth = testInfo.project.use.viewport?.width ?? 1280;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(deviceWidth);
});

test('every hand card is reachable inside the viewport', async ({ page }, testInfo) => {
  await startPractice(page);
  const cards = page.locator('.hand-column .card-face');
  await expect(cards).toHaveCount(5);

  const width = testInfo.project.use.viewport?.width ?? 1280;
  for (let i = 0; i < 5; i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box, `hand card ${i} has no box`).not.toBeNull();
    expect(box!.x, `hand card ${i} starts off-screen`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `hand card ${i} overflows the viewport`).toBeLessThanOrEqual(width);
  }
});

test('board and hand share one screen on a phone', async ({ page }, testInfo) => {
  const viewport = testInfo.project.use.viewport;
  test.skip(!viewport || viewport.width > 840, 'phone layout only');

  await startPractice(page);
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(scrollHeight).toBeLessThanOrEqual(viewport!.height);

  // Both must be on screen at once — this is a game of reading your hand
  // against the grid, so a layout that hides one behind a scroll is broken.
  const board = await page.locator('.board').boundingBox();
  const hand = await page.locator('.player-hand').boundingBox();
  expect(board).not.toBeNull();
  expect(hand).not.toBeNull();
  expect(board!.y + board!.height).toBeLessThanOrEqual(viewport!.height);
  expect(hand!.y + hand!.height).toBeLessThanOrEqual(viewport!.height);
});

test('long-press inspects a card without selecting it', async ({ page }) => {
  await page.goto('/#/collection');
  await page.getByTestId('tab-deck').click();
  const card = page.locator('.album .card-face').first();
  await expect(card).toBeVisible();

  const selectedBefore = await page.locator('.album .card-face.selected').count();
  // boundingBox is viewport-relative, so an off-screen card would put the
  // synthetic press somewhere else entirely.
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();

  await expect(page.getByRole('dialog', { name: 'Card inspect' })).toBeVisible();
  // The click that follows a long press must not also toggle deck membership.
  expect(await page.locator('.album .card-face.selected').count()).toBe(selectedBefore);
});

test('a short tap selects instead of inspecting', async ({ page }) => {
  // The Deck tab is where tap and long-press diverge: tap toggles deck
  // membership, long-press inspects. In the Album tab a tap inspects, since
  // there is nothing to select there.
  await page.goto('/#/collection');
  await page.getByTestId('tab-deck').click();
  const card = page.locator('.album .card-face').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('dialog', { name: 'Card inspect' })).toBeHidden();
});
