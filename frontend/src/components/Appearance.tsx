import { useEffect, useState } from 'react';

const fonts = ['Segoe UI', 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New'];
const colors = [
  ['Fundo', '--bg', '#f3f5f7'],
  ['Painéis e tabelas', '--surface', '#ffffff'],
  ['Texto', '--text', '#263b4d'],
  ['Cor principal', '--primary', '#19456b'],
  ['Menu lateral', '--custom-sidebar', '#07264f'],
] as const;
type Preferences = { font: string; uppercase: boolean; colors: Record<string, string> };
const defaults: Preferences = { font: 'Segoe UI', uppercase: false, colors: {} };
const key = 'nucleo-appearance-v1';
function load(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    return {
      font: fonts.includes(saved.font) ? saved.font : defaults.font,
      uppercase: saved.uppercase === true,
      colors: Object.fromEntries(
        colors
          .filter(([, variable]) => /^#[0-9a-f]{6}$/i.test(saved.colors?.[variable] || ''))
          .map(([, variable]) => [variable, saved.colors[variable]]),
      ),
    };
  } catch {
    return defaults;
  }
}
export function applyAppearance(value: Preferences) {
  const root = document.documentElement;
  root.style.setProperty(
    '--custom-font',
    `'${value.font}', ${['Georgia', 'Times New Roman'].includes(value.font) ? 'serif' : value.font === 'Courier New' ? 'monospace' : 'sans-serif'}`,
  );
  root.dataset.uppercase = String(value.uppercase);
  for (const [, variable] of colors) {
    if (value.colors[variable]) root.style.setProperty(variable, value.colors[variable]);
    else root.style.removeProperty(variable);
  }
  for (const variable of ['--panel', '--input']) {
    if (value.colors['--surface']) root.style.setProperty(variable, value.colors['--surface']);
    else root.style.removeProperty(variable);
  }
}
export function initializeAppearance() {
  applyAppearance(load());
}
export function Appearance() {
  const [value, setValue] = useState(load);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    applyAppearance(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setNotice('Não foi possível salvar neste navegador. As alterações valem para esta sessão.');
    }
  }, [value]);
  return (
    <div className="appearance-settings">
      <p>Personalize todas as telas. As alterações são imediatas e ficam salvas neste navegador.</p>
      <label htmlFor="appearance-font">Fonte do texto</label>
      <select
        id="appearance-font"
        value={value.font}
        onChange={(e) => setValue((v) => ({ ...v, font: e.target.value }))}
      >
        {fonts.map((font) => (
          <option key={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>
      <label className="appearance-uppercase">
        <input
          type="checkbox"
          checked={value.uppercase}
          onChange={(e) => setValue((v) => ({ ...v, uppercase: e.target.checked }))}
        />
        Exibir textos em MAIÚSCULAS
      </label>
      <p>A exibição em maiúsculas preserva os dados cadastrados.</p>
      <div className="appearance-grid">
        {colors.map(([label, variable, fallback]) => (
          <div key={variable}>
            <label htmlFor={'appearance' + variable}>{label}</label>
            <div className="appearance-color">
              <input
                id={'appearance' + variable}
                type="color"
                value={value.colors[variable] || fallback}
                onChange={(e) =>
                  setValue((v) => ({ ...v, colors: { ...v.colors, [variable]: e.target.value } }))
                }
              />
              <button
                type="button"
                disabled={!value.colors[variable]}
                onClick={() =>
                  setValue((v) => {
                    const next = { ...v.colors };
                    delete next[variable];
                    return { ...v, colors: next };
                  })
                }
              >
                Usar padrão
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="appearance-preview">
        <h3>Prévia da aparência</h3>
        <p>Materiais e patrimônio · Saldo disponível · 123456</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setValue(defaults);
          setNotice('Aparência padrão restaurada.');
        }}
      >
        Restaurar aparência padrão
      </button>
      <p role="status">{notice}</p>
    </div>
  );
}
