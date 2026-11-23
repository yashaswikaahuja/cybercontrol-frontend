import { test, expect } from '@playwright/test';

/**
 * Profile village field: pick an LGD village, tick the suggested address fields, save.
 * The API is mocked; the PATCH body is what the backend would receive.
 */

const AUTH = {
  state: {
    accessToken: 'e2e-token',
    refreshToken: 'e2e-refresh',
    user: { id: 'u1', workspaceId: 'ws_e2e0001', name: 'Test Operator', email: 'qa@example.com', role: 'admin' },
    isAuthenticated: true,
  },
  version: 0,
};
const PHONE = '9876543210';

test('picking a village saves the village and the ticked address fields', async ({ page }) => {
  const data: Record<string, any> = { name: { value: 'Test Person', source: 'manual' }, district: { value: 'Gaya', source: 'manual' } };
  const patches: any[] = [];

  await page.addInitScript((auth) => { localStorage.setItem('cc-auth', JSON.stringify(auth)); }, AUTH);
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/customers/households')) {
      return json([{ phone: PHONE, persons: [{ id: 'p1', name: 'Test Person', display_label: 'Test Person', relationship: 'self' }] }]);
    }
    if (url.pathname.endsWith('/customers/persons/p1') && req.method() === 'GET') {
      return json({ id: 'p1', name: 'Test Person', display_label: 'Test Person', relationship: 'self', data });
    }
    if (url.pathname.endsWith('/customers/persons/p1') && req.method() === 'PATCH') {
      const body = req.postDataJSON();
      patches.push(body);
      Object.assign(data, body.fields);
      return json({ ok: true, id: 'p1', created: false, redirected: false, name: 'Test Person' });
    }
    if (url.pathname.endsWith('/address/villages')) {
      return json([{ kind: 'village', code: 255133, name: 'Bikaipur', lgdVillage: null, subDistrict: 'Muhra', block: 'Mohra', district: 'Gaya', state: 'Bihar' }]);
    }
    if (url.pathname.endsWith('/address/resolve')) {
      return json({ fields: { police_station: { value: 'Atri', source: 'learned', confidence: 0.85, needsReview: false } }, options: {} });
    }
    return json([]);
  });

  await page.goto(`/app/customers/${PHONE}?person=p1`, { waitUntil: 'domcontentloaded' });
  const villageRow = page.locator('div', { has: page.locator('span', { hasText: /^Village$/ }) }).filter({ has: page.locator('button') }).last();
  await villageRow.getByRole('button').first().click();
  await page.getByRole('combobox', { name: 'Village' }).fill('bika');
  await page.getByRole('option', { name: /Bikaipur/ }).click();
  await expect(page.getByText('Muhra', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Save village/ }).click();

  await expect.poll(() => patches.length).toBe(1);
  const fields = patches[0].fields;
  expect(fields.village).toMatchObject({ value: 'Bikaipur', source: 'manual' });
  expect(fields.sub_district).toMatchObject({ value: 'Muhra', source: 'address_engine', addressSource: 'reference' });
  expect(fields.block).toMatchObject({ value: 'Mohra' });
  expect(fields.state).toMatchObject({ value: 'Bihar' });
  expect(fields.police_station).toMatchObject({ value: 'Atri', addressSource: 'learned' });
  expect(fields.district, 'already Gaya on the profile').toBeUndefined();
  await expect(page.getByRole('combobox', { name: 'Village' })).toHaveCount(0);
  await expect(page.getByText('Mohra', { exact: true })).toBeVisible();
});

