export function isAbortError(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    // Spec-compliant fetch implementations
    (('name' in err && (err as any).name === 'AbortError') ||
      // Expo fetch
      ('message' in err && String((err as any).message).includes('FetchRequestCanceledException')))
  )
}

export async function runWithAbortBoundary<T>(
  fn: () => Promise<T>,
  signal: AbortSignal,
  handle: { onAborted?: (e: any) => any; onError?: (e: any) => any }
): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    if (e?.name === 'AbortError' || signal.aborted) {
      if (handle.onAborted) handle.onAborted(e)
      throw e
    }

    if (handle.onError) handle.onError(e)
    throw e
  }
}
