// Bridge to the hosted viewer's runtime capabilities. Outside that viewer
// (local dev, a saved copy) there is no window.claude and every capability
// resolves null, so callers always have a plain-browser fallback.

export function capability(name) {
  try {
    const use = typeof window !== 'undefined' ? window.claude?.use : undefined;
    return use ? Promise.resolve(use.call(window.claude, name)).catch(() => null) : Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * Offer a generated file to the viewer. In the hosted viewer this goes
 * through the downloads capability (the viewer confirms the save); in a
 * normal browser it falls back to an ordinary download link.
 * Resolves 'saved' | 'declined'; rejects with a readable Error otherwise.
 */
export async function saveFile(filename, data) {
  const downloads = await capability('downloads');
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return 'saved';
    } catch (e) {
      if (e?.code === 'declined') return 'declined';
      if (e?.code === 'rate_limited') throw new Error('Another save is already waiting for you. Finish that one first.');
      throw new Error(e?.message || 'This view can’t save files.');
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
