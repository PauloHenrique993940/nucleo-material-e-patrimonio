import { useApp } from '../contexts/AppContext';
import { EntityForm } from '../components/EntityForm';
import { api } from '../services/api';
export function Settings() {
  const { dark, toggleTheme, toast } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERÊNCIAS</span>
          <h1>Configurações</h1>
          <p>Personalize sua experiência e proteja seu acesso.</p>
        </div>
      </div>
      <section className="card">
        <h2>Aparência</h2>
        <p>Tema atual: {dark ? 'escuro' : 'claro'}.</p>
        <button onClick={toggleTheme}>Alternar tema</button>
      </section>
      <section className="card settings-password">
        <h2>Alterar senha</h2>
        <p>Após a alteração, todas as suas sessões serão encerradas.</p>
        <EntityForm
          fields={[
            { key: 'currentPassword', label: 'Senha atual', type: 'password', required: true },
            {
              key: 'password',
              label: 'Nova senha (mínimo 12 caracteres)',
              type: 'password',
              required: true,
            },
          ]}
          onSubmit={async (d) => {
            try {
              await api('/auth/change-password', 'POST', d);
              toast('Senha atualizada. Entre novamente.');
              window.dispatchEvent(new Event('session-expired'));
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        />
      </section>
    </>
  );
}
