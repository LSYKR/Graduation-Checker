export type Environment = ReturnType<typeof loadEnvironment>;
function localLLMOrigin(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("LLM base URL must be an HTTP(S) origin");
  const host = url.hostname.toLowerCase();
  const localHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "host.docker.internal" || host === "kmou-qwen-4b" || host === "kmou-qwen-8b" || /^(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/.test(host);
  if (!localHost || url.protocol !== "http:") throw new Error("LLM endpoint must be a local HTTP service");
  return value;
}
function integer(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error("Invalid numeric environment configuration");
  return parsed;
}
export function loadEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const provider = env.LLM_PROVIDER ?? (env.LOCAL_LLM_BASE_URL ? env.LOCAL_LLM_STYLE ?? "ollama" : "disabled");
  if (!["disabled", "ollama", "openai-compatible", "mock"].includes(provider)) throw new Error("Invalid LLM_PROVIDER");
  const baseUrl = (env.LLM_BASE_URL ?? env.LOCAL_LLM_BASE_URL ?? "").replace(/\/$/, "");
  if (["ollama", "openai-compatible"].includes(provider)) localLLMOrigin(baseUrl);
  if (env.ADMIN_API_TOKEN && env.ADMIN_API_TOKEN.length < 32) throw new Error("ADMIN_API_TOKEN must have at least 32 characters");
  if (env.APP_ORIGIN) { const url = new URL(env.APP_ORIGIN); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== env.APP_ORIGIN) throw new Error("APP_ORIGIN must be an HTTP(S) origin"); }
  const largeModel = env.LLM_LARGE_MODEL?.trim() || null;
  if (largeModel && (provider === "disabled" || provider === "mock")) throw new Error("LLM_LARGE_MODEL requires a local LLM provider");
  const largeBaseUrl = (env.LLM_LARGE_BASE_URL?.trim() || baseUrl).replace(/\/$/, "");
  if (env.LLM_LARGE_BASE_URL?.trim()) localLLMOrigin(largeBaseUrl);
  return {provider: provider as "disabled" | "ollama" | "openai-compatible" | "mock",baseUrl,largeBaseUrl,model:env.LLM_MODEL ?? env.LOCAL_LLM_MODEL ?? "qwen3:8b",largeModel,apiKey:env.LLM_API_KEY ?? env.LOCAL_LLM_API_KEY,timeoutMs:integer(env.LLM_TIMEOUT_MS ?? env.LOCAL_LLM_TIMEOUT_MS,10000,100,60000),retries:integer(env.LLM_RETRIES,1,0,2),contextTokens:integer(env.LLM_CONTEXT_TOKENS,8192,256,32768),outputTokens:integer(env.LLM_OUTPUT_TOKENS,512,32,4096)};
}
