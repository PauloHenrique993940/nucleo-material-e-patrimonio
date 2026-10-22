import assert from 'node:assert/strict';
import request from 'supertest';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { stockStatus } from '../backend/src/utils/status.ts';
import { expiryInfo } from '../frontend/src/utils/expiry.ts';

export async function verifyProductPagination(app, db, token, categoryId) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const dates = [
    null,
    ...[-1, 0, 30, 31].map((days) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000)),
  ];
  const fixtures = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      db.material.create({
        data: {
          code: `FILTER-${String(i).padStart(2, '0')}`,
          name: `Filter fixture ${i % 3}`,
          categoryId,
          quantity: [0, 1, 2, 5, 6][i % 5],
          minimum: 5,
          active: i % 2 === 0,
          expiryDate: dates[Math.floor(i / 5)],
          unitPrice: 25 - i,
        },
      }),
    ),
  );
  const get = async (params) => {
    const response = await request(app)
      .get('/api/materials')
      .query({ q: 'FILTER-', page: 1, pageSize: 2, sort: 'code', ...params })
      .set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 200);
    return response.body;
  };
  let checks = 0;
  for (const stock of ['', 'Normal', 'Baixo', 'Crítico', 'Sem estoque']) {
    for (const expiry of ['', 'missing', 'expired', 'soon', 'valid']) {
      for (const active of ['', 'true', 'false']) {
        const expected = fixtures
          .filter(
            (row) =>
              (!stock || stockStatus(row.quantity, row.minimum) === stock) &&
              (!expiry || expiryInfo(row.expiryDate?.toISOString()).state === expiry) &&
              (!active || String(row.active) === active),
          )
          .sort((a, b) => a.code.localeCompare(b.code));
        const actual = await get({ stock, expiry, active });
        assert.equal(actual.total, expected.length);
        assert.deepEqual(
          actual.rows.map((r) => r.id),
          expected.slice(0, 2).map((r) => r.id),
        );
        checks++;
      }
    }
  }
  const first = await get({ pageSize: 10 });
  const second = await get({ page: 2, pageSize: 10 });
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 20);
  assert.equal((await get({ page: 100 })).rows.length, 0);
  const sorted = await get({ sort: 'unitPrice', order: 'desc' });
  assert.deepEqual(
    sorted.rows.map((r) => Number(r.unitPrice)),
    [25, 24],
  );
  await db.material.create({
    data: { code: 'REMOVED', name: 'FILTER-deleted', categoryId, deletedAt: new Date() },
  });
  assert.equal((await get({})).total, fixtures.length);
  await db.material.create({ data: { code: 'LITERAL%', name: 'percent fixture', categoryId } });
  const percent = await request(app)
    .get('/api/materials')
    .query({ q: '%', page: 1 })
    .set('Authorization', `Bearer ${token}`);
  assert.equal(percent.status, 200);
  assert.equal(percent.body.total, 1);
  for (const params of [
    { stock: 'invalid' },
    { expiry: 'invalid' },
    { sort: 'name; DROP TABLE' },
    { page: '-1' },
    { pageSize: 101 },
  ]) {
    const response = await request(app)
      .get('/api/materials')
      .query(params)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 400);
  }
  console.log(
    `Pagination integration passed: ${checks} filter combinations, distinct pages, ordering, removed records, literal search, invalid parameters.`,
  );

  const apiServer = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => apiServer.once('listening', resolve));
  const web = await createServer({
    configFile: false,
    root: 'frontend',
    plugins: [
      (await import('@vitejs/plugin-react')).default(),
      (await import('@tailwindcss/vite')).default(),
    ],
    server: {
      host: '127.0.0.1',
      port: 41735,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${apiServer.address().port}` },
    },
  });
  let browser;
  try {
    await web.listen();
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [],
      materialsRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/materials') materialsRequests.push(req.url());
    });
    await page.addInitScript((value) => localStorage.setItem('nucleo-token', value), token);
    await page.goto('http://127.0.0.1:41735/materials');
    await expect(page.locator('.entity-table tbody tr')).toHaveCount(15);
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(page.locator('.pagination')).toContainText('Página 2');
    await expect(page.locator('.entity-table tbody tr')).toHaveCount(15);
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await page.getByLabel('Pesquisar Materiais').fill('PERF-05000');
    await expect(page.locator('.entity-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.record-count')).toContainText('1 registros');
    await page.getByLabel('Pesquisar Materiais').fill('FILTER-');
    await page.getByLabel('Situação do estoque').selectOption('Crítico');
    await expect(page.locator('.record-count')).toContainText('5 registros');
    await page.getByLabel('Filtrar por validade').selectOption('soon');
    await expect(page.locator('.record-count')).toContainText('2 registros');
    await expect(page.locator('.entity-table tbody tr')).toHaveCount(2);
    await page.getByRole('button', { name: 'Valor unitário' }).click();
    await expect(page.locator('.entity-table tbody tr')).toHaveCount(2);
    assert(
      materialsRequests.length > 0 &&
        materialsRequests.every((url) => new URL(url).searchParams.has('page')),
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: '.artifacts/materials-pagination-optimized.png',
      fullPage: true,
    });
    console.log(
      'Browser passed: 10,000 products, next/previous, search, combined filters, sorting, no unpaginated material requests or JS errors.',
    );
  } finally {
    await browser?.close();
    await web.close();
    await new Promise((resolve) => apiServer.close(resolve));
  }
}
