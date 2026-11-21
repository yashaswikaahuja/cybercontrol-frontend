import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';

/**
 * Documents (WhatsApp receive desk) should show page-1 of a PDF
 * in the message tile. Fast path is Hub `/drive/thumb` (JPEG).
 * Raster via pdf.js is the fallback when Drive has no thumbnail.
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

/** 1×1 JPEG — same fixture as media-viewer-pinch. */
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
  'base64',
);

async function makePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 280]);
  page.drawRectangle({ x: 0, y: 0, width: 200, height: 280, color: rgb(0.85, 0.2, 0.15) });
  page.drawText('AADHAAR', { x: 28, y: 140, size: 28, color: rgb(1, 1, 1) });
  return Buffer.from(await doc.save());
}

async function setup(page: Page, opts: { thumb?: Buffer; pdf?: Buffer; downloadDelayMs?: number }) {
  await page.addInitScript((auth) => {
    localStorage.setItem('cc-auth', JSON.stringify(auth));
    localStorage.setItem('cc-wa-connected', 'true');
  }, AUTH);
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/whatsapp/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true, status: 'connected' }),
      });
      return;
    }
    if (url.includes('/drive/files')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'pdf1',
            driveFileId: 'pdf1',
            fileName: '919006615450_1700000000000_aadhaar.pdf',
            customerId: '919006615450',
            customerName: 'Shubham Kumar',
            source: 'whatsapp',
            mimeType: 'application/pdf',
            timestamp: '2026-10-14T10:00:00Z',
          },
        ]),
      });
      return;
    }
    if (url.includes('/drive/thumb/')) {
      if (opts.thumb) {
        await route.fulfill({ status: 200, contentType: 'image/jpeg', body: opts.thumb });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"No thumbnail"}' });
      }
      return;
    }
    if (url.includes('/drive/download/')) {
      if (opts.downloadDelayMs) {
        await new Promise((r) => setTimeout(r, opts.downloadDelayMs));
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: opts.pdf || Buffer.from([]),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('Documents chat tile shows a Drive thumbnail JPEG', async ({ page }) => {
  await setup(page, { thumb: TINY_JPEG });
  await page.goto('/app/whatsapp', { waitUntil: 'domcontentloaded' });
  await page.getByText('Shubham Kumar').first().click();
  const thumb = page.locator('[data-pdf-thumb="pdf1"]');
  await expect(thumb).toBeVisible({ timeout: 8000 });
  const box = await thumb.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(40);
  expect(box!.height).toBeGreaterThan(40);
});

test('Documents chat tile rasters page-1 when Drive has no thumbnail', async ({ page }) => {
  const pdf = await makePdf();
  await setup(page, { pdf });
  await page.goto('/app/whatsapp', { waitUntil: 'domcontentloaded' });
  await page.getByText('Shubham Kumar').first().click();
  const thumb = page.locator('[data-pdf-thumb="pdf1"]');
  await expect(thumb).toBeVisible({ timeout: 20000 });
  const box = await thumb.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(40);
  expect(box!.height).toBeGreaterThan(40);
});

test('Documents Open shows the tile before the full PDF download finishes', async ({ page }) => {
  await setup(page, { thumb: TINY_JPEG, downloadDelayMs: 2500 });
  await page.goto('/app/whatsapp', { waitUntil: 'domcontentloaded' });
  await page.getByText('Shubham Kumar').first().click();
  await expect(page.locator('[data-pdf-thumb="pdf1"]')).toBeVisible({ timeout: 8000 });
  await page.locator('button[title="Open"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await expect(dialog.getByRole('img', { name: /aadhaar\.pdf$/i })).toBeVisible({ timeout: 2000 });
  await expect(dialog).toHaveAttribute('data-mv-ready', '0');
});
