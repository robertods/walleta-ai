import { type ComponentChildren, type JSX } from 'preact';
import { useState } from 'preact/hooks';

const verifier = import.meta.env.VITE_WALLETA_INVITE_SHA256;
const activationKey = 'walleta:activated';

function hasActivation() {
  try {
    return localStorage.getItem(activationKey) === '1';
  } catch {
    return false;
  }
}

export function InviteGate({ children }: { children: ComponentChildren }) {
  const [activated, setActivated] = useState(hasActivation);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0]) {
    event.preventDefault();
    if (checking) return;
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim().toLowerCase();
    setChecking(true);
    setError('');
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== verifier) {
        setError('El código no coincide. Revisalo y volvé a intentar.');
        return;
      }
      localStorage.setItem(activationKey, '1');
      setActivated(true);
    } catch {
      setError('No pudimos activar Walleta. Abrila por HTTPS y verificá el almacenamiento del navegador.');
    } finally {
      setChecking(false);
    }
  }

  if (activated) return <>{children}</>;

  return <main>
    <div class="page-title"><h1>Activar Walleta</h1></div>
    <form class="panel form" onSubmit={submit}>
      <label class="field">Código de invitación
        <input name="code" type="password" autoCapitalize="none" autoCorrect="off"
          spellcheck={false} autoComplete="off" required />
      </label>
      {error && <p class="error" role="alert">{error}</p>}
      {!verifier && <p class="error" role="alert">Falta configurar el código de invitación.</p>}
      <button class="primary" disabled={checking || !verifier}>Activar</button>
    </form>
  </main>;
}
