import { z } from 'zod';
export function schemaDocument(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodEffects) return schemaDocument(schema.innerType());
  if (schema instanceof z.ZodDefault)
    return { ...schemaDocument(schema.removeDefault()), default: schema._def.defaultValue() };
  if (schema instanceof z.ZodOptional) return schemaDocument(schema.unwrap());
  if (schema instanceof z.ZodNullable)
    return { ...schemaDocument(schema.unwrap()), nullable: true };
  if (schema instanceof z.ZodObject) {
    const fields = schema.shape as Record<string, z.ZodTypeAny>;
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, schemaDocument(value)]),
      ),
      required: Object.entries(fields)
        .filter(([, value]) => !value.isOptional())
        .map(([key]) => key),
    };
  }
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  if (schema instanceof z.ZodLiteral) return { type: typeof schema.value, enum: [schema.value] };
  if (schema instanceof z.ZodUnion) return { anyOf: schema.options.map(schemaDocument) };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodString) {
    const doc: Record<string, unknown> = { type: 'string' };
    for (const check of schema._def.checks) {
      if (check.kind === 'min') doc.minLength = check.value;
      if (check.kind === 'max') doc.maxLength = check.value;
      if (['email', 'uuid'].includes(check.kind)) doc.format = check.kind;
      if (check.kind === 'datetime') doc.format = 'date-time';
      if (check.kind === 'regex') doc.pattern = check.regex.source;
    }
    return doc;
  }
  if (schema instanceof z.ZodNumber) {
    const doc: Record<string, unknown> = { type: 'number' };
    for (const check of schema._def.checks) {
      if (check.kind === 'int') doc.type = 'integer';
      if (check.kind === 'min') {
        doc.minimum = check.value;
        if (!check.inclusive) doc.exclusiveMinimum = true;
      }
      if (check.kind === 'max') {
        doc.maximum = check.value;
        if (!check.inclusive) doc.exclusiveMaximum = true;
      }
    }
    return doc;
  }
  return {};
}
