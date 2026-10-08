import { test, expect } from '@playwright/test';

test.describe('Signed-in name', () => {
    test('the dashboard welcome and header show the customer who is logged in', async ({ page }) => {
        await page.route('**/api/auth/me', (route) => route.fulfill({
            json: { user: { id: 'u-mk', email: 'mohammad@example.com', accountType: 'individual', country: 'GB', firstName: 'Mohammad', lastName: 'Khan', status: 'active' } },
        }));
        await page.goto('/');
        await expect(page.getByTestId('dashboard-welcome')).toHaveText('Welcome Mohammad');
        await expect(page.getByTestId('header-initials')).toHaveText('MK');
        await expect(page.getByTestId('header-profile-label')).toHaveText('Individual Profile');
        await expect(page.getByText('Olayinka', { exact: false })).toHaveCount(0);
    });
});
