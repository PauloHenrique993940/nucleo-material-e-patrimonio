# Cobertura dos requisitos

| Requisito                  | Implementação                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1. Login                   | Login.tsx; JWT, bcrypt, e-mail/matrícula, recuperação e sessão                                                |
| 2. Dashboard               | Dashboard.tsx e insights.ts; oito cards e quatro gráficos                                                     |
| 3. Materiais               | Entities.tsx; CRUD, inativação, exclusão condicionada, filtros e ordenação                                    |
| 4. Categorias              | Cadastro com nome, descrição e ativo                                                                          |
| 5–6. Entrada/saída         | Stock.tsx e services/stock.ts; confirmação e transação com bloqueio                                           |
| 7. Movimentações           | Movements.tsx; período, material, categoria, tipo, setor e responsável                                        |
| 8. Patrimônio              | Campos completos, estados e transferência com histórico                                                       |
| 9–10. Fornecedores/setores | Cadastros e consulta dos históricos em detalhes                                                               |
| 11. Alertas                | Dashboard, notificações, listagem e filtro por situação                                                       |
| 12. Relatórios             | Doze tipos, cabeçalho, período, PDF, XLSX e impressão                                                         |
| 13. Usuários/permissões    | Quatro perfis, criação/edição/inativação e RBAC na API                                                        |
| 14. Auditoria              | Login, cadastros, alterações, inativação, exclusão permitida, movimentação, transferência, senha e relatórios |
| 15. Busca global           | Cabeçalho e /search; código, barras, nome, tombamento, fornecedor e setor                                     |
| 16. Interface              | Menu completo, tema, responsividade, semântica, labels, foco e diálogos nativos                               |
| 17–18. Banco/regras        | Prisma/PostgreSQL, migrations, relações, restrições, transações e histórico protegido                         |
| 19. Adicionais             | Barras CODE128, câmera/USB, paginação, filtros, pesquisa, toasts, confirmações, estados e backup              |
| 20. Segurança              | JWT expira/revoga, bcrypt, Zod, rate limit, Helmet, CORS, .env e RBAC                                         |
| 21. Estrutura              | Frontend dividido por responsabilidade e backend com rotas, serviços, schemas, repositório e utilitários      |
| 22. Qualidade              | ESLint, Prettier, unitários, integração PostgreSQL, E2E Playwright, README e OpenAPI                          |

A recuperação por e-mail precisa de um serviço SMTP configurado. A câmera precisa de suporte do navegador; há alternativa USB/manual. O backup local depende do Docker. Testes automatizados não substituem homologação com os fluxos e dados reais do setor.
