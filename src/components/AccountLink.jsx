import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { accountLink } from '../lib/account.js';

/** "Sign in", or your account once this browser is signed in. For the website's headers. */
export default function AccountLink({ className = '' }) {
  const [signedIn, setSignedIn] = useState(() => Boolean(accountLink()));
  useEffect(() => {
    const on = () => setSignedIn(Boolean(accountLink()));
    window.addEventListener('bedrock-account', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('bedrock-account', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return (
    <a
      href={signedIn ? '/account/' : '/account/?mode=signin'}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-zinc-700 hover:bg-well hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white ${className}`}
    >
      <UserRound className="size-4" aria-hidden />
      {signedIn ? 'Account' : 'Sign in'}
    </a>
  );
}
