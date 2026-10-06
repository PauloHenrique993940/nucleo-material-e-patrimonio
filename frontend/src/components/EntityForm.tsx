import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Field, Row } from '../types';
import { useId } from 'react';
export function EntityForm({
  fields,
  initial = {},
  lookups = {},
  onSubmit,
  onCancel,
}: {
  fields: Field[];
  initial?: Partial<Row>;
  lookups?: Record<string, Row[]>;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
}) {
  const formId = useId();
  const shape: Record<string, z.ZodTypeAny> = {};
  const defaults: Record<string, unknown> = {};
  for (const f of fields) {
    let schema: z.ZodTypeAny =
      f.type === 'checkbox'
        ? z.boolean()
        : f.type === 'number'
          ? z.coerce
              .number()
              .finite()
              .min(f.min ?? 0)
          : z.string();
    if (f.required && f.type !== 'checkbox' && f.type !== 'number')
      schema = z
        .string()
        .trim()
        .min(
          f.key === 'password' ? 12 : 1,
          f.key === 'password' ? 'Use pelo menos 12 caracteres.' : 'Campo obrigatório.',
        );
    if (f.type === 'email')
      schema = f.required
        ? z.string().email('E-mail inválido.')
        : z.union([z.string().email('E-mail inválido.'), z.literal('')]);
    if (f.key === 'password')
      schema = f.required
        ? z.string().min(12, 'Use pelo menos 12 caracteres.').max(72)
        : z.union([z.literal(''), z.string().min(12, 'Use pelo menos 12 caracteres.').max(72)]);
    if (f.key === 'cnpj') schema = z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos.');
    shape[f.key] = schema;
    defaults[f.key] =
      initial[f.key] ??
      (f.type === 'checkbox'
        ? true
        : f.type === 'number'
          ? f.key === 'minimum'
            ? 5
            : f.key === 'maximum'
              ? 1000
              : 0
          : f.key === 'unit'
            ? 'UN'
            : f.key === 'condition'
              ? 'Bom'
              : f.key === 'status'
                ? 'IN_USE'
                : f.key === 'role'
                  ? 'VIEWER'
                  : f.type === 'date'
                    ? f.key === 'expiryDate'
                      ? ''
                      : new Date().toISOString().slice(0, 10)
                    : '');
    if (f.type === 'date' && initial[f.key]) defaults[f.key] = String(initial[f.key]).slice(0, 10);
  }
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(
      z.object(shape).superRefine((data, ctx) => {
        if ('minimum' in data && 'maximum' in data && Number(data.maximum) < Number(data.minimum))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maximum'],
            message: 'O máximo deve ser maior ou igual ao mínimo.',
          });
      }),
    ),
    defaultValues: defaults,
  });
  return (
    <form
      onSubmit={handleSubmit(async (d) => {
        const data = { ...d };
        for (const f of fields) {
          if (f.key === 'expiryDate') {
            data[f.key] = data[f.key] || null;
            continue;
          }
          if (f.type === 'date' && data[f.key])
            data[f.key] = new Date(String(data[f.key]) + 'T12:00:00').toISOString();
          if ((f.source || f.key === 'password') && !data[f.key]) delete data[f.key];
        }
        if (data.barcode === '') data.barcode = null;
        await onSubmit(data);
      })}
      className="form-grid"
    >
      {fields.map((f) => (
        <label
          key={f.key}
          className={
            f.type === 'textarea' ? 'span-2' : f.type === 'checkbox' ? 'checkbox-field' : ''
          }
        >
          <span className="field-label">
            {f.label}
            {f.required && (
              <span className="required-mark" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </span>
          {f.type === 'select' ? (
            <select
              {...register(f.key)}
              aria-label={f.label}
              aria-required={f.required}
              aria-invalid={!!errors[f.key]}
              aria-describedby={errors[f.key] ? `${formId}-${f.key}-error` : undefined}
            >
              <option value="">Selecione</option>
              {(
                f.options ||
                (lookups[f.source || ''] || [])
                  .filter((r) => r.active !== false || r.id === initial[f.key])
                  .map((r) => ({ value: r.id, label: r.name || r.id }))
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              {...register(f.key)}
              aria-label={f.label}
              aria-required={f.required}
              rows={3}
              aria-describedby={errors[f.key] ? `${formId}-${f.key}-error` : undefined}
            />
          ) : (
            <input
              {...register(f.key)}
              aria-label={f.label}
              aria-required={f.required}
              type={f.type || 'text'}
              min={f.min ?? 0}
              step={
                f.type === 'number'
                  ? ['quantity', 'minimum', 'maximum'].includes(f.key)
                    ? 1
                    : '0.01'
                  : undefined
              }
              aria-invalid={!!errors[f.key]}
              aria-describedby={errors[f.key] ? `${formId}-${f.key}-error` : undefined}
              autoComplete={f.type === 'password' ? 'new-password' : undefined}
            />
          )}{' '}
          {errors[f.key] && (
            <small
              id={`${formId}-${f.key}-error`}
              className="field-error"
              role="alert"
              data-field={f.key}
            >
              {String(errors[f.key]?.message)}
            </small>
          )}
        </label>
      ))}
      <div className="span-2 form-actions">
        {onCancel && (
          <button type="button" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
