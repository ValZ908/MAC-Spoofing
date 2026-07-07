/**
 * Retries an async operation that may transiently fail — e.g. a Supabase
 * request made right after restarting the network adapter carrying that
 * connection, which briefly drops connectivity while it reconnects.
 */
export async function withRetry<T>(
  fn: () => PromiseLike<T>,
  attempts = 4,
  delayMs = 1500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}
