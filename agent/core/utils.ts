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
