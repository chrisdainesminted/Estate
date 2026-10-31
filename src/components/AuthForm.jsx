import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { signIn, signUp } from '../lib/account.js';

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

/** Create an account or sign in, with an email and password. */
export default function AuthForm({ start = 'signup', onDone, compact = false }) {
  const [mode, setMode] = useState(start);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const link = await (signup ? signUp(email, password) : signIn(email, password));
      onDone?.(link, mode);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'This works on the Bedrock website.' : err.message);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-lg bg-well p-1 text-sm">
        {[
          ['signup', 'Create account'],
          ['signin', 'Sign in'],
        ].map(([k, t]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => (setMode(k), setError(''))}
            className={`rounded-md px-3 py-1.5 font-medium transition ${mode === k ? 'bg-(--panel) text-zinc-950 shadow-sm ring-1 ring-(--line-strong) dark:text-white' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {!compact && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {signup
            ? 'Save your numbers, homes, applications and rentals, and pick up on any device. Free.'
            : 'Welcome back. Your saved homes, applications and rentals are waiting.'}
        </p>
      )}
      <div>
        <label htmlFor="auth-email" className={label}>
          Email
        </label>
        <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="auth-pw" className={label}>
          Password{signup ? ' (8 characters or more)' : ''}
        </label>
        <div className="field flex items-center">
          <input
            id="auth-pw"
            type={show ? 'text' : 'password'}
            required
            minLength={signup ? 8 : 1}
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent px-3 py-2.5 text-sm text-zinc-900 outline-none dark:text-zinc-100"
          />
          <button type="button" onClick={() => setShow((v) => !v)} className="px-3 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-(--accent) px-4 py-2.5 text-sm font-semibold text-(--accent-ink) shadow-[0_10px_30px_-12px_rgb(16_185_129/0.7)] transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? (signup ? 'Creating your account…' : 'Signing in…') : signup ? 'Create my account' : 'Sign in'}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {signup ? (
          <>
            By creating an account you agree to the <a href="/terms/" className="underline">terms</a> and <a href="/privacy/" className="underline">privacy policy</a>.
          </>
        ) : (
          'Forgot your password? Your private account link (in your account page on a device you’re signed in on) still opens it.'
        )}
      </p>
    </form>
  );
}
