import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Package,
  ArrowRight,
  ShieldCheck,
  UserRound,
  Truck,
  LockKeyhole,
} from 'lucide-react';
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
  const [remember, setRemember] = useState(!!localStorage.getItem('nucleo-remembered-login'));
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
  } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { login: localStorage.getItem('nucleo-remembered-login') || '' },
  });
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
        if (remember) localStorage.setItem('nucleo-remembered-login', data.login);
        else localStorage.removeItem('nucleo-remembered-login');
        navigate('/');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="login-page logistics-login">
      <section className="logistics-brand" aria-label="Núcleo de Material e Patrimônio">
        <div className="logistics-brand-content">
          <div className="logistics-logo">
            <img
              className="logistics-brand-logo"
              src="/images/stelecom-logo.png"
              alt="Superintendência de Telecomunicações — STELECOM, SSP/BA"
              width={96}
              height={96}
            />
            <div>
              <strong>Núcleo de Material e Patrimônio</strong>
              <span>Material e Patrimônio</span>
            </div>
          </div>
          <div className="logistics-benefits">
            <div>
              <Package />
              <span>
                Gestão
                <br />
                de materiais
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                Proteção
                <br />
                do patrimônio
              </span>
            </div>
            <div>
              <Truck />
              <span>
                Logística
                <br />
                mais eficiente
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="logistics-access" aria-labelledby="access-title">
        <div className="login-form logistics-card">
          <h1 id="access-title">
            {reset ? 'Redefina sua senha' : forgot ? 'Recupere seu acesso' : 'Acesse sua conta'}
          </h1>
          <p>
            {reset
              ? 'Escolha uma senha com pelo menos 12 caracteres.'
              : forgot
                ? 'Informe seu e-mail para receber as instruções.'
                : 'Informe seus dados para entrar no sistema.'}
          </p>
          <form onSubmit={handleSubmit(submit)}>
            {forgot ? (
              <label>
                E-mail
                <div className="logistics-input">
                  <UserRound size={20} aria-hidden="true" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Digite seu e-mail"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <small className="field-error">{String(errors.email.message)}</small>
                )}
              </label>
            ) : (
              <>
                {!reset && (
                  <label>
                    Usuário
                    <div className="logistics-input">
                      <UserRound size={20} aria-hidden="true" />
                      <input
                        autoComplete="username"
                        placeholder="Digite seu usuário"
                        title="Utilize seu e-mail ou matrícula"
                        {...register('login')}
                      />
                    </div>
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
                      placeholder="••••••••••"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setVisible((v) => !v)}
                    >
                      {visible ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.password && (
                    <small className="field-error">{String(errors.password.message)}</small>
                  )}
                </label>
              </>
            )}
            {!forgot && !reset && (
              <div className="logistics-options">
                <label className="logistics-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Lembrar de mim
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setForgot(true);
                    setError('');
                    setNotice('');
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>
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
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting
                ? 'Aguarde…'
                : reset
                  ? 'Atualizar senha'
                  : forgot
                    ? 'Enviar instruções'
                    : 'Entrar'}
              <ArrowRight size={20} />
            </button>
          </form>
          {reset ? (
            <Link className="logistics-back" to="/login">
              Voltar ao login
            </Link>
          ) : (
            forgot && (
              <button
                className="text-button logistics-back"
                onClick={() => {
                  setForgot(false);
                  setError('');
                  setNotice('');
                }}
              >
                Voltar ao login
              </button>
            )
          )}
          <div className="logistics-security">
            <LockKeyhole size={17} aria-hidden="true" />
            <span>Acesso restrito a usuários autorizados</span>
          </div>
        </div>
      </section>
    </main>
  );
}
