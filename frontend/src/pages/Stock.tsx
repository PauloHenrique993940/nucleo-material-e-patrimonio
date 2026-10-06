import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanLine, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { EntityForm } from '../components/EntityForm';
import { Modal } from '../components/Modal';
import { Scanner } from '../components/Scanner';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import type { Field, Row } from '../types';
import { currency } from '../utils/format';
export function Stock({ type }: { type: 'IN' | 'OUT' }) {
  const { toast } = useApp();
  const cache = useQueryClient();
  const [pending, setPending] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [barcode, setBarcode] = useState(''),
    [selected, setSelected] = useState(''),
    [scanner, setScanner] = useState(false),
    [revision, setRevision] = useState(0);
  const query = useQuery<Record<string, Row[]>>({
    queryKey: ['lookups'],
    queryFn: async () => {
      const [categories, suppliers, departments, materials] = await Promise.all(
        ['categories', 'suppliers', 'departments', 'materials'].map((k) => api<Row[]>('/' + k)),
      );
      return { categories, suppliers, departments, materials };
    },
  });
  const read = useCallback(
    (code: string) => {
      const material = query.data?.materials.find((m) => m.barcode === code || m.code === code);
      if (material) {
        setSelected(material.id);
        setBarcode(code);
        setScanner(false);
        setRevision((v) => v + 1);
        toast(`Material selecionado: ${material.name}`);
      } else toast('Código não encontrado.', true);
    },
    [query.data, toast],
  );
  const fields: Field[] = [
    { key: 'materialId', label: 'Material', type: 'select', source: 'materials', required: true },
    { key: 'quantity', label: 'Quantidade', type: 'number', required: true, min: 1 },
    { key: 'date', label: 'Data', type: 'date', required: true },
    ...(type === 'IN'
      ? [
          { key: 'supplierId', label: 'Fornecedor', type: 'select', source: 'suppliers' } as Field,
          { key: 'invoice', label: 'Nota fiscal' },
          { key: 'process', label: 'Número do processo' },
          { key: 'unitPrice', label: 'Valor unitário', type: 'number' } as Field,
          { key: 'receiver', label: 'Responsável pelo recebimento', required: true },
        ]
      : [
          {
            key: 'departmentId',
            label: 'Setor solicitante',
            type: 'select',
            source: 'departments',
            required: true,
          } as Field,
          { key: 'receiver', label: 'Responsável pela retirada', required: true },
          { key: 'deliverer', label: 'Responsável pela entrega', required: true },
          { key: 'requestNumber', label: 'Número da solicitação' },
          { key: 'purpose', label: 'Finalidade' },
        ]),
    { key: 'notes', label: 'Observações', type: 'textarea' },
  ];
  const confirm = async () => {
    setBusy(true);
    try {
      await api('/movements', 'POST', { ...pending, type });
      toast(
        type === 'IN'
          ? 'Entrada registrada. Saldo atualizado.'
          : 'Saída registrada. Saldo atualizado.',
      );
      setPending(null);
      setSelected('');
      setRevision((v) => v + 1);
      await Promise.all(
        ['lookups', 'materials', 'dashboard', 'movements'].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MOVIMENTAÇÃO DE ESTOQUE</span>
          <h1>{type === 'IN' ? 'Entrada de material' : 'Saída de material'}</h1>
          <p>
            {type === 'IN'
              ? 'Registre o recebimento e atualize o saldo automaticamente.'
              : 'Distribua materiais aos setores com rastreabilidade.'}
          </p>
        </div>
        <span className="large-icon">
          {type === 'IN' ? <ArrowDownToLine /> : <ArrowUpFromLine />}
        </span>
      </div>
      <div className="stock-layout">
        <section className="card">
          <div className="card-heading">
            <h2>Dados da movimentação</h2>
          </div>
          {query.isPending ? (
            <p role="status">Carregando materiais…</p>
          ) : query.isError ? (
            <p className="error-box" role="alert">
              {query.error.message}
            </p>
          ) : (
            <>
              <div className="barcode-input">
                <label>
                  Código do material / código de barras
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        read(barcode);
                      }
                    }}
                    placeholder="Escaneie com o leitor ou digite o código"
                  />
                </label>
                <button onClick={() => read(barcode)}>Localizar</button>
                <button aria-label="Ler pela câmera" onClick={() => setScanner(true)}>
                  <ScanLine size={20} />
                </button>
              </div>
              <EntityForm
                key={revision}
                fields={fields}
                initial={{ materialId: selected, quantity: 1 }}
                lookups={query.data}
                onSubmit={async (data) => {
                  if (type === 'OUT') {
                    const m = query.data?.materials.find((m) => m.id === data.materialId);
                    if (m && data.quantity > m.quantity) {
                      toast(`Saldo insuficiente. Disponível: ${m.quantity}.`, true);
                      return;
                    }
                  }
                  setPending(data);
                }}
              />
            </>
          )}
        </section>
        <aside className="card stock-guidance">
          <span className="eyebrow">OPERAÇÃO SEGURA</span>
          <h2>Todo movimento conta.</h2>
          <p>
            O saldo e o histórico são atualizados juntos. O usuário autenticado fica registrado como
            operador.
          </p>
          <p>Para corrigir um lançamento, utilize o estorno no histórico de movimentações.</p>
          <div className="success-box">
            {type === 'IN'
              ? 'Entrada → aumenta o saldo disponível.'
              : 'Saída → verifica o saldo antes de confirmar.'}
          </div>
        </aside>
      </div>
      {scanner && <Scanner onRead={read} onClose={() => setScanner(false)} />}{' '}
      {pending && (
        <Modal title="Confirmar movimentação" onClose={() => !busy && setPending(null)}>
          <dl className="detail-grid">
            <div>
              <dt>Material</dt>
              <dd>{query.data?.materials.find((m) => m.id === pending.materialId)?.name}</dd>
            </div>
            <div>
              <dt>Quantidade</dt>
              <dd>{pending.quantity}</dd>
            </div>
            {type === 'IN' && (
              <div>
                <dt>Valor total</dt>
                <dd>{currency(pending.quantity * pending.unitPrice)}</dd>
              </div>
            )}
          </dl>
          <p>A operação será registrada no histórico e alterará o saldo disponível.</p>
          <div className="form-actions">
            <button disabled={busy} onClick={() => setPending(null)}>
              Cancelar
            </button>
            <button className="primary" disabled={busy} onClick={confirm}>
              {busy ? 'Registrando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
