# Arquitetura do Núcleo de Material e Patrimônio

Este documento descreve a implementação existente. Os diagramas representam componentes e fluxos do projeto, sem valores demonstrativos de estoque.

## Organização do código

```text
Estoque/
├── frontend/src/
│   ├── pages/          Telas de login, dashboard, cadastros e relatórios
│   ├── components/     Modais, formulários e biblioteca de documentos
│   ├── contexts/       Sessão, tema e notificações
│   ├── layouts/        Barra lateral e cabeçalho
│   ├── schemas/        Configuração dos cadastros
│   ├── services/       Cliente HTTP da API
│   └── utils/          Formatação, validade e geração de documentos
├── backend/
│   ├── src/
│   │   ├── app.ts      Montagem da aplicação Express
│   │   ├── routes/     Endpoints por domínio
│   │   ├── controllers/Autenticação
│   │   ├── middlewares/Autorização e tratamento de erros
│   │   ├── schemas/    Validação das requisições
│   │   ├── services/   Movimentações transacionais
│   │   ├── repositories/ Cliente Prisma
│   │   └── utils/      Regras de saldo, sessão e ambiente
│   ├── prisma/         Schema, migrations e seed
│   └── tests/          Testes unitários e de integração
├── api/index.js        Entrada da API na Vercel
├── scripts/            Setup, migrations, testes e backup
├── docs/               Documentação técnica
└── vercel.json         Build, função e reescrita das rotas
```

O frontend compartilha a página `Entities` entre os cadastros, com campos definidos em `schemas/entities.ts`. O cliente HTTP inclui o token e trata sessões expiradas. TanStack Query mantém as consultas e invalida os dados após alterações. Modais e formulários reutilizam componentes comuns.

## Desenvolvimento e produção

```mermaid
flowchart TB
  subgraph Local["Desenvolvimento"]
    Vite["Vite · porta 5173"] -->|"Proxy /api"| Express["Express · porta 3001"]
    Express --> LocalDB[("PostgreSQL local ou externo")]
  end
  subgraph Production["Produção"]
    Static["Vercel · frontend/dist"] -->|"/api"| Function["Função api/index.js"]
    Function -->|"Prisma · DATABASE_URL"| Neon[("Neon PostgreSQL")]
    Migration["scripts/deploy-db.mjs"] -->|"DIRECT_URL ou DATABASE_URL"| Neon
  end
```

As rotas da interface retornam `index.html` para que React Router resolva a navegação. As rotas `/api` são encaminhadas ao backend. A API usa JSON, validação Zod, Helmet, CORS e autenticação antes dos endpoints privados. `/api/health` verifica a conexão com o banco. `/api/docs` e `/api/openapi.json` expõem a documentação da API.

## Modelo de dados

O diagrama mostra as principais relações. Campos e restrições completos estão em [schema.prisma](../backend/prisma/schema.prisma).

```mermaid
erDiagram
  Role ||--o{ User : define
  User ||--o{ StockMovement : registra
  User ||--o{ PatrimonyTransfer : realiza
  User ||--o{ AuditLog : gera
  User ||--o{ PasswordReset : solicita
  Category ||--o{ Material : classifica
  Category ||--o{ Patrimony : classifica
  Supplier o|--o{ Material : fornece
  Supplier o|--o{ StockMovement : participa
  Department o|--o{ StockMovement : recebe
  Department ||--o{ Patrimony : localiza
  Department ||--o{ PatrimonyTransfer : origem
  Department ||--o{ PatrimonyTransfer : destino
  Material ||--o{ StockMovement : possui
  StockMovement o|--o| StockMovement : estorno
  Patrimony ||--o{ PatrimonyTransfer : possui
  User {
    string id PK
    string email UK
    string registration UK
    boolean active
    int sessionVersion
    datetime deletedAt
  }
  Material {
    string id PK
    string code UK
    int quantity
    decimal unitPrice
    date expiryDate
    datetime deletedAt
  }
  StockMovement {
    string id PK
    string materialId FK
    string userId FK
    int quantity
    int previousBalance
    int currentBalance
    string reversalOfId UK
  }
  AuditLog {
    string id PK
    string userId FK
    string operation
    string recordId
    datetime date
  }
```

`StockMovement` guarda saldo anterior e posterior e pode referenciar um movimento estornado. `PatrimonyTransfer` mantém origem, destino e responsável. `AuditLog.recordId` identifica o registro da operação e não é uma chave estrangeira genérica; pode continuar registrando uma exclusão definitiva.

## Autenticação e sessão

```mermaid
sequenceDiagram
  actor Person as Usuário
  participant UI as Interface
  participant API as Express
  participant DB as PostgreSQL
  Person->>UI: E-mail ou matrícula e senha
  UI->>API: POST /api/auth/login
  API->>DB: Buscar usuário e perfil
  API->>API: Verificar conta ativa e senha bcrypt
  API->>DB: Registrar auditoria de login
  API-->>UI: JWT e dados públicos do usuário
  UI->>UI: Guardar token no localStorage
  UI->>API: Requisição com Bearer JWT
  API->>API: Verificar assinatura e expiração
  API->>DB: Conferir conta, perfil e sessionVersion
  alt Sessão válida e perfil autorizado
    API-->>UI: Resultado da operação
  else Sessão inválida ou perfil sem permissão
    API-->>UI: Erro 401 ou 403
  end
```

O JWT expira em oito horas. Logout, alteração de senha e alterações administrativas incrementam `sessionVersion`, invalidando os tokens anteriores. A exclusão de usuário também inativa a conta, remove tokens de recuperação e preserva sua identificação nos históricos. A API impede excluir a própria conta administrativa.

