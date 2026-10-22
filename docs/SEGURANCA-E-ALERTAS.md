# Segurança e alertas de estoque

O login limita cada IP a 10 tentativas em 15 minutos. Uma proteção adicional limita cada identificação de conta a 20 tentativas malsucedidas em 15 minutos, mesmo com troca de IP. A identificação é normalizada e armazenada como hash no limitador. Ao exceder os limites, a API retorna HTTP 429 com uma mensagem em português.

A API limita cada IP a 300 requisições por minuto e envia `Cache-Control: no-store`, para evitar armazenamento de respostas autenticadas em caches. As proteções existentes de autenticação JWT, revogação de sessão, permissões, validação de dados e cabeçalhos Helmet continuam aplicadas.

Os contadores de requisições são mantidos na memória de cada processo. Reiniciar o servidor os zera, e instâncias distintas não compartilham contadores. Para produção com múltiplas instâncias ou funções serverless, o bloqueio coordenado exige um armazenamento compartilhado ou regras no firewall da hospedagem. Estas alterações reduzem riscos, mas não garantem proteção absoluta contra invasões.

O endpoint autenticado `GET /api/alerts` lista somente materiais ativos e não excluídos cujo saldo seja menor ou igual ao mínimo cadastrado, incluindo saldo zero. O sino mostra todos os itens afetados, com saldo, unidade e mínimo, e permite abrir o material correspondente.

Ao entrar, o sistema avisa sobre itens baixos ou esgotados. Também avisa quando um novo item entra nessa situação ou um item baixo esgota. Um item reposto acima do mínimo poderá gerar um novo aviso se voltar a ficar baixo. Avisos idênticos não se repetem em cada consulta.

Os alertas são consultados a cada 15 segundos enquanto a tela estiver ativa, ao retomar o foco e após alterações de dados no sistema. Os avisos são internos ao aplicativo; não há envio por e-mail ou WhatsApp. Ajuste o campo de estoque mínimo no cadastro do material para controlar o limite.

Validação: compilação de frontend e backend, lint do frontend e 35 testes de backend, incluindo bloqueio por IP, bloqueio por conta com IPs diferentes, rejeição de tokens inválidos e limites de estoque. A consulta `npm audit --omit=dev --audit-level=high` não apontou vulnerabilidades nas dependências de produção. Os testes de integração com PostgreSQL exigem um banco de teste separado e não foram executados nesta alteração.

## Reforço adicional contra invasões

A autenticação exige token assinado com HS256, identificação de usuário, expiração e versão inteira de sessão. Contas excluídas ou inativas e sessões revogadas são recusadas. O login executa a comparação de senha também para identificações inexistentes, reduzindo diferenças de tempo que podem revelar contas. A alteração de senha limita cada usuário a 10 tentativas em 15 minutos.

Os cabeçalhos configurados em `vercel.json` restringem scripts à própria origem, bloqueiam objetos incorporados e enquadramento por sites externos, evitam enviar o endereço da página como referência e ativam HSTS. A câmera continua disponível para o leitor de códigos; microfone e geolocalização são bloqueados. Estilos inline permanecem permitidos para os componentes existentes.

Esses cabeçalhos passam a valer depois da publicação na Vercel. A política de conexões presume frontend e API na mesma origem, como nas regras atuais da hospedagem. Se `VITE_API_URL` apontar para outra origem, ela precisa ser explicitamente incluída em `connect-src` antes da publicação. A política de scripts também restringe interfaces de documentação que dependam de scripts inline. A compatibilidade dos cabeçalhos precisa ser conferida no navegador após a publicação.
