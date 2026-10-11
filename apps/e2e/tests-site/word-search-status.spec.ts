import { expect, test } from '@playwright/test';

const hit = (id: number, word: string) => ({ id, word, part_of_speech: 'verb', transcription: null });

test('search announces loading, results, empty results and errors without moving focus', async ({ page }) => {
  let finish: () => Promise<void>;
  let response = { data: [hit(1, 'run'), hit(2, 'running')], meta: { fuzzy: false } };
  let status = 200;
  let networkError = false;
  let requests = 0;
  let completed = 0;
  const complete = async () => {
    completed++;
    await expect.poll(() => requests).toBe(completed);
    await finish!();
  };
  await page.route('**/api/v1/search?**', async (route) => {
    requests++;
    finish = () => (networkError ? route.abort() : route.fulfill({ status, json: response }));
  });
  await page.goto('/en/word');
  const form = page.getByRole('search');
  const input = form.getByRole('searchbox');
  const button = form.getByRole('button', { name: 'Search', exact: true });
  const announcement = page.getByRole('status');
  await expect(announcement).toBeEmpty();
  await expect(announcement).toHaveAttribute('aria-live', 'polite');
  await expect(announcement).toHaveAttribute('aria-atomic', 'true');
  await expect(form).toHaveAttribute('aria-busy', 'false');
  await input.fill('run');
  await input.press('Enter');
  await expect(announcement).toHaveText('Searching…');
  await expect(form).toHaveAttribute('aria-busy', 'true');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect.poll(() => requests).toBe(1);
  await complete();
  await expect(announcement).toHaveText('2 results shown.');
  await expect(form).toHaveAttribute('aria-busy', 'false');
  await expect(input).toBeFocused();
  await expect(announcement.getByRole('list')).toHaveCount(0);
  await expect(announcement.getByRole('link')).toHaveCount(0);
  await expect(
    page.locator('ul').filter({ has: page.getByRole('link', { name: 'running', exact: true }) }),
  ).not.toHaveAttribute('aria-live');

  // A keyboard activation of the submit button must keep its focus during loading too.
  await input.press('Tab');
  await expect(button).toBeFocused();
  response = { data: [], meta: { fuzzy: false } };
  await button.press('Enter');
  await expect(announcement).toHaveText('Searching…');
  await expect(button).toBeFocused();
  await complete();
  await expect(announcement).toHaveText('Nothing found.');
  await expect(button).toBeFocused();

  status = 503;
  await button.press('Enter');
  await expect(announcement).toHaveText('Searching…');
  await complete();
  await expect(announcement).toHaveText('The dictionary did not answer.');
  await expect(button).toBeFocused();

  networkError = true;
  await button.press('Enter');
  await expect(announcement).toHaveText('Searching…');
  await complete();
  await expect(announcement).toHaveText('The dictionary did not answer.');

  networkError = false;
  status = 200;
  response = { data: [hit(1, 'run')], meta: { fuzzy: true } };
  await button.press('Enter');
  await expect(announcement).toHaveText('Searching…');
  await complete();
  await expect(announcement).toHaveText('1 result shown. No exact match — these are the closest spellings.');
  await expect(button).toBeFocused();
});

test('Arabic search keeps RTL and announces localized singular and dual counts', async ({ page }) => {
  let count = 2;
  await page.route('**/api/v1/search?**', (route) =>
    route.fulfill({
      json: { data: [hit(1, 'run'), hit(2, 'running')].slice(0, count), meta: { fuzzy: false } },
    }),
  );
  await page.goto('/ar/word');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const input = page.getByRole('searchbox');
  await expect(page.getByRole('status')).toBeEmpty();
  await input.fill('run');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('تُعرض نتيجتان.');
  await expect(input).toBeFocused();
  count = 1;
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('تُعرض نتيجة واحدة.');
  await expect(input).toBeFocused();
});

test('a restored search announces its result after loading', async ({ page }) => {
  await page.goto('/en/word?q=sprint');
  await expect(page.getByRole('searchbox')).toHaveValue('sprint');
  await expect(page.getByRole('status')).toHaveText('1 result shown.');
});
