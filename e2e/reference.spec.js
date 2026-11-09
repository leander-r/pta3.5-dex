import { test, expect } from '@playwright/test';

const MOCK_POKEDEX = [
    { id: 1, species: 'Bulbasaur', types: ['Grass', 'Poison'],
      baseStats: { hp: 5, atk: 5, def: 5, satk: 7, sdef: 7, spd: 5 },
      abilities: { basic: ['Overgrow'], adv: [], high: [] },
      skills: { overland: 4, swim: 2, jump: 2, power: 2 } },
];
const MOCK_GAME_DATA = { moves: {}, abilities: {}, items: {}, features: {}, natures: {} };

async function setupPage(page) {
    await page.route('**/pokedex.min.json',       r => r.fulfill({ json: MOCK_POKEDEX }));
    await page.route('**/pta-game-data.min.json', r => r.fulfill({ json: MOCK_GAME_DATA }));
    await page.goto('/');
    await page.waitForSelector('[aria-label="Loading application data"]',
        { state: 'detached', timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.locator('.nav-button', { hasText: 'Quick Reference' }).click();
    await expect(page.locator('.nav-button[aria-current="page"]')).toContainText('Quick Reference');
});

test('Quick Reference tab defaults to the Pokédex browser and lists the mocked species', async ({ page }) => {
    await expect(page.getByPlaceholder('Search species…')).toBeVisible();
    await expect(page.getByText('Bulbasaur')).toBeVisible();
});

const sections = [
    { label: 'Type Chart', heading: 'Type Effectiveness Chart' },
    { label: 'Natures', heading: /Nature Effects/ },
    { label: 'Moves Database', heading: /Moves Database/ },
    { label: 'Abilities', heading: /Abilities Database/ },
    { label: 'Game Rules', heading: 'Game Rules Quick Reference (PTA3.5)' },
    { label: 'Honor Thresholds', heading: 'Trainer Level — Honor Thresholds' },
    { label: 'Custom Content', heading: 'Custom Content' },
];

for (const { label, heading } of sections) {
    test(`navigating to "${label}" renders its panel`, async ({ page }) => {
        await page.locator('.tabs .tab', { hasText: label }).click();
        await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 });
    });
}
