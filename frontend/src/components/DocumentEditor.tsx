import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import {
  cleanDocumentHTML,
  documentHTMLFile,
  documentPageCSS,
  readDocumentImage,
} from '../utils/documentEditor';

export function DocumentEditor({ initialHTML, title }: { initialHTML: string; title: string }) {
  const { toast } = useApp();
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState(title);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageWidth, setImageWidth] = useState(240);
  useEffect(() => {
    editor.current!.innerHTML = cleanDocumentHTML(initialHTML);
  }, [initialHTML]);
  const remember = () => {
    const current = window.getSelection();
    if (current?.rangeCount && editor.current?.contains(current.anchorNode))
      selection.current = current.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    editor.current!.focus();
    const current = window.getSelection();
    if (selection.current && editor.current!.contains(selection.current.commonAncestorContainer)) {
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
  };
  const command = (name: string, value?: string) => {
    restore();
    document.execCommand(name, false, value);
    remember();
  };
  const uploadImage = async (file: File, logo = false) => {
    try {
      const src = await readDocumentImage(file);
      const html = `<img src="${src}" alt="${logo ? 'Logo' : 'Imagem do documento'}" width="${logo ? 140 : 240}" style="width:${logo ? 140 : 240}px;max-width:100%;height:auto">`;
      if (logo) editor.current!.insertAdjacentHTML('afterbegin', `<p>${html}</p>`);
      else command('insertHTML', html);
      toast(logo ? 'Logo inserido.' : 'Imagem inserida.');
    } catch (error) {
      toast((error as Error).message, true);
    }
  };
  const name = () => filename.trim().replace(/[^a-zA-Z0-9_\u00c0-\u024f-]/g, '-') || 'documento';
  const html = () => cleanDocumentHTML(editor.current!.innerHTML);
  const download = (content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name()}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = async () => {
    setBusy(true);
    const frame = document.createElement('iframe');
    frame.title = 'Impressão do documento';
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0';
    try {
      const loaded = new Promise<void>((resolve) => {
        frame.onload = () => resolve();
      });
      frame.srcdoc = documentHTMLFile(html(), filename);
      document.body.append(frame);
      await loaded;
      await Promise.all(
        Array.from(frame.contentDocument!.images).map((image) => image.decode().catch(() => {})),
      );
      await frame.contentDocument!.fonts.ready;
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setBusy(false);
      setTimeout(() => frame.remove(), 60000);
    }
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const source = document.createElement('div');
      source.innerHTML = `<style>${documentPageCSS}</style><div class="document-page">${html()}</div>`;
      await doc.html(source, {
        margin: [12, 10, 12, 10],
        autoPaging: 'text',
        width: 190,
        windowWidth: 720,
        html2canvas: { scale: 190 / 720, backgroundColor: '#ffffff', logging: false },
      });
      doc.save(`${name()}.pdf`);
      toast('PDF gerado com a formatação do editor.');
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const tools = [
    ['bold', 'Negrito'],
    ['italic', 'Itálico'],
    ['underline', 'Sublinhar'],
    ['strikeThrough', 'Tachado'],
    ['justifyFull', 'Justificar'],
    ['indent', 'Aumentar recuo'],
    ['outdent', 'Diminuir recuo'],
    ['removeFormat', 'Limpar formatação'],
    ['justifyLeft', 'Alinhar à esquerda'],
    ['justifyCenter', 'Centralizar'],
    ['justifyRight', 'Alinhar à direita'],
    ['insertUnorderedList', 'Lista'],
    ['insertOrderedList', 'Lista numerada'],
    ['undo', 'Desfazer'],
    ['redo', 'Refazer'],
  ] as const;
  return (
    <div className="document-editor">
      <p>
        Edite o texto diretamente na folha. Insira arquivos de imagem, formate o conteúdo e salve o
        documento editável para continuar depois.
      </p>
      <fieldset disabled={busy} className="document-fields">
        <label>
          Nome do arquivo
          <input value={filename} maxLength={100} onChange={(e) => setFilename(e.target.value)} />
        </label>
        <div className="editor-toolbar" role="toolbar" aria-label="Formatação do documento">
          <label>
            Fonte
            <select
              aria-label="Fonte do documento"
              defaultValue="Arial"
              onChange={(e) => command('fontName', e.target.value)}
            >
              <option>Arial</option>
              <option>Times New Roman</option>
              <option>Courier New</option>
              <option>Georgia</option>
              <option>Verdana</option>
            </select>
          </label>
          <label>
            Tamanho
            <select
              aria-label="Tamanho da fonte"
              defaultValue="3"
              onChange={(e) => command('fontSize', e.target.value)}
            >
              {[
                ['1', 'Pequeno'],
                ['2', '10 pt'],
                ['3', '12 pt'],
                ['4', '14 pt'],
                ['5', '18 pt'],
                ['6', '24 pt'],
                ['7', '36 pt'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estilo
            <select
              aria-label="Estilo do texto"
              defaultValue="p"
              onChange={(e) => command('formatBlock', e.target.value)}
            >
              <option value="p">Parágrafo</option>
              <option value="h1">Título</option>
              <option value="h2">Subtítulo</option>
              <option value="h3">Seção</option>
            </select>
          </label>
          <label>
            Cor
            <input
              type="color"
              aria-label="Cor do texto"
              defaultValue="#192535"
              onChange={(e) => command('foreColor', e.target.value)}
            />
          </label>
          <label>
            Marca-texto
            <input
              type="color"
              aria-label="Cor do marca-texto"
              defaultValue="#fff59d"
              onChange={(e) => command('hiliteColor', e.target.value)}
            />
          </label>
          {(['upper', 'lower'] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                restore();
                const text = window.getSelection()?.toString();
                if (!text) {
                  toast('Selecione o texto que deseja converter.', true);
                  return;
                }
                command(
                  'insertText',
                  mode === 'upper'
                    ? text.toLocaleUpperCase('pt-BR')
                    : text.toLocaleLowerCase('pt-BR'),
                );
              }}
            >
              {mode === 'upper' ? 'MAIÚSCULAS' : 'minúsculas'}
            </button>
          ))}
          {tools.map(([action, label]) => (
            <button
              type="button"
              key={action}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command(action)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              command(
                'insertHTML',
                '<table><tbody><tr><td>Coluna 1</td><td>Coluna 2</td></tr><tr><td>Texto</td><td>Texto</td></tr></tbody></table><p><br></p>',
              )
            }
          >
            Inserir tabela
          </button>
        </div>
        <div className="editor-file-tools">
          {([true, false] as const).map((logo) => (
            <label key={String(logo)}>
              {logo ? 'Inserir logo no cabeçalho' : 'Inserir imagem no texto'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file, logo);
                  e.target.value = '';
                }}
              />
            </label>
          ))}
          <label>
            Abrir documento editável (.html)
            <input
              type="file"
              accept=".html,text/html"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > 15 * 1024 * 1024) {
                  toast('O documento deve ter até 15 MB.', true);
                  return;
                }
                try {
                  const source = new DOMParser().parseFromString(await file.text(), 'text/html');
                  editor.current!.innerHTML = cleanDocumentHTML(
                    source.querySelector('.document-page')?.innerHTML || source.body.innerHTML,
                  );
                  selection.current = null;
                  setSelectedImage(null);
                  setFilename(file.name.replace(/\.html$/i, ''));
                  toast('Documento aberto.');
                } catch (error) {
                  toast((error as Error).message, true);
                }
              }}
            />
          </label>
        </div>
        {selectedImage && (
          <div className="editor-image-tools">
            <label>
              Largura da imagem (px)
              <input
                type="number"
                min={40}
                max={650}
                value={imageWidth}
                onChange={(e) => {
                  const width = Math.max(40, Math.min(650, Number(e.target.value) || 40));
                  setImageWidth(width);
                  selectedImage.width = width;
                  selectedImage.style.width = `${width}px`;
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                selectedImage.remove();
                setSelectedImage(null);
              }}
            >
              Remover imagem selecionada
            </button>
          </div>
        )}
      </fieldset>
      <p className="hint">
        Imagens: PNG, JPG ou WebP, até 5 MB. Clique em uma imagem da folha para ajustar o tamanho ou
        removê-la. Use “Imprimir / salvar PDF” para a impressão do navegador.
      </p>
      <div className="document-editor-scroll">
        <div
          className="document-page"
          ref={editor}
          contentEditable={!busy}
          suppressContentEditableWarning
          role="textbox"
          aria-label="Conteúdo do documento"
          aria-multiline="true"
          tabIndex={0}
          onMouseUp={remember}
          onKeyUp={remember}
          onBlur={remember}
          onDrop={(event) => {
            event.preventDefault();
            remember();
            const image = Array.from(event.dataTransfer.files).find((file) =>
              file.type.startsWith('image/'),
            );
            if (image) void uploadImage(image);
            else command('insertText', event.dataTransfer.getData('text/plain'));
          }}
          onClick={(e) => {
            const target = e.target;
            if (target instanceof HTMLImageElement) {
              setSelectedImage(target);
              setImageWidth(target.width);
            } else setSelectedImage(null);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const image = Array.from(e.clipboardData.files).find((file) =>
              file.type.startsWith('image/'),
            );
            if (image) {
              remember();
              void uploadImage(image);
            } else {
              const rich = e.clipboardData.getData('text/html');
              if (rich) command('insertHTML', cleanDocumentHTML(rich));
              else command('insertText', e.clipboardData.getData('text/plain'));
            }
          }}
        />
      </div>
      <div className="form-actions">
        <button
          disabled={busy}
          type="button"
          onClick={() => download(documentHTMLFile(html(), filename))}
        >
          Salvar editável (.html)
        </button>
        <button disabled={busy} type="button" onClick={print}>
          Imprimir / salvar PDF
        </button>
        <button className="primary" disabled={busy} type="button" onClick={pdf}>
          {busy ? 'Preparando…' : 'Baixar PDF formatado'}
        </button>
      </div>
    </div>
  );
}
