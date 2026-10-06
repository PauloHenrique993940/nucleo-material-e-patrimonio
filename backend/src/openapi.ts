import { z } from 'zod';
import { schemaDocument } from './utils/openapi-schema.js';
import {
  materialSchema,
  movementSchema,
  categorySchema,
  departmentSchema,
  supplierSchema,
  assetSchema,
  userSchema,
  passwordSchema,
} from './schemas/index.js';
const inputs: Record<string, z.ZodTypeAny> = {
  MaterialInput: materialSchema,
  MovementInput: movementSchema,
  CategoryInput: categorySchema,
  DepartmentInput: departmentSchema,
  SupplierInput: supplierSchema,
  AssetInput: assetSchema,
  UserInput: userSchema,
  UserUpdate: userSchema.extend({ password: passwordSchema.optional(), active: z.boolean() }),
  Login: z.object({ login: z.string().min(1), password: z.string().min(1) }),
  ForgotPassword: z.object({ email: z.string().email() }),
  ResetPassword: z.object({ token: z.string(), password: passwordSchema }),
  ChangePassword: z.object({ currentPassword: z.string(), password: passwordSchema }),
  Transfer: z.object({
    departmentId: z.string().uuid(),
    responsible: z.string().min(2),
    notes: z.string().default(''),
  }),
  Reverse: z.object({ notes: z.string().min(5) }),
};
const requestNames: Record<string, string> = {
  '/materials': 'MaterialInput',
  '/categories': 'CategoryInput',
  '/suppliers': 'SupplierInput',
  '/departments': 'DepartmentInput',
  '/assets': 'AssetInput',
  '/users': 'UserInput',
  '/movements': 'MovementInput',
  '/auth/login': 'Login',
  '/auth/forgot-password': 'ForgotPassword',
  '/auth/reset-password': 'ResetPassword',
  '/auth/change-password': 'ChangePassword',
  '/assets/{id}/transfer': 'Transfer',
  '/movements/{id}/reverse': 'Reverse',
  '/users/{id}': 'UserUpdate',
};
const requestSchema = (path: string) =>
  requestNames[path] || requestNames[path.replace('/{id}', '')];
const publicPaths = ['/health', '/auth/login', '/auth/forgot-password', '/auth/reset-password'];
const endpoints: Record<string, string[]> = {
  '/health': ['get'],
  '/auth/login': ['post'],
  '/auth/me': ['get'],
  '/auth/logout': ['post'],
  '/auth/forgot-password': ['post'],
  '/auth/reset-password': ['post'],
  '/auth/change-password': ['post'],
  '/materials': ['get', 'post'],
  '/materials/{id}': ['put', 'delete'],
  '/categories': ['get', 'post'],
  '/categories/{id}': ['put'],
  '/suppliers': ['get', 'post'],
  '/suppliers/{id}': ['put'],
  '/suppliers/{id}/history': ['get'],
  '/departments': ['get', 'post'],
  '/departments/{id}': ['put'],
  '/departments/{id}/history': ['get'],
  '/assets': ['get', 'post'],
  '/assets/{id}': ['put'],
  '/assets/{id}/transfer': ['post'],
  '/assets/{id}/history': ['get'],
  '/transfers': ['get'],
  '/movements': ['get', 'post'],
  '/movements/{id}/reverse': ['post'],
  '/users': ['get', 'post'],
  '/users/{id}': ['put'],
  '/audit': ['get'],
  '/dashboard': ['get'],
  '/search': ['get'],
  '/reports/{kind}': ['get'],
};
export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Núcleo de Material e Patrimônio',
    version: '1.0.0',
    description: 'API REST. Consulte docs/API.md para campos e permissões.',
  },
  servers: [{ url: '/api' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: Object.fromEntries(
      Object.entries(inputs).map(([name, schema]) => [name, schemaDocument(schema)]),
    ),
  },
  paths: Object.fromEntries(
    Object.entries(endpoints).map(([path, methods]) => [
      path,
      Object.fromEntries(
        methods.map((method) => [
          method,
          {
            summary: `${method.toUpperCase()} ${path}`,
            tags: [path.split('/')[1]],
            ...(publicPaths.includes(path) ? { security: [] } : {}),
            ...(path.includes('{')
              ? {
                  parameters: [
                    {
                      name: path.includes('{kind}') ? 'kind' : 'id',
                      in: 'path',
                      required: true,
                      schema: { type: 'string' },
                    },
                  ],
                }
              : {}),
            ...(['post', 'put'].includes(method) && path !== '/auth/logout'
              ? {
                  requestBody: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: requestSchema(path)
                          ? { $ref: `#/components/schemas/${requestSchema(path)}` }
                          : { type: 'object' },
                      },
                    },
                  },
                }
              : {}),
            responses: {
              '200': { description: 'Operação concluída' },
              '201': { description: 'Registro criado' },
              '204': { description: 'Operação concluída sem conteúdo' },
              '400': { description: 'Validação inválida' },
              '401': { description: 'Sessão inválida' },
              '403': { description: 'Sem permissão' },
              '409': { description: 'Conflito' },
            },
          },
        ]),
      ),
    ]),
  ),
};
