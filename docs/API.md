# API REST

Base: `http://localhost:3001/api`. Swagger em `/api/docs`, documento OpenAPI em `/api/openapi.json`.

Envie JSON e, após login, `Authorization: Bearer <token>`. O token expira em oito horas. Inativação, alteração de perfil, redefinição de senha e logout invalidam sessões. Não há refresh token: após expiração, faça login novamente.

## Autenticação

| Método | Rota                    | Corpo / resultado                                                               |
| ------ | ----------------------- | ------------------------------------------------------------------------------- |
| POST   | `/auth/login`           | `{ "login": "email ou matrícula", "password": "senha" }` → `{ token, user }`    |
| GET    | `/auth/me`              | Usuário atual, sem hash de senha                                                |
| POST   | `/auth/logout`          | Revoga todas as sessões do usuário                                              |
| POST   | `/auth/forgot-password` | `{ email }`; requer SMTP configurado; resposta genérica para impedir enumeração |
| POST   | `/auth/reset-password`  | `{ token, password }`; link de uso único, válido por 30 minutos                 |
| POST   | `/auth/change-password` | `{ currentPassword, password }`; revoga sessões                                 |

Login e recuperação têm limite de dez requisições a cada quinze minutos por IP. Senhas novas exigem pelo menos doze caracteres.

## Cadastros

`GET /materials`, `/categories`, `/suppliers`, `/departments`, `/assets`: listagens autenticadas. `POST` cria; `PUT /<recurso>/:id` atualiza o formulário completo. `DELETE /materials/:id` é exclusivo do administrador e só permite materiais sem histórico.

| Recurso     | Campos obrigatórios                                                               | Campos adicionais                                                                                   |
| ----------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| materials   | code, name, categoryId                                                            | barcode, description, unit, minimum, maximum, location, shelf, unitPrice, supplierId, active, notes |
| categories  | name                                                                              | description, active                                                                                 |
| suppliers   | name, cnpj (14 dígitos)                                                           | tradeName, phone, email, address, responsible, notes, active                                        |
| departments | name, acronym                                                                     | responsible, phone, email, active                                                                   |
| assets      | number, name, categoryId, acquisitionDate (ISO), value, departmentId, responsible | description, brand, model, serialNumber, condition, location, status                                |
| users       | name, email, registration, password, role                                         | active na atualização                                                                               |

IDs são UUIDs. Valores monetários são números não negativos na entrada e Decimal serializado como string na saída. Saldo de material não é editável por cadastro: use movimentações. Códigos e tombamentos são únicos. `maximum >= minimum >= 0`.

Situações patrimoniais: `IN_USE`, `AVAILABLE`, `MAINTENANCE`, `TRANSFERRED`, `DISPOSED`. Perfis: `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`.

Listagem de materiais aceita `q`, `categoryId`, `supplierId`, `active=true|false`, `stock=Normal|Baixo|Crítico|Sem estoque`, `sort=name|code|quantity|unitPrice|createdAt`, `order=asc|desc`. `page` e `pageSize` (até 100) retornam `{ rows, total, page, pageSize }`; sem `page`, retorna uma lista. A interface pagina e ordena os dados carregados no cliente.

Históricos: `GET /suppliers/:id/history`, `/departments/:id/history`, `/assets/:id/history`.

## Estoque e patrimônio

`POST /movements`:

```json
{
  "materialId": "UUID",
  "type": "OUT",
  "quantity": 2,
  "date": "2026-10-05T12:00:00.000Z",
  "departmentId": "UUID",
  "receiver": "Servidor que retirou",
  "deliverer": "Responsável pela entrega",
  "requestNumber": "SOL-001",
  "purpose": "Uso administrativo",
  "notes": ""
}
```

Entrada usa `type=IN`, `supplierId`, `invoice`, `process`, `unitPrice`, `receiver`. Saída exige setor; seu custo é o valor unitário do cadastro no momento da operação. Responsável autenticado é registrado em `userId`, independentemente dos nomes de recebimento/entrega.

`GET /movements` aceita `from`, `to` (ISO), `type`, `materialId`, `categoryId`, `departmentId`, `supplierId`, `userId`, `page`, `pageSize`.

`POST /movements/:id/reverse` recebe `{ notes }`, com motivo de pelo menos cinco caracteres. Cria operação inversa ligada ao original. Uma operação só pode ser estornada uma vez; estornos não podem ser estornados. Estorno de entrada exige saldo suficiente. Não existem rotas de edição/exclusão de movimento.

`POST /assets/:id/transfer` recebe `{ departmentId, responsible, notes }`. Origem e destino devem ser diferentes; bem baixado não pode ser transferido. Edição de cadastro não pode alterar setor. `GET /transfers` lista o histórico.

Transações bloqueiam o material/bem com `SELECT FOR UPDATE`. Saldo, lançamento e auditoria são persistidos juntos. O banco também impede quantidades negativas e atualização/exclusão dos históricos de estoque, transferência e auditoria.

## Dashboard, busca e relatórios

`GET /dashboard`: oito indicadores, séries dos últimos doze meses, categorias, materiais mais movimentados, últimas operações e alertas. Evolução de saldo usa a data de criação do lançamento; entradas/saídas usam a data operacional informada. Materiais inativos não entram nos indicadores atuais; a evolução histórica considera o livro completo.

`GET /search?q=texto`: pelo menos dois caracteres; até oito resultados por recurso em materiais, bens, fornecedores e setores.

`GET /reports/:kind?from=ISO&to=ISO&departmentId=UUID`: tipos `stock`, `low`, `empty`, `entries`, `exits`, `movements`, `department`, `period`, `used`, `suppliers`, `assets`, `transfers`. Retorna cabeçalho, data de emissão, usuário, período e linhas. Emissão é auditada. PDF e XLSX são gerados no navegador a partir desses dados. Relatórios de estoque e fornecedores representam o estado atual; o período se aplica à data operacional, transferência ou aquisição conforme o relatório. Consumo contabiliza saídas efetivas e desconta os estornos de saída no período. Estornos de entrada não são consumo. A classificação por material preserva o código para distinguir cadastros com nomes iguais. Todos os estornos continuam identificados no relatório de movimentações.

## Permissões

| Operação                                         | Administrador | Gestor | Operador | Consulta |
| ------------------------------------------------ | ------------- | ------ | -------- | -------- |
| Consultar estoque/cadastros/históricos/dashboard | Sim           | Sim    | Sim      | Sim      |
| Cadastrar/editar materiais e categorias          | Sim           | Sim    | Sim      | Não      |
| Entrada/saída                                    | Sim           | Sim    | Sim      | Não      |
| Estorno e patrimônio                             | Sim           | Sim    | Não      | Não      |
| Fornecedores/setores: gravação                   | Sim           | Não    | Não      | Não      |
| Relatórios                                       | Sim           | Sim    | Não      | Sim      |
| Usuários e auditoria                             | Sim           | Não    | Não      | Não      |

## Erros

Formato `{ "message": "Descrição em português" }`. Validação: 400; sessão inválida: 401; permissão: 403; inexistente: 404; código duplicado, vínculo ou saldo insuficiente: 409; limite de requisições: 429; erro interno: 500. Erros internos não expõem credenciais nem stack traces ao cliente.
