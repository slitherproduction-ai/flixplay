import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const base = (import.meta.env.VITE_LICENSE_API_URL as string | undefined)?.replace(/\/$/, '');
const apiConfigured = Boolean(base && /^https:\/\//.test(base));
type Result = { deviceId: string; linked: true };

async function post<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  if (!base || !apiConfigured) throw new Error('API HTTPS não configurada');
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error('Não foi possível concluir a operação (HTTP ' + response.status + ')');
  return response.json() as Promise<T>;
}

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [linked, setLinked] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage('');
    try {
      const auth = await post<{ token: string }>('/v1/auth/login', null, { email, password });
      if (!auth.token) throw new Error('Resposta de login inválida');
      setToken(auth.token); setPassword(''); setMessage('Sessão iniciada. Informe o código exibido no seu dispositivo.');
    } catch { setMessage('Não foi possível autenticar. Verifique seus dados e a conexão.'); }
    finally { setPending(false); }
  }
  async function claim(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !token || !/^[0-9]{8}$/.test(code)) return;
    setPending(true); setMessage(''); setLinked(null);
    try {
      const result = await post<Result>('/v1/devices/claim', token, { code });
      if (!result.linked || !result.deviceId) throw new Error('Resposta inválida');
      setLinked(result); setCode(''); setMessage('Dispositivo vinculado à sua conta.');
    } catch { setMessage('Código inválido, expirado ou já utilizado. Gere um novo código no dispositivo.'); }
    finally { setPending(false); }
  }
  async function logout() {
    const previous = token;
    setToken(null); setLinked(null); setCode(''); setMessage('Sessão encerrada.');
    if (previous) try { await post('/v1/auth/logout', previous); } catch { /* session stays discarded locally */ }
  }
  return <main className="page"><section className="panel">
    <div className="brand"><span className="logo">◇</span><span>ELVANOQ <b>CLOUD</b></span></div>
    <div className="eyebrow">PORTAL DO CLIENTE · AMBIENTE DE DESENVOLVIMENTO</div>
    <h1>Vincule seu dispositivo</h1>
    <p className="muted">Conecte seu ELVANOQ Play à sua conta. A vinculação não ativa automaticamente uma licença nem altera a reprodução.</p>
    {!apiConfigured ? <p role="alert" className="notice">Configure VITE_LICENSE_API_URL com a URL HTTPS da API para habilitar o portal.</p> : null}
    {!token ? <form onSubmit={login}>
      <label>E-mail<input required autoComplete="username" type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Senha<input required autoComplete="current-password" type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button disabled={!apiConfigured || pending} type="submit">{pending ? 'Entrando...' : 'Entrar na minha conta'}</button>
    </form> : <form onSubmit={claim}>
      <label>Código exibido na TV<input className="code" required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} placeholder="00000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,8))}/></label>
      <p className="hint">Abra a tela de vinculação no ELVANOQ Play e informe os oito números antes que expirem.</p>
      <button disabled={!apiConfigured || pending || code.length !== 8} type="submit">{pending ? 'Validando...' : 'Vincular dispositivo'}</button>
      <button className="secondary" type="button" onClick={() => { void logout(); }}>Sair da conta</button>
    </form>}
    {message ? <p role="status" className="message">{message}</p> : null}
    {linked ? <p role="status" className="success">Dispositivo confirmado. ID: {linked.deviceId}</p> : null}
    <footer>Portal em desenvolvimento · Nenhuma cobrança é realizada nesta página.</footer>
  </section></main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
