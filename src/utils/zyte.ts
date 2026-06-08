import { ScrapingError } from "../core/errors.js";

const ZYTE_API_URL = "https://api.zyte.com/v1/extract";

interface ZyteExtractRequest {
  url: string;
  httpResponseBody?: boolean;
  httpResponseHeaders?: boolean;
  browserHtml?: boolean;
  httpRequestMethod?: string;
  httpRequestText?: string;
  customHttpRequestHeaders?: Array<{ name: string; value: string }>;
}

interface ZyteExtractResponse {
  statusCode?: number;
  httpResponseBody?: string;
  httpResponseHeaders?: Array<{ name: string; value: string[] }>;
  browserHtml?: string;
}

function getZyteApiKey(): string | null {
  return process.env.ZYTE_API_KEY ?? null;
}

function getAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export function isZyteAvailable(): boolean {
  return getZyteApiKey() !== null;
}

async function callZyte(
  source: string,
  payload: ZyteExtractRequest,
): Promise<ZyteExtractResponse> {
  const apiKey = getZyteApiKey();
  if (!apiKey) {
    throw new ScrapingError(
      source,
      "ZYTE_API_KEY 환경변수가 설정되지 않았습니다.",
    );
  }

  const response = await fetch(ZYTE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(apiKey),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ScrapingError(
      source,
      `Zyte API 오류 (HTTP ${response.status}): ${errorText}`,
      response.status,
    );
  }

  return (await response.json()) as ZyteExtractResponse;
}

export async function zyteFetchHtml(
  url: string,
  source: string,
): Promise<string> {
  const response = await callZyte(source, {
    url,
    browserHtml: true,
  });

  if (!response.browserHtml) {
    throw new ScrapingError(source, "Zyte가 HTML을 반환하지 않았습니다.");
  }

  return response.browserHtml;
}

export async function zyteFetchRaw(
  url: string,
  source: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<string> {
  const response = await callZyte(source, {
    url,
    httpResponseBody: true,
    httpResponseHeaders: true,
    httpRequestMethod: options?.method,
    httpRequestText: options?.body,
    customHttpRequestHeaders: options?.headers
      ? Object.entries(options.headers).map(([name, value]) => ({ name, value }))
      : undefined,
  });

  if (!response.httpResponseBody) {
    throw new ScrapingError(source, "Zyte가 응답 본문을 반환하지 않았습니다.");
  }

  return Buffer.from(response.httpResponseBody, "base64").toString("utf-8");
}

export async function zyteFetchJson<T>(
  url: string,
  source: string,
  options?: { headers?: Record<string, string> },
): Promise<T> {
  const raw = await zyteFetchRaw(url, source, {
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
  });

  return JSON.parse(raw) as T;
}
