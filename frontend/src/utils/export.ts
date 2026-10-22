import type ExcelJS from 'exceljs';
import { date } from './format';
export type Report = {
  title: string;
  issuedAt: string;
  user: string;
  kind: string;
  from?: string;
  to?: string;
  rows: Record<string, unknown>[];
};
const subtitle = (r: Report) => `Emissão: ${date(r.issuedAt)} | Responsável: ${r.user}`;
const period = (r: Report) =>
  `Período: ${r.from ? date(r.from) : 'Sem limite inicial'} a ${r.to ? date(r.to) : 'Sem limite final'}`;
const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export async function exportPDF(r: Report, label: string) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(r.title, 14, 15);
  doc.setFontSize(10);
  doc.text(label, 14, 23);
  doc.text(subtitle(r), 14, 30);
  doc.text(period(r), 14, 37);
  const keys = Object.keys(r.rows[0] || {});
  autoTable(doc, {
    startY: 44,
    head: [keys],
    body: r.rows.map((row) => keys.map((k) => String(row[k] ?? ''))),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 94, 81] },
  });
  doc.save(`relatorio-${r.kind}.pdf`);
}
export async function exportExcel(r: Report, label: string) {
  return exportExcelBundle([{ report: r, label }]);
}
export async function exportExcelBundle(reports: { report: Report; label: string }[]) {
  if (!reports.length) throw new Error('Selecione pelo menos um relatório.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = reports[0].report.user;
  workbook.created = new Date();
  for (const [index, { report: r, label }] of reports.entries()) {
    const sheet = workbook.addWorksheet(
      `${index + 1} ${label}`.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31),
    );
    sheet.addRow([r.title]);
    sheet.addRow([label]);
    sheet.addRow([subtitle(r)]);
    sheet.addRow([period(r)]);
    sheet.addRow([]);
    const keys = Object.keys(r.rows[0] || {});
    const headers = sheet.addRow(keys.length ? keys : ['Sem registros']);
    headers.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF19456B' } };
    headers.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    for (const row of r.rows) sheet.addRow(keys.map((k) => row[k] as ExcelJS.CellValue));
    sheet.getRow(1).font = { bold: true, size: 16 };
    keys.forEach((key, i) => {
      const column = sheet.getColumn(i + 1);
      column.width = /Material|Bem|Grupo/.test(key)
        ? 55
        : Math.max(18, Math.min(30, key.length + 4));
      if (/Valor|Custo/.test(key)) column.numFmt = '"R$" #,##0.00';
      else if (r.rows.length && r.rows.every((row) => typeof row[key] === 'number'))
        column.numFmt = '#,##0.00';
    });
    if (keys.length)
      sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: keys.length } };
    for (let row = 7; row <= r.rows.length + 6; row++) {
      if (row % 2 === 0)
        sheet.getRow(row).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F5FA' },
        };
    }
    if (r.rows.length) {
      const total = sheet.addRow(
        keys.map((key, i) =>
          i === 0
            ? 'TOTAL'
            : /^(Quantidade|Valor total|Valor|Custo total)$/.test(key) &&
                r.rows.every((row) => typeof row[key] === 'number')
              ? r.rows.reduce((sum, row) => sum + Number(row[key]), 0)
              : null,
        ),
      );
      total.font = { bold: true };
    }
    sheet.views = [{ state: 'frozen', ySplit: 6 }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  download(
    new Blob([await workbook.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    reports.length === 1 ? `relatorio-${reports[0].report.kind}.xlsx` : 'relatorios-estoque.xlsx',
  );
}
