# Variáveis de ambiente

O backend carrega `backend/.env`. O frontend usa apenas `frontend/.env` para variáveis públicas. Nunca coloque senha, token JWT ou URL autenticada do banco em variáveis `VITE_*`.

| Variável                  | Finalidade                                                           |
| ------------------------- | -------------------------------------------------------------------- |
| DATABASE_URL              | Conexão PostgreSQL e schema Prisma                                   |
| DIRECT_URL                | Conexão direta opcional para `npm run db:deploy` na raiz             |
| SEED_DEMO_DATA            | `false` cria apenas perfis e administrador, sem dados demonstrativos |
| JWT_SECRET                | Segredo aleatório, pelo menos 32 caracteres; setup gera 48 bytes     |
| FRONTEND_URL              | Origem permitida pelo CORS e endereço usado em links de recuperação  |
| PORT                      | Porta da API, padrão 3001                                            |
| SEED_ADMIN_EMAIL          | E-mail inicial, padrão admin@nucleo.local                            |
| SEED_ADMIN_PASSWORD       | Senha inicial, mínimo 12 caracteres; setup gera aleatoriamente       |
| TEST_DATABASE_URL         | Banco separado para integração/E2E; nunca aponte para produção       |
| SMTP_HOST                 | Servidor de e-mail; recuperação fica indisponível sem configuração   |
| SMTP_PORT                 | Porta SMTP, padrão 587                                               |
| SMTP_SECURE               | true para TLS direto, normalmente porta 465                          |
| SMTP_FROM                 | Remetente autorizado pelo servidor SMTP                              |
| SMTP_USER / SMTP_PASSWORD | Autenticação SMTP, quando necessária                                 |
| VITE_API_URL              | Base pública da API; padrão /api                                     |
| POSTGRES_PASSWORD         | Senha do container; padrão nucleo_local somente para desenvolvimento |
| POSTGRES_PORT             | Porta local do container; padrão 15432                               |

As duas últimas variáveis pertencem ao Docker Compose e podem ser colocadas em `.env` na raiz. Ao alterá-las, ajuste DATABASE_URL e TEST_DATABASE_URL no backend. A senha definida no Compose só inicializa volumes novos; alterar a variável não muda a senha de um banco existente.

Em produção use HTTPS, segredo exclusivo, senha forte de banco e SMTP real. Configure a hospedagem para entregar `frontend/dist/index.html` nas rotas da SPA e encaminhar `/api` à API. Faça backup regularmente em armazenamento protegido e teste restauração em banco isolado. O script de backup atende o container local; bancos externos devem usar `pg_dump` com sua conexão administrada.
