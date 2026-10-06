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
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = r.user;
  const sheet = workbook.addWorksheet('Relatório');
  sheet.addRow([r.title]);
  sheet.addRow([label]);
  sheet.addRow([subtitle(r)]);
  sheet.addRow([period(r)]);
  sheet.addRow([]);
  const keys = Object.keys(r.rows[0] || {});
  sheet.addRow(keys);
  for (const row of r.rows) sheet.addRow(keys.map((k) => row[k] as ExcelJS.CellValue));
  sheet.getRow(1).font = { bold: true, size: 16 };
  sheet.getRow(6).font = { bold: true };
  keys.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 25;
  });
  sheet.views = [{ state: 'frozen', ySplit: 6 }];
  download(
    new Blob([await workbook.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `relatorio-${r.kind}.xlsx`,
  );
}
