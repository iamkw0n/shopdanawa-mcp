import { decode } from "iconv-lite";
import { ScrapingError } from "../core/errors.js";
import { isZyteAvailable, zyteFetchHtml, zyteFetchJson } from "./zyte.js";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
];

type SourceKey = "danawa" | "default";

interface BlockState {
  blockedUntil: number;
  backoffMs: number;
}

interface ZyteModeState {
  active: boolean;
  directFailCount: number;
}

export interface FetchOptions {
  headers?: Record<string, string>;
  retries?: number;
  noProxy?: boolean;
  encoding?: string;
}

export interface FormRequestOptions extends FetchOptions {
  method?: "GET" | "POST";
  body?: URLSearchParams | string;
}

export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];
  private lastRequestTime = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly minIntervalMs: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minIntervalMs - elapsed),
      );
    }

    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.running += 1;
    this.lastRequestTime = Date.now();
  }

  private release(): void {
    this.running -= 1;
    const next = this.queue.shift();
    next?.();
  }
}

const limiters: Record<SourceKey, ConcurrencyLimiter> = {
  danawa: new ConcurrencyLimiter(3, 500),
  default: new ConcurrencyLimiter(2, 1000),
};

const blockStatus: Record<string, BlockState | undefined> = {};
const zyteMode: Record<string, ZyteModeState | undefined> = {};

function getLimiter(source: string): ConcurrencyLimiter {
  if (source === "danawa") {
    return limiters.danawa;
  }

  return limiters.default;
}

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function isBlocked(source: string): boolean {
  const status = blockStatus[source];
  return Boolean(status && Date.now() < status.blockedUntil);
}

function markBlocked(source: string, statusCode?: number): void {
  if (statusCode !== 403 && statusCode !== 429) {
    return;
  }

  const current = blockStatus[source];
  const backoffMs = current
    ? Math.min(current.backoffMs * 2, 300_000)
    : 30_000;

  blockStatus[source] = {
    blockedUntil: Date.now() + backoffMs,
    backoffMs,
  };
}

function clearBlocked(source: string): void {
  delete blockStatus[source];
}

function shouldUseZyte(source: string): boolean {
  if (!isZyteAvailable()) {
    return false;
  }

  if (isBlocked(source)) {
    return true;
  }

  return zyteMode[source]?.active ?? false;
}

function recordDirectSuccess(source: string): void {
  clearBlocked(source);
  zyteMode[source] = {
    active: false,
    directFailCount: 0,
  };
}

function recordDirectFailure(source: string, statusCode?: number): void {
  markBlocked(source, statusCode);

  const current = zyteMode[source] ?? {
    active: false,
    directFailCount: 0,
  };

  current.directFailCount += 1;
  if (current.directFailCount >= 3) {
    current.active = true;
  }

  zyteMode[source] = current;
}

async function getResponseText(
  response: Response,
  encoding?: string,
): Promise<string> {
  if (!encoding || encoding.toLowerCase() === "utf-8") {
    return response.text();
  }

  const buffer = await response.arrayBuffer();
  return decode(Buffer.from(buffer), encoding);
}

async function runTextRequest(
  url: string,
  source: string,
  options?: FormRequestOptions,
): Promise<string> {
  const retries = options?.retries ?? 2;
  const limiter = getLimiter(source);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await limiter.run(() =>
        fetch(url, {
          method: options?.method ?? "GET",
          headers: {
            "User-Agent": getRandomUserAgent(),
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            ...options?.headers,
          },
          body: options?.body,
        }),
      );

      if (response.status === 403 || response.status === 429) {
        recordDirectFailure(source, response.status);
        throw new ScrapingError(
          source,
          `HTTP ${response.status}: 요청이 차단되었습니다.`,
          response.status,
        );
      }

      if (!response.ok) {
        throw new ScrapingError(
          source,
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      recordDirectSuccess(source);
      return getResponseText(response, options?.encoding);
    } catch (error) {
      if (
        error instanceof ScrapingError &&
        (error.statusCode === 403 || error.statusCode === 429)
      ) {
        throw error;
      }

      if (attempt === retries) {
        if (error instanceof ScrapingError) {
          throw error;
        }

        throw new ScrapingError(
          source,
          `요청 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const delay = Math.min(1000 * 2 ** attempt, 10_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new ScrapingError(source, "최대 재시도 횟수를 초과했습니다.");
}

export async function fetchHtml(
  url: string,
  source: string,
  options?: FetchOptions,
): Promise<string> {
  if (!options?.noProxy && shouldUseZyte(source)) {
    return zyteFetchHtml(url, source);
  }
  try {
    return await runTextRequest(url, source, options);
  } catch (error) {
    if (!options?.noProxy && isZyteAvailable()) {
      recordDirectFailure(
        source,
        error instanceof ScrapingError ? error.statusCode : undefined,
      );
      return zyteFetchHtml(url, source);
    }

    throw error;
  }
}

export async function submitForm(
  url: string,
  source: string,
  form: URLSearchParams,
  options?: FetchOptions,
): Promise<string> {
  return runTextRequest(url, source, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: new URL(url).origin,
      ...options?.headers,
    },
    body: form,
  });
}

export async function fetchJson<T>(
  url: string,
  source: string,
  options?: FetchOptions,
): Promise<T> {
  if (!options?.noProxy && shouldUseZyte(source)) {
    return zyteFetchJson<T>(url, source, { headers: options?.headers });
  }

  const limiter = getLimiter(source);
  const response = await limiter.run(() =>
    fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "application/json, text/javascript, */*;q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        ...options?.headers,
      },
    }),
  );

  if (response.status === 403 || response.status === 429) {
    recordDirectFailure(source, response.status);

    if (!options?.noProxy && isZyteAvailable()) {
      return zyteFetchJson<T>(url, source, { headers: options?.headers });
    }

    throw new ScrapingError(
      source,
      `HTTP ${response.status}: 요청이 차단되었습니다.`,
      response.status,
    );
  }

  if (!response.ok) {
    throw new ScrapingError(
      source,
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
    );
  }

  recordDirectSuccess(source);
  return (await response.json()) as T;
}

export function getProxyStatus(): Record<
  string,
  { blocked: boolean; zyteActive: boolean; failCount: number }
> {
  const sources = new Set(["danawa", ...Object.keys(blockStatus), ...Object.keys(zyteMode)]);
  const result: Record<
    string,
    { blocked: boolean; zyteActive: boolean; failCount: number }
  > = {};

  for (const source of sources) {
    result[source] = {
      blocked: isBlocked(source),
      zyteActive: zyteMode[source]?.active ?? false,
      failCount: zyteMode[source]?.directFailCount ?? 0,
    };
  }

  return result;
}
