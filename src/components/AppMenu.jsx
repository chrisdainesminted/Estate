import { UserRound } from 'lucide-react';

/**
 * The header's profile button. Signed in (or on the Claude page, which syncs
 * to the Claude account), it opens your profile; signed out, it opens the
 * page to make an account or sign in. No menu: everything that used to sit
 * in one lives in the profile's settings.
 */
export default function AppMenu({ signedIn, synced, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={signedIn ? `Your profile${synced ? ' (synced)' : ''}` : 'Make an account or sign in'}
      title={signedIn ? 'Your profile' : 'Make an account or sign in'}
      className="relative grid size-9 place-items-center rounded-full bg-well text-zinc-700 ring-1 ring-(--line-strong) transition ring-inset hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:text-white"
    >
      <UserRound className="size-4" aria-hidden />
      {synced && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-(--page)" aria-hidden />}
    </button>
  );
}
