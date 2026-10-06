import { useState } from 'react';
import { FileText, FileDown, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useApp } from '../contexts/AppContext';
import {
  documentTemplates,
  localDocumentDate,
  exportDocumentPDF,
  type DocumentTemplate,
  type DocumentData,
} from '../utils/documents';
const blankItem = () => ({ code: '', name: '', quantity: '1', unit: 'UN' });
export function Documents() {
  const { user, toast } = useApp();
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [data, setData] = useState<DocumentData>({
    number: '',
    date: localDocumentDate(),
    department: '',
    destination: '',
    person: '',
    registration: '',
    issuer: user?.name || '',
    process: '',
    notes: '',
    items: [blankItem()],
  });
  const [busy, setBusy] = useState(false);
  const field = (
    key: keyof Omit<DocumentData, 'items'>,
    label: string,
    required = false,
    type = 'text',
  ) => (
    <label>
      {label}
      {required ? ' *' : ''}
      <input
        type={type}
        required={required}
        maxLength={200}
        value={data[key]}
        onChange={(event) => setData((previous) => ({ ...previous, [key]: event.target.value }))}
      />
    </label>
  );
  return (
    <section className="card no-print document-library">
      <div className="document-library-heading">
        <div>
          <span className="eyebrow">DOCUMENTOS DO NÚCLEO</span>
          <h2>Modelos para o dia a dia</h2>
          <p>Preencha os dados e baixe um PDF com espaço para assinaturas.</p>
        </div>
        <FileText size={32} aria-hidden="true" />
      </div>
      <div className="document-template-grid">
        {documentTemplates.map((template) => (
          <article key={template.id} className="document-template">
            <span className="document-template-icon">
              <FileText size={22} />
            </span>
            <h3>{template.title}</h3>
            <p>{template.description}</p>
            <button
              onClick={() => {
                setData({
                  number: '',
                  date: localDocumentDate(),
                  department: '',
                  destination: '',
                  person: '',
                  registration: '',
                  issuer: user?.name || '',
                  process: '',
                  notes: '',
                  items: [blankItem()],
                });
                setSelected(template);
              }}
            >
              <Plus size={16} /> Preencher documento
            </button>
          </article>
        ))}
      </div>
      {selected && (
        <Modal title={selected.title} onClose={() => !busy && setSelected(null)}>
          <p>{selected.description} Os campos com * são obrigatórios.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                data.items.some((item) => !item.name.trim()) ||
                !data.department.trim() ||
                !data.person.trim() ||
                !data.issuer.trim() ||
                (selected.id === 'transferencia' && !data.destination.trim()) ||
                data.items.some((item) => !item.unit.trim())
              ) {
                toast('Preencha os campos obrigatórios.', true);
                return;
              }
              setBusy(true);
              try {
                await exportDocumentPDF(selected, data);
                toast('PDF gerado.');
              } catch (error) {
                toast(
                  error instanceof Error ? error.message : 'Não foi possível gerar o documento.',
                  true,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="document-fields">
              <div className="form-grid">
                {field('number', 'Número do documento')}
                {field('date', 'Data', true, 'date')}
                {field(
                  'department',
                  selected.id === 'transferencia' ? 'Setor de origem' : 'Setor',
                  true,
                )}
                {selected.id === 'transferencia'
                  ? field('destination', 'Setor de destino', true)
                  : field('process', 'Processo / referência')}
                {field('person', 'Responsável / recebedor', true)}
                {field('registration', 'Matrícula')}
                {field('issuer', 'Emitente', true)}
                {selected.id === 'transferencia' && field('process', 'Processo / referência')}
              </div>
              <div className="document-items-heading">
                <h3>Itens do documento</h3>
                <button
                  type="button"
                  disabled={data.items.length >= 100}
                  onClick={() =>
                    setData((previous) => ({
                      ...previous,
                      items: [...previous.items, blankItem()],
                    }))
                  }
                >
                  <Plus size={16} /> Adicionar item
                </button>
              </div>
              <div className="document-items">
                {data.items.map((item, index) => (
                  <div className="document-item" key={index}>
                    <strong className="document-item-number">Item {index + 1}</strong>
                    {(['code', 'name', 'quantity', 'unit'] as const).map((key) => (
                      <label key={key}>
                        {
                          {
                            code: 'Código / patrimônio',
                            name: 'Descrição *',
                            quantity:
                              selected.id === 'inventario' ? 'Contagem física *' : 'Quantidade *',
                            unit: 'Unidade *',
                          }[key]
                        }
                        <input
                          required={key !== 'code'}
                          type={key === 'quantity' ? 'number' : 'text'}
                          min={selected.id === 'inventario' ? 0 : 1}
                          step="1"
                          max={2147483647}
                          maxLength={key === 'unit' ? 20 : 200}
                          value={item[key]}
                          onChange={(event) =>
                            setData((previous) => ({
                              ...previous,
                              items: previous.items.map((row, i) =>
                                i === index ? { ...row, [key]: event.target.value } : row,
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="document-remove-item"
                      aria-label={`Remover item ${index + 1}`}
                      disabled={data.items.length === 1}
                      onClick={() =>
                        setData((previous) => ({
                          ...previous,
                          items: previous.items.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <label>
                Finalidade / observações
                <textarea
                  maxLength={3000}
                  rows={3}
                  value={data.notes}
                  onChange={(event) =>
                    setData((previous) => ({ ...previous, notes: event.target.value }))
                  }
                />
              </label>
            </fieldset>
            <div className="form-actions">
              <button type="button" disabled={busy} onClick={() => setSelected(null)}>
                Cancelar
              </button>
              <button className="primary" disabled={busy} type="submit">
                <FileDown size={17} />
                {busy ? 'Gerando…' : 'Gerar PDF'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
