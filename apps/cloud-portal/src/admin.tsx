import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const base = (import.meta.env.VITE_LICENSE_API_URL as string | undefined)?.replace(/\/$/, '');
const ready = Boolean(base && /^https:\/\//.test(base));
type Overview = { customers: number; devices: number; licenses: number; activeLicenses: number };
type Customer = { id: string; email: string; createdAt: string; _count: { devices: number; licenses: number } };
type License = { id: string; status: string; expiresAt: string; user: { email: string }; device: { publicCode: string; platform: string; displayName: string | null }; plan: { name: string } };
type LicensePreflight = { found: boolean; licenseId?: string; renewable: boolean; revocable: boolean; reasons: string[]; writesEnabled?: boolean };
type Page<T> = { items: T[]; page: number; total: number; pageSize: number };
async function api<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  if (!base || !ready) throw new Error('Configure API HTTPS');
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET',
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  if (!response.ok) throw new Error('Solicitação não autorizada ou indisponível');
  return response.json() as Promise<T>;
}
function Admin() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [customers, setCustomers] = useState<Page<Customer> | null>(null);
  const [licenses, setLicenses] = useState<Page<License> | null>(null);
  const [page, setPage] = useState(1);
  const [preflight, setPreflight] = useState<{ id: string; result: LicensePreflight } | null>(null);
  async function inspectLicense(id: string) {
    if (!token || busy) return;
    setBusy(true); setPreflight(null);
    try {
      const result = await api<LicensePreflight>('/v1/admin/licenses/' + encodeURIComponent(id) + '/preflight', token);
      setPreflight({ id, result });
    } catch { setMessage('Falha ao consultar elegibilidade da licença.'); }
    finally { setBusy(false); }
  }
  const [tab, setTab] = useState<'customers'|'licenses'>('customers');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function load(credential: string, kind: 'customers'|'licenses', nextPage: number) {
    setBusy(true);
    try {
      const [summary, table] = await Promise.all([api<Overview>('/v1/admin/overview',credential), api<Page<Customer> | Page<License>>('/v1/admin/' + kind + '?page=' + nextPage,credential)]);
      setOverview(summary); setTab(kind); setPage(nextPage); setPreflight(null);
      if (kind === 'customers') setCustomers(table as Page<Customer>); else setLicenses(table as Page<License>);
    } catch { setMessage('Não foi possível consultar os dados administrativos.'); }
    finally { setBusy(false); }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage('');
    try {
      const session = await api<{accessToken:string}>('/v1/auth/login',null,{email,password});
      setToken(session.accessToken); setPassword(''); setMfaPending(true);
      setMessage('Informe o código de seu autenticador para entrar no painel.');
    } catch { setMessage('Acesso negado: somente administradores autorizados.'); }
    finally { setBusy(false); }
  }
  async function verifyMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!token || busy || !/^[0-9]{6}$/.test(mfaCode)) return;
    setBusy(true); setMessage('');
    try {
      await api<{verified: true}>('/v1/auth/admin-mfa/verify', token, { code: mfaCode });
      setMfaPending(false); setSetupUri(''); setMfaCode('');
      void load(token,'customers',1);
    } catch { setMessage('Código inválido, reutilizado ou sessão expirada.'); }
    finally { setBusy(false); }
  }
  async function enrollMfa() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const result = await api<{setupUri:string}>('/v1/auth/admin-mfa/enroll', token, {});
      setSetupUri(result.setupUri);
    } catch { setMessage('Não foi possível configurar MFA. Se já houver cadastro, use o aplicativo ou solicite recuperação.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    const old = token; setToken(null); setMfaPending(false); setMfaCode(''); setSetupUri(''); setOverview(null); setCustomers(null); setLicenses(null); setPreflight(null); setMessage('');
    if (old) try { await api('/v1/auth/logout',old,{}); } catch { /* session discarded */ }
  }
  const table = tab === 'customers' ? customers : licenses;
  const fmt = (value:string) => new Date(value).toLocaleDateString('pt-BR');
  return <main className="page admin-page"><section className="panel admin-panel">
    <div className="brand"><span className="logo">◇</span>ELVANOQ <b>CLOUD</b></div>
    <p className="eyebrow">ACESSO ADMINISTRATIVO · SOMENTE LEITURA</p>
    <h1>Painel administrativo</h1>
    {!ready && <p className="notice">Configure a URL HTTPS da API para usar este painel.</p>}
    {!token ? <form onSubmit={login}>
      <label>E-mail de administrador<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Senha<input type="password" autoComplete="current-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/></label>
      <button disabled={!ready || busy}>Entrar com acesso administrativo</button>
    </form> : mfaPending ? <section>
      <h2>Confirmação de segurança</h2>
      <p className="muted">Digite o código do aplicativo autenticador para abrir o painel.</p>
      <form onSubmit={verifyMfa}>
        <label>Código de seis dígitos<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\\D/g,'').slice(0,6))}/></label>
        <button disabled={busy || mfaCode.length !== 6}>Verificar código</button>
      </form>
      <button className="secondary" type="button" disabled={busy} onClick={()=>void enrollMfa()}>Cadastrar meu autenticador</button>
      {setupUri && <p className="notice">Configuração confidencial. Copie para o autenticador e não compartilhe: <code className="mfa-uri">{setupUri}</code></p>}
      <button className="secondary" type="button" onClick={()=>void logout()}>Cancelar</button>
    </section> : <>
      <div className="admin-tools"><button className="secondary" onClick={() => void logout()}>Encerrar sessão</button></div>
      {overview && <div className="admin-metrics">
        <div><strong>{overview.customers}</strong><span>Clientes</span></div>
        <div><strong>{overview.devices}</strong><span>Dispositivos</span></div>
        <div><strong>{overview.licenses}</strong><span>Licenças</span></div>
        <div><strong>{overview.activeLicenses}</strong><span>Licenças ativas</span></div>
      </div>}
      <div className="admin-tools">
        <button disabled={busy} className={tab !== 'customers' ? 'secondary' : ''} onClick={() => void load(token,'customers',1)}>Clientes</button>
        <button disabled={busy} className={tab !== 'licenses' ? 'secondary' : ''} onClick={() => void load(token,'licenses',1)}>Licenças</button>
      </div>
      <div className="admin-rows">
        {tab === 'customers' && customers?.items.map(item => <article className="device" key={item.id}><strong>{item.email}</strong><p className="device-meta">Cadastro: {fmt(item.createdAt)} · {item._count.devices} dispositivo(s) · {item._count.licenses} licença(s)</p></article>)}
        {tab === 'licenses' && licenses?.items.map(item => <article className="device" key={item.id}><strong>{item.user.email}</strong><p className="device-meta">{item.plan.name} · {item.status} · {item.device.displayName || item.device.platform}</p><p className="device-meta">Vencimento: {fmt(item.expiresAt)}</p><button type="button" className="secondary" disabled={busy} onClick={() => void inspectLicense(item.id)}>Verificar elegibilidade</button>{preflight?.id === item.id && <p className="notice" role="status">Renovação: {preflight.result.renewable ? "Elegível em análise" : "Indisponível"} · Revogação: {preflight.result.revocable ? "Possível em análise" : "Indisponível"} · Somente consulta, sem executar alterações.</p>}</article>)}
        {table?.items.length === 0 && <p className="muted">Nenhum registro encontrado.</p>}
      </div>
      {table && <div className="admin-tools"><button className="secondary" disabled={busy || page <= 1} onClick={() => void load(token,tab,page-1)}>Anterior</button><span>Página {page} · {table.total} registros</span><button className="secondary" disabled={busy || page * table.pageSize >= table.total} onClick={() => void load(token,tab,page+1)}>Próxima</button></div>}
    </>}
    {message && <p role="status" className="notice">{message}</p>}
    <footer>Ambiente em desenvolvimento. Nenhuma ação de cobrança ou alteração de licenças é permitida neste painel.</footer>
  </section></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Admin/></React.StrictMode>);
