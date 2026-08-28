import { test, expect } from '@playwright/test';

test.describe('Sidebar Transactions deep link', () => {

    test('clicking Transactions under Money Sent filters the dashboard to Send Money and centers the table', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('table-transactions')).toBeVisible();

        // Expand the "Money Sent" accordion and click its Transactions item
        await page.getByText('Money Sent').click();
        await page.waitForTimeout(500);
        await page.getByTestId('link-transactions').click();

        await expect(page).toHaveURL(/\?type=send_money$/);

        // The Send Money chip is selected instead of All
        await expect(page.getByTestId('chip-type-send-money')).toHaveClass(/bg-blue-600/);
        await expect(page.getByTestId('chip-type-all')).not.toHaveClass(/bg-blue-600/);

        // Every visible row is a Send Money row (no money-in records mixed in)
        const rows = page.locator('[data-testid^="row-transaction-"], [data-testid^="row-scheduled-"]');
        await expect(rows.filter({ hasNotText: 'Send Money' })).toHaveCount(0);
        await expect(rows.first()).toBeVisible();

        // The transactions section is scrolled fully into view (centered):
        // before the scroll its bottom sits below the viewport, so polling
        // the bottom edge also waits for the data load + smooth scroll
        const viewport = page.viewportSize();
        await expect.poll(async () => {
            const box = await page.getByTestId('section-transactions').boundingBox();
            return Math.round(box.y + box.height);
        }, { timeout: 8000 }).toBeLessThanOrEqual(viewport.height + 1);
        const box = await page.getByTestId('section-transactions').boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.y).toBeLessThan(viewport.height / 2);
    });

    test('deep link applies the filter also when the dashboard is already open', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('table-transactions')).toBeVisible();
        await expect(page.getByTestId('chip-type-all')).toHaveClass(/bg-blue-600/);

        // Navigate from the open dashboard via the sidebar link
        await page.getByText('Money Sent').click();
        await page.waitForTimeout(500);
        await page.getByTestId('link-transactions').click();

        await expect(page).toHaveURL(/\?type=send_money$/);
        await expect(page.getByTestId('chip-type-send-money')).toHaveClass(/bg-blue-600/);
    });

    test('plain dashboard load keeps the All filter by default', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('table-transactions')).toBeVisible();
        await expect(page.getByTestId('chip-type-all')).toHaveClass(/bg-blue-600/);
        await expect(page.getByTestId('chip-type-send-money')).not.toHaveClass(/bg-blue-600/);
    });

});
