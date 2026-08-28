import { test, expect } from '@playwright/test';

test.describe('Recipients page', () => {

    test('Sidebar Recipients link navigates to /recipients (via Money Sent accordion)', async ({ page }) => {
        await page.goto('/');

        // Expand the "Money Sent" accordion first
        await page.getByText('Money Sent').click();
        await page.waitForTimeout(500);

        await page.getByTestId('link-recipients').click();

        await expect(page).toHaveURL(/\/recipients$/);
        await expect(page.getByTestId('table-recipients')).toBeVisible();
    });

    test('Renders seeded recipients with name, unique code and account number', async ({ page }) => {
        await page.goto('/recipients');

        await expect(page.getByTestId('table-recipients')).toBeVisible();
        const firstRow = page.getByTestId('row-recipient-rec-001');
        await expect(firstRow).toBeVisible();
        await expect(firstRow).toContainText('Ngozi Eze');
        await expect(firstRow).toContainText('482913');
        await expect(firstRow).toContainText('0123456789');
        await expect(firstRow).toContainText('Nigeria');
        await expect(firstRow).toContainText('Bank Deposit');
    });

    test('Search filters recipients by name and by country', async ({ page }) => {
        await page.goto('/recipients');

        const search = page.getByTestId('input-search-recipients');
        await search.fill('Ngozi');

        await expect(page.getByTestId('row-recipient-rec-001')).toBeVisible();
        await expect(page.getByTestId('row-recipient-rec-002')).toHaveCount(0);

        await search.fill('Kenya');
        await expect(page.getByTestId('row-recipient-rec-006')).toBeVisible();
        await expect(page.getByTestId('row-recipient-rec-001')).toHaveCount(0);

        // Unknown term shows the empty state
        await search.fill('zzz-not-a-recipient');
        await expect(page.getByTestId('empty-recipients')).toBeVisible();
    });

    test('Sorting by full name reorders the table', async ({ page }) => {
        await page.goto('/recipients');

        await page.getByTestId('button-sort-name').click();

        const firstRow = page.locator('[data-testid^="row-recipient-"]').first();
        await expect(firstRow).toContainText('Aisha Kimani');

        // Toggling to descending flips the order
        await page.getByTestId('button-sort-name').click();
        await expect(page.locator('[data-testid^="row-recipient-"]').first()).toContainText('Sophie Dubois');
    });

    test('Pagination pages through recipients and respects the page size selector', async ({ page }) => {
        await page.goto('/recipients');

        // 12 seeded recipients at 10 per page → 2 pages
        await expect(page.locator('[data-testid^="row-recipient-"]')).toHaveCount(10);
        await expect(page.getByTestId('button-prev-page')).toBeDisabled();
        await expect(page.getByTestId('button-next-page')).toBeEnabled();

        await page.getByTestId('button-next-page').click();
        await expect(page.locator('[data-testid^="row-recipient-"]')).toHaveCount(2);
        await expect(page.getByText('Page 2 of 2')).toBeVisible();
        await expect(page.getByTestId('input-page-number')).toHaveValue('2');
        await expect(page.getByTestId('button-prev-page')).toBeEnabled();

        // Page number input jumps back to page 1
        await page.getByTestId('input-page-number').fill('1');
        await expect(page.locator('[data-testid^="row-recipient-"]')).toHaveCount(10);

        // Show 50 fits everyone on one page
        await page.getByTestId('select-page-size').click();
        await page.getByRole('option', { name: '50' }).click();
        await expect(page.locator('[data-testid^="row-recipient-"]')).toHaveCount(12);
        await expect(page.getByText('Showing 1–12 of 12 recipients')).toBeVisible();
    });

    test('Add Recipient flow creates a new row with a Nigeria narration rule', async ({ page }) => {
        await page.goto('/recipients');

        await page.getByTestId('button-add-recipient').click();
        await expect(page.getByTestId('input-new-first-name')).toBeVisible();

        await page.getByTestId('input-new-first-name').fill('Test');
        await page.getByTestId('input-new-last-name').fill('Recipient');

        // Choosing Nigeria makes narration mandatory
        await page.getByTestId('select-new-country').click();
        await page.getByRole('option', { name: /Nigeria$/ }).click();
        await expect(page.getByText('Narration is mandatory for Nigerian beneficiaries.')).toBeVisible();

        // Submit stays disabled until the mandatory narration is provided
        await page.getByTestId('input-new-bank-name').fill('GTBank');
        await page.getByTestId('input-new-account-number').fill('0987654321');
        await expect(page.getByTestId('button-confirm-add-recipient')).toBeDisabled();

        await page.getByTestId('input-new-narration').fill('Test narration');
        await expect(page.getByTestId('button-confirm-add-recipient')).toBeEnabled();

        await page.getByTestId('button-confirm-add-recipient').click();

        // Newest recipient appears first (default sort: newest on top)
        const firstRow = page.locator('[data-testid^="row-recipient-"]').first();
        await expect(firstRow).toContainText('Test Recipient');
        await expect(page.getByText('Recipient added', { exact: true })).toBeVisible();
    });

    test('Delete Recipient flow removes the row after confirmation', async ({ page }) => {
        await page.goto('/recipients');

        await page.getByTestId('button-delete-rec-002').click();
        await expect(page.getByText('Delete Recipient?')).toBeVisible();

        await page.getByTestId('button-confirm-delete').click();

        await expect(page.getByTestId('row-recipient-rec-002')).toHaveCount(0);
        await expect(page.getByText('Recipient deleted', { exact: true })).toBeVisible();
    });

    test('View Recipient modal shows full details and send action navigates', async ({ page }) => {
        await page.goto('/recipients');

        await page.getByTestId('button-view-rec-002').click();
        const modal = page.getByTestId('modal-view-recipient');
        await expect(modal.getByText('Recipient Details')).toBeVisible();
        await expect(modal.getByText('Barclays')).toBeVisible();
        await expect(modal.getByText('20-45-67')).toBeVisible();

        await page.getByTestId('button-modal-send-money').click();
        await expect(page).toHaveURL(/\/send-money/);
    });

    test('Row send action navigates to Send Money', async ({ page }) => {
        await page.goto('/recipients');

        await page.getByTestId('button-send-rec-001').click();
        await expect(page).toHaveURL(/\/send-money/);
    });

});