test('a differing value is ticked and replaces the old one; a doubtful learned value is not', async ({ page }) => {
  const data: Record<string, any> = { sub_district: { value: 'Atri', source: 'document' }, district: { value: 'Gaya', source: 'document' } };
  const patches: any[] = [];
  await page.addInitScript((auth) => { localStorage.setItem('cc-auth', JSON.stringify(auth)); }, AUTH);
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/customers/households')) return json([{ phone: PHONE, persons: [{ id: 'p1', name: 'Test Person', display_label: 'Test Person', relationship: 'self' }] }]);
    if (path.endsWith('/customers/persons/p1') && req.method() === 'GET') return json({ id: 'p1', name: 'Test Person', display_label: 'Test Person', data });
    if (path.endsWith('/customers/persons/p1')) { const b = req.postDataJSON(); patches.push(b); Object.assign(data, b.fields); return json({ ok: true, id: 'p1' }); }
    if (path.endsWith('/address/villages')) return json([{ kind: 'hamlet', code: 255133, name: 'Charwara', lgdVillage: 'Bikaipur', subDistrict: 'Muhra', block: 'Mohra', district: 'Gaya', state: 'Bihar' }]);
    if (path.endsWith('/address/resolve')) return json({ fields: { police_station: { value: 'Atri', source: 'learned', confidence: 0.5, needsReview: true } }, options: {} });
    return json([]);
  });
  await page.goto(`/app/customers/${PHONE}?person=p1`, { waitUntil: 'domcontentloaded' });
  const villageRow = page.locator('div', { has: page.locator('span', { hasText: /^Village$/ }) }).filter({ has: page.locator('button') }).last();
  await villageRow.getByRole('button').first().click();
  await page.getByRole('combobox', { name: 'Village' }).fill('charw');
  await page.getByRole('option', { name: /Charwara/ }).click();
  await expect(page.getByRole('checkbox', { name: /Sub-District/ })).toBeChecked();
  await expect(page.getByText('replaces: Atri')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Police Station/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Save village + 3 fields' }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0].fields.sub_district).toMatchObject({ value: 'Muhra' });
  expect(patches[0].fields.police_station).toBeUndefined();
});

test('picking a town fills city, post office and PIN from India Post', async ({ page }) => {
  const data: Record<string, any> = { state: { value: 'Bihar', source: 'manual' } };
  const patches: any[] = [];
  await page.addInitScript((auth) => { localStorage.setItem('cc-auth', JSON.stringify(auth)); }, AUTH);
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/customers/households')) return json([{ phone: PHONE, persons: [{ id: 'p1', name: 'Test Person', display_label: 'Test Person', relationship: 'self' }] }]);
    if (path.endsWith('/customers/persons/p1') && req.method() === 'GET') return json({ id: 'p1', name: 'Test Person', display_label: 'Test Person', data });
    if (path.endsWith('/customers/persons/p1')) { const b = req.postDataJSON(); patches.push(b); Object.assign(data, b.fields); return json({ ok: true, id: 'p1' }); }
    if (path.endsWith('/address/villages')) {
      return json([{ kind: 'town', code: null, name: 'Rajgir', lgdVillage: null, subDistrict: null, block: null, district: 'Nalanda', state: 'Bihar', pincode: '803116', postOffice: 'Rajgir' }]);
    }
    if (path.endsWith('/address/resolve')) return json({ fields: {}, options: {} });
    return json([]);
  });
  await page.goto(`/app/customers/${PHONE}?person=p1`, { waitUntil: 'domcontentloaded' });
  const villageRow = page.locator('div', { has: page.locator('span', { hasText: /^Village$/ }) }).filter({ has: page.locator('button') }).last();
  await villageRow.getByRole('button').first().click();
  await page.getByRole('combobox', { name: 'Village' }).fill('Rajgir');
  await expect(page.getByRole('option', { name: /town .* PIN 803116/ })).toBeVisible();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Save village + 4 fields' }).click();
  await expect.poll(() => patches.length).toBe(1);
  const f = patches[0].fields;
  expect(f.city).toMatchObject({ value: 'Rajgir' });
  expect(f.district).toMatchObject({ value: 'Nalanda' });
  expect(f.post_office).toMatchObject({ value: 'Rajgir' });
  expect(f.pincode).toMatchObject({ value: '803116' });
  expect(f.state, 'already Bihar').toBeUndefined();
});