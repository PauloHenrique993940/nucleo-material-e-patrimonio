import DOMPurify from 'dompurify';
import type { DocumentData, DocumentTemplate } from './documents';

export const escapeHTML = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

export function cleanDocumentHTML(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: /^data:image\/(png|jpeg|webp);base64,/i,
    ADD_URI_SAFE_ATTR: ['face', 'color', 'size', 'width', 'height', 'colspan', 'rowspan'],
    ALLOWED_TAGS: [
      'p',
      'div',
      'span',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'strike',
      'font',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img',
      'hr',
      'blockquote',
    ],
    ALLOWED_ATTR: [
      'style',
      'src',
      'alt',
      'width',
      'height',
      'face',
      'color',
      'size',
      'colspan',
      'rowspan',
    ],
  });
  const container = document.createElement('div');
  container.innerHTML = clean;
  for (const image of container.querySelectorAll('img')) {
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(image.getAttribute('src') || ''))
      image.remove();
  }
  const allowedStyles = new Set([
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'text-decoration',
    'text-align',
    'color',
    'background-color',
    'width',
    'max-width',
    'height',
    'margin',
    'margin-top',
    'margin-bottom',
    'padding',
    'border',
    'border-collapse',
    'vertical-align',
    'line-height',
  ]);
  for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
    for (const property of Array.from(element.style)) {
      const value = element.style.getPropertyValue(property);
      if (!allowedStyles.has(property) || /url\s*\(|expression|@import|var\s*\(/i.test(value))
        element.style.removeProperty(property);
    }
  }
  return container.innerHTML;
}

export const documentPageCSS = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #192535; background: white; font-family: Arial, sans-serif; }
  .document-page { width: 720px; padding: 32px; background: white; color: #192535; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
  .document-page h1 { font-size: 24px; }
  .document-page h2 { font-size: 20px; }
  .document-page h3 { font-size: 17px; }
  .document-page img { max-width: 100%; height: auto; }
  .document-page table { border-collapse: collapse; width: 100%; margin: 16px 0; table-layout: fixed; }
  .document-page td, .document-page th { border: 1px solid #cbd5e1; padding: 8px; text-align: left; overflow-wrap: anywhere; }
  .document-page th { background: #edf3f7; }
  @page { size: A4; margin: 15mm; }
  @media print { .document-page { width: 100%; padding: 0; } tr, img { break-inside: avoid; } }
`;

export function documentHTMLFile(html: string, title: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHTML(title)}</title><style>${documentPageCSS}</style></head><body><main class="document-page">${cleanDocumentHTML(html)}</main></body></html>`;
}

export function templateDocumentHTML(template: DocumentTemplate, data: DocumentData) {
  const text = escapeHTML;
  return `<h2>Núcleo de Material e Patrimônio</h2><h1>${text(template.title)}</h1>
    <p><b>Documento:</b> ${text(data.number || 'Sem número')} · <b>Data:</b> ${text(data.date.split('-').reverse().join('/'))}</p>
    <p><b>Setor / origem:</b> ${text(data.department)}<br><b>Destino:</b> ${text(data.destination)}<br><b>Responsável / recebedor:</b> ${text(data.person)}<br><b>Matrícula:</b> ${text(data.registration)}<br><b>Emitente:</b> ${text(data.issuer)}<br><b>Processo:</b> ${text(data.process)}</p>
    <p>${text(template.statement)}</p>
    <table><thead><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Unidade</th></tr></thead><tbody>${data.items.map((item) => `<tr><td>${text(item.code)}</td><td>${text(item.name)}</td><td>${text(item.quantity)}</td><td>${text(item.unit)}</td></tr>`).join('')}</tbody></table>
    <h3>Finalidade / observações</h3><p>${text(data.notes).replace(/\n/g, '<br>') || '<br>'}</p>
    ${template.signatures.map((label) => `<p><br>________________________________<br>${text(label)}</p>`).join('')}`;
}

export async function readDocumentImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Escolha uma imagem PNG, JPG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter até 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
