import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page
    .getByLabel('E-mail ou matrícula')
    .fill(process.env.SEED_ADMIN_EMAIL || 'admin@nucleo.local');
  await page.getByLabel('Senha', { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});
test('sessão persistente, tema e navegação responsiva', async ({ page }) => {
  await expect(page.locator('.stat-grid')).toBeVisible();
  await page.screenshot({ path: '../.artifacts/dashboard-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Abrir menu' }).press('Enter');
  await expect(page.getByRole('dialog', { name: 'Navegação' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
  await page.getByRole('button', { name: 'Abrir menu' }).press('Enter');
  await page.getByRole('link', { name: 'Materiais', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Materiais', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: '../.artifacts/materials-mobile.png', fullPage: true });
});
test('cadastro, entrada, saída, bloqueio de saldo e histórico', async ({ page }) => {
  const code = 'E2E-' + Date.now();
  await page.getByRole('link', { name: 'Materiais', exact: true }).click();
  await page.getByRole('button', { name: 'Novo cadastro' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código', { exact: true }).fill(code);
  await dialog.getByLabel('Nome', { exact: true }).fill('Material E2E ' + code);
  await dialog
    .getByLabel('Categoria', { exact: true })
    .selectOption({ label: 'Material de expediente' });
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Entrada', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Entrada de material', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Material', { exact: true })
    .selectOption({ label: 'Material E2E ' + code });
  await page.getByLabel('Quantidade', { exact: true }).fill('5');
  await page.getByLabel('Responsável pelo recebimento').fill('Equipe E2E');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Saída', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saída de material', exact: true })).toBeVisible();
  await page
    .getByLabel('Material', { exact: true })
    .selectOption({ label: 'Material E2E ' + code });
  await page.getByLabel('Quantidade', { exact: true }).fill('6');
  await page.getByLabel('Setor solicitante').selectOption({ label: 'Administração' });
  await page.getByLabel('Responsável pela retirada').fill('Servidor E2E');
  await page.getByLabel('Responsável pela entrega').fill('Operador E2E');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Saldo insuficiente');
  await page.getByLabel('Quantidade', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Movimentações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Movimentações', exact: true })).toBeVisible();
  await page
    .getByLabel('Material', { exact: true })
    .selectOption({ label: 'Material E2E ' + code });
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('Saída');
  await expect(page.locator('tbody')).toContainText('Entrada');
});
test('relatórios e arquivos PDF/Excel', async ({ page }, testInfo) => {
  await page.getByRole('link', { name: 'Relatórios', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.locator('.report-preview')).toContainText('Núcleo de Material e Patrimônio');
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const pdfDownload = await pdf;
  expect(pdfDownload.suggestedFilename()).toBe('relatorio-stock.pdf');
  const pdfPath = testInfo.outputPath('report.pdf');
  await pdfDownload.saveAs(pdfPath);
  expect((await readFile(pdfPath)).subarray(0, 4).toString()).toBe('%PDF');
  const excel = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const excelDownload = await excel;
  expect(excelDownload.suggestedFilename()).toBe('relatorio-stock.xlsx');
  const excelPath = testInfo.outputPath('report.xlsx');
  await excelDownload.saveAs(excelPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  expect(workbook.worksheets[0].getCell('A1').value).toBe('Núcleo de Material e Patrimônio');
  expect(workbook.worksheets[0].rowCount).toBeGreaterThan(6);
});
test('perfil de consulta não grava materiais nem movimentações', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('nucleo-token'));
  const email = `viewer-e2e-${Date.now()}@test.local`;
  const password = 'Consulta-e2e-segura-123!';
  const response = await page.request.post('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Consulta E2E', email, registration: email, password, role: 'VIEWER' },
  });
  expect(response.status()).toBe(201);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.getByLabel('E-mail ou matrícula').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Materiais', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Materiais', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo cadastro' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Entrada', exact: true })).toHaveCount(0);
  const viewer = await page.evaluate(() => localStorage.getItem('nucleo-token'));
  expect(
    (
      await page.request.post('/api/movements', {
        headers: { Authorization: `Bearer ${viewer}` },
        data: {},
      })
    ).status(),
  ).toBe(403);
});
