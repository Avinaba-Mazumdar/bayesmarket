import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Public pages that do not need a signed-in account. Each must pass WCAG 2.2 AA with no violations.
const publicPages = ['/', '/privacy', '/terms'];

for (const path of publicPages) {
    test(`no WCAG 2.2 AA violations on ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

        expect(results.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
}
