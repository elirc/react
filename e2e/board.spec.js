import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
test('loads real modules and reveals clues without marking them until accepted', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(25);
  const tile = page.getByRole('button', { name: 'Passover Basics: 100 points', exact: true });
  await tile.click();
  await expect(
    page.getByText('The book read during the Passover Seder.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('#answer-text')).toBeHidden();
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(page.locator('#answer-text')).toContainText('Haggadah');
  await page.getByRole('button', { name: 'Close clue', exact: true }).click();
  await expect(tile).toBeEnabled();
  await tile.click();
  await page.getByRole('button', { name: 'Mark clue used', exact: true }).click();
  await expect(page.locator('#progress')).toContainText('1 of 25');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Passover Basics: 100 points, used', exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test('category and question create update delete persist through the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.getByLabel('Category 6 name', { exact: true }).fill('CRUD practice');
  await page.getByRole('button', { name: 'Add question to category 6', exact: true }).click();
  await page
    .getByLabel('Category 6 question 1 prompt', { exact: true })
    .fill('What does CRUD stand for?');
  await page
    .getByLabel('Category 6 question 1 answer', { exact: true })
    .fill('Create, read, update, delete');
  await page.getByLabel('Category 6 question 1 points', { exact: true }).fill('600');
  await page.getByRole('button', { name: 'Save bank', exact: true }).click();
  await expect(page.locator('#editor-modal')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'CRUD practice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await page.getByLabel('Category 6 name', { exact: true }).fill('Updated category');
  await page
    .getByLabel('Category 6 question 1 prompt', { exact: true })
    .fill('Name four record operations.');
  await page.getByRole('button', { name: 'Save bank', exact: true }).click();
  await page.getByRole('button', { name: 'Updated category: 600 points', exact: true }).click();
  await expect(page.locator('#clue-text')).toHaveText('Name four record operations.');
  await page.getByRole('button', { name: 'Close clue', exact: true }).click();
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Delete question 1 from category 6', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save bank', exact: true }).click();
  await expect(page.getByText('No questions yet.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete category 6', exact: true }).click();
  await page.getByRole('button', { name: 'Save bank', exact: true }).click();
  await page.reload();
  await expect(page.locator('.category')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Updated category', exact: true })).toHaveCount(0);
});
test('cancelled editing and deletion preserve saved data', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('customJeopardy'));
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await page.getByLabel('Category 1 name', { exact: true }).fill('Discarded proposal');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Delete category 1', exact: true }).click();
  await expect(page.getByLabel('Category 1 name', { exact: true })).toHaveValue(
    'Discarded proposal',
  );
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('customJeopardy'))).toBe(before);
  await expect(page.getByRole('heading', { name: 'Passover Basics', exact: true })).toBeVisible();
});
test('storage quota failure retains the draft and leaves the visible bank unchanged', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await page.getByLabel('Category 1 name', { exact: true }).fill('Unsaved draft');
  await page.getByRole('button', { name: 'Save bank', exact: true }).click();
  await expect(page.locator('#editor-error')).toContainText('full or unavailable');
  await expect(page.getByLabel('Category 1 name', { exact: true })).toHaveValue('Unsaved draft');
  expect(await page.evaluate(() => localStorage.getItem('customJeopardy'))).toBeNull();
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Passover Basics', exact: true })).toBeVisible();
});
test('stale editor in another tab preserves its proposal and rejects overwrite', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await second.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await second.getByLabel('Category 1 name', { exact: true }).fill('Stale proposal');
  await page.getByLabel('Category 1 name', { exact: true }).fill('Winning edit');
  await page.getByRole('button', { name: 'Save bank', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Question bank saved.');
  await second.getByRole('button', { name: 'Save bank', exact: true }).click();
  await expect(second.locator('#editor-error')).toContainText('another tab');
  await expect(second.getByLabel('Category 1 name', { exact: true })).toHaveValue('Stale proposal');
  expect(
    await second.evaluate(
      () => JSON.parse(localStorage.getItem('customJeopardy')).categories[0].name,
    ),
  ).toBe('Winning edit');
  await second.close();
});
test('actual Web Locks coordinate two simultaneous tab saves', async ({ page, context }) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  for (const [index, tab] of [page, second].entries())
    await tab.evaluate(async (index) => {
      const { BoardStore } = await import('/store.js');
      window.testStore = new BoardStore(localStorage, navigator.locks);
      window.testSnapshot = window.testStore.load();
      window.testSnapshot.state.categories[0].name = `Tab ${index}`;
    }, index);
  const results = await Promise.all(
    [page, second].map((tab) =>
      tab.evaluate(async () => {
        try {
          await window.testStore.save(window.testSnapshot.state, window.testSnapshot.raw);
          return 'saved';
        } catch {
          return 'conflict';
        }
      }),
    ),
  );
  expect(results.sort()).toEqual(['conflict', 'saved']);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('customJeopardy')).revision),
  ).toBe(1);
  await second.close();
});
test('corrupt saved data remains intact until explicit confirmed replacement', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('fixture-set')) {
      localStorage.setItem('customJeopardy', '{broken');
      sessionStorage.setItem('fixture-set', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('#error')).toContainText('not valid JSON');
  await expect(
    page.getByRole('button', { name: 'Edit question bank', exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('customJeopardy'))).toBe('{broken');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Replace with example board', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('customJeopardy'))).toBe('{broken');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Replace with example board', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit question bank', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('#error-panel')).toBeHidden();
});
test('import renders hostile-looking names literally and export produces valid data', async ({
  page,
}) => {
  await page.goto('/');
  const value = {
    schemaVersion: 1,
    revision: 0,
    categories: [
      {
        id: 'category-import',
        name: '<img src=x onerror=alert(1)>',
        questions: [
          { id: 'question-import', prompt: 'Literal <b>prompt</b>', answer: 'A & B', points: 100 },
        ],
      },
    ],
    usedQuestionIds: [],
  };
  page.once('dialog', (d) => d.accept());
  await page
    .locator('#import-file')
    .setInputFiles({
      name: 'board.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    });
  await expect(
    page.getByRole('heading', { name: value.categories[0].name, exact: true }),
  ).toBeVisible();
  await expect(page.locator('img')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export board', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('quiz-board.json');
  const stream = await file.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  expect(JSON.parse(text).categories).toEqual(value.categories);
});
test('new round restores clue availability without resetting edited questions', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Passover Basics: 100 points', exact: true }).click();
  await page.getByRole('button', { name: 'Mark clue used', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'New round', exact: true }).click();
  await expect(page.locator('#progress')).toContainText('0 of 25');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Passover Basics: 100 points', exact: true }),
  ).toBeEnabled();
});
test('desktop and narrow layouts fit and dialogs support keyboard dismissal', async ({ page }) => {
  const directory = process.env.QUIZ_RESULTS_DIR;
  if (directory) mkdirSync(directory, { recursive: true });
  for (const [name, width] of [
    ['desktop', 1280],
    ['narrow', 390],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.tile')).toHaveCount(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (directory) await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Edit question bank', exact: true }).click();
  await expect(page.locator('#editor-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-modal')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit question bank', exact: true })).toBeFocused();
});

test('static server serves only app assets and supplies browser content boundaries', async ({
  request,
}) => {
  const root = await request.get('/');
  expect(root.status()).toBe(200);
  expect(root.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(root.headers()['x-content-type-options']).toBe('nosniff');
  for (const resource of [
    '/package.json',
    '/server.js',
    '/.env',
    '/README.md',
    '/test/store.test.js',
  ])
    expect((await request.get(resource)).status()).toBe(404);
  expect((await request.post('/main.js', { data: {} })).status()).toBe(404);
  const head = await request.head('/store.js');
  expect(head.status()).toBe(200);
  expect(await head.text()).toBe('');
});
