export const documentTemplates = [
  {
    id: 'requisicao',
    title: 'Requisição de material',
    description: 'Solicite materiais para um setor e registre a finalidade.',
    statement:
      'Solicito o fornecimento dos itens relacionados abaixo para atendimento às necessidades do setor informado.',
    signatures: ['Solicitante', 'Autorização / chefia'],
  },
  {
    id: 'entrega',
    title: 'Recibo de entrega',
    description: 'Registre os itens entregues e a confirmação de recebimento.',
    statement:
      'Declaro ter recebido os itens relacionados abaixo, nas quantidades indicadas neste documento.',
    signatures: ['Responsável pela entrega', 'Recebedor'],
  },
  {
    id: 'responsabilidade',
    title: 'Termo de responsabilidade',
    description: 'Identifique os bens sob a guarda de um responsável.',
    statement:
      'Declaro ter recebido os bens relacionados abaixo para uso no serviço. Comprometo-me a zelar por sua conservação e comunicar ao setor responsável qualquer necessidade de manutenção ou alteração de guarda.',
    signatures: ['Responsável pela guarda', 'Responsável pelo patrimônio'],
  },
  {
    id: 'transferencia',
    title: 'Termo de transferência',
    description: 'Documente a mudança de setor e responsável pelos bens.',
    statement:
      'Registramos a transferência dos bens relacionados abaixo entre os setores de origem e destino informados neste documento.',
    signatures: ['Responsável na origem', 'Responsável no destino'],
  },
  {
    id: 'inventario',
    title: 'Ficha de conferência de inventário',
    description: 'Registre a contagem física e as observações da conferência.',
    statement:
      'Os itens abaixo foram conferidos fisicamente no setor informado. As quantidades representam a contagem registrada pelo responsável pela conferência.',
    signatures: ['Responsável pela conferência', 'Responsável pelo setor'],
  },
] as const;
export type DocumentTemplate = (typeof documentTemplates)[number];
export type DocumentItem = { code: string; name: string; quantity: string; unit: string };
export type DocumentData = {
  number: string;
  date: string;
  department: string;
  destination: string;
  person: string;
  registration: string;
  issuer: string;
  process: string;
  notes: string;
  items: DocumentItem[];
};
export function localDocumentDate() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export async function exportDocumentPDF(template: DocumentTemplate, data: DocumentData) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  doc.setFillColor(65, 87, 133);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Núcleo de Material e Patrimônio', 16, 14);
  doc.setFontSize(11);
  doc.text(template.title, 16, 24);
  doc.setDrawColor(224, 181, 59);
  doc.setLineWidth(1);
  doc.line(0, 33, 210, 33);
  const formattedDate = data.date.split('-').reverse().join('/');
  const meta = [
    ['Documento', data.number || 'Sem número', 'Data', formattedDate],
    ['Setor / origem', data.department, 'Responsável / recebedor', data.person],
    ['Matrícula', data.registration || '—', 'Emitente', data.issuer],
    ['Processo / referência', data.process || '—', 'Setor de destino', data.destination || '—'],
  ];
  autoTable(doc, {
    startY: 41,
    body: meta,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [40, 54, 79] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [237, 243, 247] },
      2: { fontStyle: 'bold', fillColor: [237, 243, 247] },
    },
    margin: { left: 16, right: 16, bottom: 20 },
  });
  const endY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(doc, {
    startY: endY() + 6,
    body: [[template.statement]],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2, textColor: [40, 54, 79] },
    margin: { left: 16, right: 16, bottom: 20 },
  });
  autoTable(doc, {
    startY: endY() + 5,
    head: [
      [
        'Código / patrimônio',
        'Descrição do item',
        template.id === 'inventario' ? 'Contagem física' : 'Quantidade',
        'Unidade',
      ],
    ],
    body: data.items.map((item) => [item.code || '—', item.name, item.quantity, item.unit]),
    theme: 'grid',
    headStyles: { fillColor: [65, 87, 133] },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 16, right: 16, top: 16, bottom: 20 },
  });
  if (data.notes.trim())
    autoTable(doc, {
      startY: endY() + 6,
      head: [['Finalidade / observações']],
      body: [[data.notes]],
      theme: 'grid',
      headStyles: { fillColor: [237, 243, 247], textColor: [40, 54, 79] },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: 16, right: 16, bottom: 20 },
    });
  let signatureY = endY() + 25;
  if (signatureY > 250) {
    doc.addPage();
    signatureY = 45;
  }
  doc.setDrawColor(105, 115, 130);
  doc.setLineWidth(0.3);
  doc.setTextColor(40, 54, 79);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  template.signatures.forEach((label, index) => {
    const x = index === 0 ? 16 : 112;
    doc.line(x, signatureY, x + 82, signatureY);
    doc.text(label, x + 41, signatureY + 6, { align: 'center' });
  });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 125);
    doc.text(`SSP · Núcleo de Material e Patrimônio | ${formattedDate}`, 16, 286);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 194, 286, { align: 'right' });
  }
  const number = data.number.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  doc.save(`${template.id}${number ? '-' + number : ''}-${data.date}.pdf`);
}
