# Publicação na Vercel com Neon

A interface React e a API Express ficam em um único projeto Vercel. O Neon fornece PostgreSQL; ele não executa a API. A função `api/index.js` exporta a aplicação compilada sem abrir uma porta. `/api/*` segue para Express e as demais rotas entregam a SPA. O Prisma é gerado em cada build e sua instância é reutilizada pela função.

## 1. Criar o banco Neon

Crie um projeto Neon e escolha uma região próxima à região da função Vercel. No painel de conexão copie os dois endereços:

- `DATABASE_URL`: conexão com pooling, cujo hostname contém `-pooler`. Mantenha `sslmode=require`; para o Prisma 6 deste projeto, acrescente `connection_limit=1&pool_timeout=20&connect_timeout=15` aos parâmetros existentes.
- `DIRECT_URL`: conexão direta, sem `-pooler`, com `sslmode=require`, usada pelo comando `npm run db:deploy` na raiz.

Não coloque essas conexões em `VITE_*`, no Git ou no código do frontend. Mantenha os parâmetros fornecidos pelo Neon.

## 2. Inicializar ou transferir os dados

Para um **banco novo**, configure as conexões em `backend/.env` ou no ambiente do terminal e execute na raiz:

```powershell
npm.cmd run db:generate -w backend
npm.cmd run db:deploy
```

Configure `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (pelo menos 12 caracteres) e `SEED_DEMO_DATA=false`, então execute `npm.cmd run db:seed`. Isso cria apenas os perfis e o administrador inicial. Não execute o seed demonstrativo em produção.

Para **preservar um banco existente**, faça um dump completo com `pg_dump` e restaure em um banco Neon vazio usando `pg_restore --no-owner --no-acl`. Use a conexão direta do Neon. O dump precisa incluir o schema, dados, funções, triggers e `_prisma_migrations`; as migrations deste projeto protegem os históricos. O script `npm run db:backup` produz um dump custom do banco Docker local. Para origem externa, use `pg_dump --format=custom --no-owner --no-acl` com a conexão da origem.

Não inicialize o destino com migrations/seed antes de restaurar o dump completo. Após a restauração, execute `npm.cmd run db:deploy` para aplicar apenas migrations pendentes. Compare usuários, materiais, saldos, movimentações, patrimônios e auditoria antes de trocar a aplicação para o destino. Congele gravações na origem durante o dump final e a troca, para não perder movimentos novos. Preserve o banco original e o backup até validar a migração.

O build da Vercel não executa migrations nem seed, evitando alterações automáticas do banco em previews.

### Recuperação local realizada

O backup `backups/nucleo-2026-10-06T00-06-06-992Z.dump` foi restaurado em uma instância PostgreSQL 18 separada na porta 15432. Seus dados ficam em `.artifacts/postgres-local`; não apague essa pasta. O PostgreSQL instalado na porta 5432 não foi alterado. Após reiniciar o Windows, inicie a instância recuperada com:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-db.ps1 start
```

Use `status` para consultar ou `stop` para encerrar. Essa instância foi criada para recuperar o ambiente local; a produção ainda precisa da conexão Neon válida.

A migration inicial foi recuperada com checksum idêntico ao registrado no backup. O texto original da migration `202610050002_invariants` não estava disponível; suas cinco restrições e três triggers foram recuperadas do backup em `202610060001_recovered_invariants`, que aceita bancos com essas regras já existentes. Preserve o registro antigo em `_prisma_migrations`. Bancos restaurados do backup devem usar `migrate deploy`; não execute reset para tentar reconciliar o histórico com `migrate dev`.

## 3. Configurar a Vercel

Importe o repositório na Vercel usando a **raiz do projeto**, e não `frontend/` ou `backend/`. Selecione Node.js 22.x e framework **Other**. O `vercel.json` já define instalação, build e diretório de saída.

Configure as variáveis de ambiente no painel:

| Variável                                                                           | Valor                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`                                                                     | Conexão pooled do Neon                                   |
| `JWT_SECRET`                                                                       | Segredo aleatório exclusivo com pelo menos 32 caracteres |
| `FRONTEND_URL`                                                                     | URL HTTPS final, sem barra no fim                        |
| `VITE_API_URL`                                                                     | `/api` (também é o padrão)                               |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD` | Configuração do envio de recuperação de senha            |

`DIRECT_URL` é necessária no ambiente que executa migrations; a função usa apenas `DATABASE_URL`. `PORT` e as variáveis de seed não são necessárias na Vercel. O hostname final deve ser atualizado em `FRONTEND_URL` antes de testar os links de recuperação.

Use uma branch/banco Neon separado e segredo próprio para Preview. Não aponte previews para o banco de produção. Se publicar pela CLI, autentique-se e vincule o projeto:

```powershell
npx.cmd vercel login
npx.cmd vercel link
npx.cmd vercel --prod
```

## 4. Validar a publicação

Verifique `/api/health` (consulta real ao banco), `/api/openapi.json`, login, atualização direta de uma rota da interface, cadastro e movimentação de um material de validação, relatórios e recuperação de senha. A validação local do build não substitui esses testes no ambiente publicado.

Os limitadores atuais de login e recuperação usam memória por instância. Na Vercel, não representam um limite global; configure regras de rate limiting no WAF da Vercel para essas rotas se precisar de proteção global. Backups no Neon devem usar a conexão direta e uma rotina externa; o script de backup local depende do Docker.

Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [runtime Node.js](https://vercel.com/docs/functions/runtimes/node-js), [Prisma 6 e Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon).