| Operação                                 | ADMIN | MANAGER | OPERATOR | VIEWER |
| ---------------------------------------- | ----- | ------- | -------- | ------ |
| Consultar dashboard e cadastros comuns   | Sim   | Sim     | Sim      | Sim    |
| Cadastrar materiais e categorias         | Sim   | Sim     | Sim      | Não    |
| Registrar entradas e saídas              | Sim   | Sim     | Sim      | Não    |
| Estornar movimentações                   | Sim   | Sim     | Não      | Não    |
| Cadastrar e transferir patrimônio        | Sim   | Sim     | Não      | Não    |
| Gerenciar fornecedores e setores         | Sim   | Não     | Não      | Não    |
| Acessar relatórios                       | Sim   | Sim     | Não      | Sim    |
| Gerenciar usuários e consultar auditoria | Sim   | Não     | Não      | Não    |
| Excluir materiais ou outros usuários     | Sim   | Não     | Não      | Não    |

As permissões são verificadas na API. Ocultar botões na interface complementa essa validação.

## Movimentação de estoque

```mermaid
flowchart TD
  Request["Solicitação de entrada ou saída"] --> Permission["Autenticar e autorizar perfil"]
  Permission --> Validate["Validar campos com Zod"]
  Validate --> Begin["Iniciar transação"]
  Begin --> Lock["Bloquear material · SELECT FOR UPDATE"]
  Lock --> Check["Conferir material, setor e fornecedor"]
  Check --> Balance{"Saldo resultante válido?"}
  Balance -->|"Não"| Rollback["Cancelar transação e retornar erro"]
  Balance -->|"Sim"| Save["Atualizar saldo e inserir movimento"]
  Save --> Audit["Inserir auditoria"]
  Audit --> Commit["Confirmar transação"]
  Commit --> Refresh["Atualizar consultas na interface"]
```

O bloqueio serializa operações concorrentes no mesmo material. Saldo, movimento e auditoria são confirmados juntos. Uma saída com saldo insuficiente é rejeitada. O estorno cria uma movimentação inversa vinculada à original, mantendo o registro anterior.

## Exclusões e preservação de histórico

```mermaid
flowchart TD
  Admin["Administrador confirma exclusão"] --> Kind{"Cadastro"}
  Kind -->|"Usuário"| Self{"É a própria conta?"}
  Self -->|"Sim"| Reject["Bloquear exclusão"]
  Self -->|"Não"| UserRemove["Definir deletedAt, inativar e revogar sessões"]
  UserRemove --> UserHistory["Remover da lista e preservar autoria do histórico"]
  Kind -->|"Material"| Mode{"Opção escolhida"}
  Mode -->|"Preservar histórico"| Archive["Definir deletedAt e inativar"]
  Archive --> History["Ocultar cadastro e manter movimentos"]
  Mode -->|"Apagar definitivamente"| Code["Exigir confirmação do código"]
  Code --> Purge["Apagar movimentos e material na mesma transação"]
  UserHistory --> Audit["Registrar auditoria da exclusão"]
  History --> Audit
  Purge --> Audit
```

Na remoção com preservação, códigos de materiais, e-mails e matrículas continuam reservados pelas restrições únicas. A exclusão definitiva de material usa uma exceção transacional delimitada no trigger de proteção do histórico. Ela não autoriza excluir auditoria ou movimentos de outros materiais.

## Dashboard, relatórios e documentos

```mermaid
flowchart LR
  DB[("Dados persistidos") ] --> Dashboard["GET /api/dashboard"]
  DB --> Reports["GET /api/reports/:kind"]
  Dashboard --> Metrics["Oito indicadores e alertas"]
  Dashboard --> Charts["Recharts · quatro gráficos"]
  Reports --> Export["Tabela, PDF, Excel e impressão"]
  Forms["Campos dos modelos de documentos"] --> PDF["PDF com itens e assinaturas"]
```

Os relatórios aplicam período conforme seu domínio: operações por data de movimentação ou transferência, e patrimônio pela aquisição. Estoque e fornecedores representam o cadastro atual. A biblioteca de documentos gera PDFs de requisição, entrega, responsabilidade, transferência e inventário no navegador; preencher um modelo não executa uma operação de estoque.

A validade pertence ao material e é opcional. A interface distingue datas vencidas, vencimento em até 30 dias e datas posteriores. Não há modelagem de validade por lote nem bloqueio automático de movimentação por vencimento.

## Qualidade e operação

- Testes unitários: regras de saldo, status e validação de validade.
- Testes de integração: API e PostgreSQL, incluindo concorrência, estorno, exclusões e revogação de acesso.
- Testes E2E: navegação e operações no navegador via Playwright.
- Migrations: alterações versionadas em `backend/prisma/migrations`.
- Backup local: `scripts/backup.mjs`; para banco externo, usar processo de backup adequado ao ambiente.

Os testes de integração e E2E precisam de um banco separado. Os comandos de preparação e publicação estão no [README](../README.md), e as variáveis estão em [ENVIRONMENT.md](ENVIRONMENT.md). Detalhes de hospedagem e conexão estão em [VERCEL_NEON.md](VERCEL_NEON.md).

## Limites atuais

Listagens da interface ainda paginam dados carregados, embora alguns endpoints ofereçam paginação no servidor. Exportações são geradas no navegador. Datas de operação podem ser retroativas; por isso os gráficos de movimentação e de evolução de saldo usam referências temporais diferentes. A documentação OpenAPI deve ser mantida em conjunto com novas rotas e campos.
