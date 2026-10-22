import { ShieldCheck, ExternalLink, Landmark, UserRound } from 'lucide-react';
import './QuemSomos.css';

const atribuicoes = [
  ['Aquisição e Levantamento', 'Participar do levantamento de necessidades e apoiar processos de compra de materiais de consumo e permanentes.'],
  ['Recebimento e Almoxarifado', 'Receber, conferir, catalogar e controlar o estoque de materiais no almoxarifado, garantindo o fluxo contínuo para as atividades das unidades.'],
  ['Controle Patrimonial', 'Cadastrar, tombar, numerar e manter atualizado o registro de bens móveis e permanentes.'],
  ['Distribuição e Manutenção', 'Distribuir os materiais e equipamentos às respectivas unidades ou delegacias, além de acompanhar as condições de uso, conservação ou necessidade de reposição/baixa.'],
  ['Relatórios e Inventários', 'Produzir inventários periódicos e relatórios gerenciais sobre a situação dos bens sob a guarda do órgão.'],
] as const;

export function QuemSomos() {
  return (
    <div className="institutional-page">
      <header className="institutional-hero">
        <div>
          <span className="institutional-kicker">SECRETARIA DA SEGURANÇA PÚBLICA DA BAHIA</span>
          <h1>Quem somos</h1>
          <p>Núcleo de Material e Patrimônio</p>
        </div>
        <ShieldCheck size={64} strokeWidth={1.2} aria-hidden="true" />
      </header>
      <section className="card institutional-intro" aria-labelledby="quem-somos-apresentacao">
        <div className="institutional-intro-icon" aria-hidden="true"><Landmark size={32} strokeWidth={1.5} /></div>
        <div className="institutional-intro-content">
        <span className="eyebrow">APRESENTAÇÃO INSTITUCIONAL</span>
        <h2 id="quem-somos-apresentacao">Gestão de materiais e patrimônio público</h2>
        <p>
          O <strong>Núcleo (ou Coordenação) de Material e Patrimônio</strong> na
          Secretaria da Segurança Pública da Bahia (SSP-BA) — ou em órgãos vinculados
          como o DPT e superintendências — é o setor responsável pela{' '}
          <strong>gestão logística e controle de todos os bens públicos</strong>.
        </p>
        </div>
      </section>
      <section className="institutional-responsibilities" aria-labelledby="atribuicoes-titulo">
        <h2 id="atribuicoes-titulo">Principais atribuições</h2>
        <ul className="institutional-grid">
          {atribuicoes.map(([titulo, descricao]) => (
            <li key={titulo} className="institutional-duty"><h3>{titulo}</h3><p>{descricao}</p></li>
          ))}
        </ul>
      </section>
      <section className="institutional-team" aria-labelledby="equipe-titulo">
        <span className="eyebrow">SERVIDORES</span>
        <h2 id="equipe-titulo">Nossa equipe</h2>
        <ul className="institutional-team-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="institutional-server">
              <div className="institutional-server-avatar" aria-hidden="true">
                <UserRound size={32} strokeWidth={1.5} />
              </div>
              <span className="institutional-server-number">Servidor {String(index + 1).padStart(2, '0')}</span>
              <h3>Nome a informar</h3>
              <p>Cargo a informar</p>
              <span className="institutional-server-unit">Material e Patrimônio</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card institutional-sources" aria-labelledby="fontes-titulo">
        <h2 id="fontes-titulo">Referências institucionais</h2>
        <ul>
          <li><a href="https://www.ba.gov.br/ssp/institucional/stelecom/sobre-a-stelecom" target="_blank" rel="noopener noreferrer">SSP-BA — Sobre a Stelecom <ExternalLink size={15} aria-hidden="true" /><span className="institutional-link-note">(abre em nova aba)</span></a></li>
          <li><a href="https://www.gov.br/mdh/pt-br/acesso-a-informacao/participacao-social/forum-nacional-de-ouvidores-de-policia-fnop/legislacao-1/normativa-da-bahia-regimento-interno" target="_blank" rel="noopener noreferrer">Regimento interno — Normativa da Bahia <ExternalLink size={15} aria-hidden="true" /><span className="institutional-link-note">(abre em nova aba)</span></a></li>
        </ul>
      </section>
    </div>
  );
}
