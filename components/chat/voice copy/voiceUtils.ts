export function canUseWakeLock(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function requestScreenWakeLock(): Promise<unknown | null> {
  if (!canUseWakeLock()) return null;
  try {
    const wakeLock = (navigator as unknown as { wakeLock?: { request?: (type: string) => Promise<unknown> } }).wakeLock;
    if (wakeLock && typeof wakeLock.request === 'function') {
      return await wakeLock.request('screen');
    }
    return null;
  } catch {
    return null;
  }
}

export function releaseWakeLock(lock: unknown | null) {
  try {
    if (lock && typeof (lock as unknown as { release?: () => void }).release === 'function') (lock as unknown as { release?: () => void }).release?.();
  } catch {}
}


