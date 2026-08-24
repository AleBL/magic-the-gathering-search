const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;
const MAX_RATE_LIMIT_RETRIES = 2;

// Scryfall asks for 50 to 100 ms between requests. 150 leaves room for a slow hop.
export const SCRYFALL_REQUEST_GAP_MS = 150;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * How long to wait after a 429. `headers.get` returns `null` for an absent header and
 * `Number(null)` is `0`, which is finite: reading the header without the `> 0` test accepted
 * that zero and retried instantly, so the fallback below never applied to the case it exists
 * for. Exported because that is the whole bug, and it is worth pinning in one assertion.
 */
export function retryDelayFor(header: string | null, fallbackMs: number = DEFAULT_RETRY_DELAY_MS): number {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackMs;
  return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
}

/**
 * Spaces out every Scryfall request one operation makes. Each loop that shares a pacer shares
 * one clock, so none of them has to remember to pace itself and the gaps hold across the
 * boundaries between them. Per operation rather than per module: a run never waits on the
 * previous one's clock, and tests stay independent of each other.
 */
export interface RequestPacer {
  gapMs: number;
  retryDelayMs: number;
  nextAllowedAt: number;
}

/** Pacing knobs. Tests set them to zero; nothing in the app overrides them. */
export interface PacingOptions {
  requestGapMs?: number;
  retryDelayMs?: number;
}

export const createPacer = ({
  requestGapMs = SCRYFALL_REQUEST_GAP_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS
}: PacingOptions = {}): RequestPacer => ({
  gapMs: requestGapMs,
  retryDelayMs,
  nextAllowedAt: 0
});

// The clock is stamped before the request, not after it: the calls are sequential, so a
// request that itself took longer than the gap has already provided the spacing and adding
// another pause on top of it would only make a slow operation slower.
export const pacedFetch = async (pacer: RequestPacer, url: string, init?: RequestInit): Promise<Response> => {
  const waitMs = pacer.nextAllowedAt - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  pacer.nextAllowedAt = Date.now() + pacer.gapMs;
  return fetch(url, init);
};

/** A paced request that also retries lightly on 429 (rate limit) before giving up. */
export const fetchWithRateLimitRetry = async (
  pacer: RequestPacer,
  url: string,
  init?: RequestInit
): Promise<Response> => {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await pacedFetch(pacer, url, init);
    if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) return response;
    await sleep(retryDelayFor(response.headers?.get?.('Retry-After') ?? null, pacer.retryDelayMs));
  }

  // Unreachable: the loop always returns within MAX_RATE_LIMIT_RETRIES + 1 iterations.
  throw new Error('ScryfallRateLimited');
};
