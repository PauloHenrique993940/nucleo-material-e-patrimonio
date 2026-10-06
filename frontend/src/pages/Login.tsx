import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Package, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
export function Login({ reset = false }: { reset?: boolean }) {
  const [visible, setVisible] = useState(false),
    [forgot, setForgot] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const { login } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const schema: z.ZodType<any> = reset
    ? z.object({ password: z.string().min(12, 'Use pelo menos 12 caracteres.') })
    : forgot
      ? z.object({ email: z.string().email('Informe um e-mail válido.') })
      : z.object({
          login: z.string().min(1, 'Informe seu e-mail ou matrícula.'),
          password: z.string().min(1, 'Informe sua senha.'),
        });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<any>({ resolver: zodResolver(schema) });
  const submit = async (data: any) => {
    setError('');
    setNotice('');
    try {
      if (reset) {
        const d = await api('/auth/reset-password', 'POST', {
          password: data.password,
          token: params.get('token'),
        });
        setNotice(d.message);
      } else if (forgot) {
        const d = await api('/auth/forgot-password', 'POST', data);
        setNotice(d.message);
      } else {
        await login(data.login, data.password);
        navigate('/');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="login-page institutional-login">
      <div className="portal-utility">
        <span>SSP · Gestão de materiais e patrimônio</span>
        <span>Acesso restrito</span>
      </div>
      <header className="portal-masthead">
        <div className="portal-emblem" aria-hidden="true">
          <Package size={30} />
        </div>
        <div>
          <span className="portal-kicker">SSP · SISTEMA DE GESTÃO ADMINISTRATIVA</span>
          <h1>Núcleo de Material e Patrimônio</h1>
          <p>Controle de estoque, movimentações e bens patrimoniais</p>
        </div>
      </header>
      <div className="portal-module-strip">ALMOXARIFADO E CONTROLE PATRIMONIAL</div>
      <div className="portal-breadcrumb">
        <span>Portal administrativo</span>
        <span aria-hidden="true">›</span>
        <strong>
          {reset
            ? 'Redefinição de senha'
            : forgot
              ? 'Recuperação de acesso'
              : 'Identificação do usuário'}
        </strong>
      </div>
      <div className="portal-content">
        <section className="login-panel" aria-labelledby="access-title">
          <div className="portal-section-title">
            <ShieldCheck size={16} />
            <h2 id="access-title">
              {reset
                ? 'REDEFINIÇÃO DE SENHA'
                : forgot
                  ? 'RECUPERAÇÃO DE ACESSO'
                  : 'ACESSO AO SISTEMA'}
            </h2>
          </div>
          <div className="login-form">
            <p className="portal-form-intro">
              {reset
                ? 'Escolha uma senha com pelo menos 12 caracteres.'
                : forgot
                  ? 'Informe seu e-mail para receber as instruções.'
                  : 'Informe seu e-mail ou matrícula e sua senha para acessar o sistema.'}
            </p>
            <form onSubmit={handleSubmit(submit)}>
              {forgot ? (
                <label>
                  E-mail
                  <input type="email" autoComplete="email" {...register('email')} />
                  {errors.email && (
                    <small className="field-error">{String(errors.email.message)}</small>
                  )}
                </label>
              ) : (
                <>
                  {!reset && (
                    <label>
                      E-mail ou matrícula
                      <input autoComplete="username" {...register('login')} />
                      {errors.login && (
                        <small className="field-error">{String(errors.login.message)}</small>
                      )}
                    </label>
                  )}
                  <label>
                    {reset ? 'Nova senha' : 'Senha'}
                    <div className="password-field">
                      <input
                        type={visible ? 'text' : 'password'}
                        autoComplete={reset ? 'new-password' : 'current-password'}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setVisible((v) => !v)}
                      >
                        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && (
                      <small className="field-error">{String(errors.password.message)}</small>
                    )}
                  </label>
                </>
              )}
              {error && (
                <p role="alert" className="error-box">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="success-box">
                  {notice}
                </p>
              )}
              <button className="primary" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Aguarde…'
                  : reset
                    ? 'Atualizar senha'
                    : forgot
                      ? 'Enviar instruções'
                      : 'Entrar no sistema'}
                <ArrowRight size={18} />
              </button>
            </form>
            {reset ? (
              <Link to="/login">Voltar ao login</Link>
            ) : (
              <button
                className="text-button"
                onClick={() => {
                  setForgot((v) => !v);
                  setError('');
                  setNotice('');
                }}
              >
                {forgot ? 'Voltar ao login' : 'Esqueci minha senha'}
              </button>
            )}
            <div className="portal-session-note">
              <ShieldCheck size={14} />
              <span>
                Acesso restrito a usuários autorizados. Suas operações são registradas para
                auditoria.
              </span>
            </div>
          </div>
        </section>
        <aside className="portal-guidance" aria-labelledby="guidance-title">
          <div className="portal-guidance-title">
            <Info size={16} />
            <h2 id="guidance-title">Orientações de acesso</h2>
          </div>
          <ul>
            <li>Utilize o e-mail cadastrado ou sua matrícula para entrar.</li>
            <li>A senha é pessoal. Não compartilhe suas credenciais.</li>
            <li>Se não lembrar sua senha, utilize a opção de recuperação de acesso.</li>
          </ul>
          <p>
            Para solicitar um cadastro ou atualizar suas permissões, entre em contato com o
            administrador do núcleo.
          </p>
        </aside>
      </div>
      <footer className="portal-footer">
        <strong>Núcleo de Material e Patrimônio</strong>
        <span>Gestão administrativa · Estoque e patrimônio</span>
      </footer>
    </main>
  );
}
