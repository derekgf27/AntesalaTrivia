const REST_URL_KEYS = ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"] as const;
const REST_TOKEN_KEYS = ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"] as const;
const PROTOCOL_URL_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "UPSTASH_REDIS_URL",
  "KV_URL",
  "REDIS_URL",
] as const;

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_URL",
  "KV_URL",
  "REDIS_URL",
] as const;

export type RedisCredentials = {
  url: string;
  token: string;
};

export function cleanEnv(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function decodePassword(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function httpCredentials(
  url: string,
  token: string,
): RedisCredentials | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname) return null;
  const embedded = decodePassword(parsed.password || "");
  const resolvedToken = embedded || token;
  if (!resolvedToken) return null;
  return {
    url: `${parsed.protocol}//${parsed.host}`,
    token: resolvedToken,
  };
}

function protocolCredentials(
  url: string,
  token: string,
): RedisCredentials | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") return null;
  if (!parsed.hostname) return null;
  const embedded = decodePassword(parsed.password || "");
  const resolvedToken = embedded || token;
  if (!resolvedToken) return null;
  return {
    url: `https://${parsed.hostname}`,
    token: resolvedToken,
  };
}

/**
 * Upstash's HTTP client only speaks https. Vercel also injects the TCP URL
 * (`rediss://…`) and the older KV REST names. Prefer a real REST URL, and
 * otherwise derive one from the TCP connection string.
 */
export function resolveRedisCredentials(
  env: NodeJS.ProcessEnv = process.env,
): RedisCredentials | null {
  const restUrls = REST_URL_KEYS.map((key) => cleanEnv(env[key]));
  const tokens = REST_TOKEN_KEYS.map((key) => cleanEnv(env[key]));
  const fallbackToken = tokens.find(Boolean) ?? "";

  for (const url of restUrls) {
    for (const token of tokens) {
      const creds = httpCredentials(url, token);
      if (creds) return creds;
    }
  }

  for (const key of PROTOCOL_URL_KEYS) {
    const creds = protocolCredentials(cleanEnv(env[key]), fallbackToken);
    if (creds) return creds;
  }

  return null;
}

export function hasRedisEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return ENV_KEYS.some((key) => cleanEnv(env[key]).length > 0);
}

export const REDIS_URL_HELP =
  "Redis environment variables are set, but none is a usable REST endpoint. Set UPSTASH_REDIS_REST_URL to the https://….upstash.io URL (not the rediss:// connection string) and set the REST token, then redeploy.";

function causeChain(error: Error): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    const code =
      "code" in current && typeof current.code === "string" ? current.code : "";
    const message = current.message.trim();
    const bit = code && !message.includes(code) ? `${message} (${code})` : message;
    if (bit && !parts.includes(bit)) parts.push(bit);
    current = current.cause;
  }
  return parts.join(": ");
}

/** Turn undici's bare "fetch failed" into the reason the host screen can show. */
export function publicErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Request failed";
  if (/^Upstash Redis client was passed an invalid URL/.test(error.message)) {
    return error.message;
  }
  if (error.message === REDIS_URL_HELP || error.message.startsWith("Could not reach Upstash Redis")) {
    return error.message;
  }
  const network =
    (error instanceof TypeError && /fetch failed|failed to fetch/i.test(error.message)) ||
    /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|certificate|UNABLE_TO_VERIFY|UND_ERR/i.test(
      causeChain(error),
    );
  if (!network) return error.message;
  const detail = causeChain(error);
  return `Could not reach Upstash Redis (${detail}). Set UPSTASH_REDIS_REST_URL to the https REST URL, not the rediss:// connection string, then redeploy.`;
}
