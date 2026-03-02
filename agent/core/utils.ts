export async function withRetry<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<(...args: A) => Promise<T>> {
  return async (...args: A) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(...args)
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    throw new Error('Unreachable')
  }
}
