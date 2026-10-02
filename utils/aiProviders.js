const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const CURATED = {
  openrouter: [
    { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (Free)" },
    { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B (Free)" },
    { id: "google/gemma-2-9b-it:free", label: "Gemma 2 9B (Free)" },
    { id: "qwen/qwen-2.5-7b-instruct:free", label: "Qwen 2.5 7B (Free)" },
    { id: "microsoft/phi-3-mini-128k-instruct:free", label: "Phi-3 Mini 128K (Free)" },
  ],
  groq: [
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    { id: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
  nvidia: [
    { id: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
    { id: "meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
    { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { id: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B" },
    { id: "mistralai/mixtral-8x7b-instruct-v0.1", label: "Mixtral 8x7B" },
    { id: "microsoft/phi-3-mini-128k-instruct", label: "Phi-3 Mini" },
    { id: "google/gemma-2-9b-it", label: "Gemma 2 9B" },
  ],
  together: [
    { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", label: "Llama 3.1 8B Turbo" },
    { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", label: "Llama 3.1 70B Turbo" },
    { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B" },
    { id: "Qwen/Qwen2.5-7B-Instruct-Turbo", label: "Qwen 2.5 7B" },
  ],
};

export const AI_PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
  {
    id: "groq",
    name: "Groq",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    apiKeyEnv: "GROQ_API_KEY",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    modelsUrl: "https://integrate.api.nvidia.com/v1/models",
    // Legacy env name still supported: NVIDIA_API_KEY is the primary key.
    apiKeyEnv: "NVIDIA_API_KEY",
  },
  {
    id: "together",
    name: "Together AI",
    modelsUrl: "https://api.together.xyz/v1/models",
    apiKeyEnv: "TOGETHER_API_KEY",
  },
];

export function getCuratedModels(providerId) {
  return CURATED[providerId] ?? [];
}

function isChatModel(entry) {
  const id = String(entry?.id || entry?.name || "").toLowerCase();
  const type = String(entry?.type || entry?.object || "").toLowerCase();
  if (!id) return false;
  if (type && /embed|tts|image|whisper|audio|video|moderation/.test(type)) return false;
  if (/embed|tts|whisper|dall-e|stable-diffusion|text-to-image|image-gen/.test(id)) return false;
  return true;
}

function normalizeModels(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  return list
    .filter(isChatModel)
    .map((m) => ({ id: m.id || m.name, label: m.name || m.id }))
    .filter((m) => Boolean(m.id))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProviderModelsLive(provider, apiKey) {
  const res = await fetchWithTimeout(provider.modelsUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `${provider.name} returned ${res.status}`);
  }
  const data = await res.json();
  const rawList = data.data ?? data.models ?? data ?? [];
  const models = normalizeModels(rawList);
  if (models.length === 0) throw new Error(`No chat models found for ${provider.name}.`);
  return models;
}

export async function getProviderModels(providerId) {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    const err = new Error(`Unknown provider: ${providerId}`);
    err.statusCode = 404;
    throw err;
  }

  const cached = cache.get(providerId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

  const apiKey = process.env[provider.apiKeyEnv]?.trim();
  const curated = getCuratedModels(providerId);

  if (!apiKey) {
    const payload = {
      id: provider.id,
      name: provider.name,
      source: curated.length > 0 ? "curated" : "unavailable",
      models: curated,
      error: curated.length > 0 ? `${provider.apiKeyEnv} is not configured. Showing curated defaults.` : `${provider.apiKeyEnv} is not configured.`,
    };
    cache.set(providerId, { at: Date.now(), payload });
    return payload;
  }

  try {
    const models = await fetchProviderModelsLive(provider, apiKey);
    const payload = { id: provider.id, name: provider.name, source: "live", models };
    cache.set(providerId, { at: Date.now(), payload });
    return payload;
  } catch (error) {
    const payload = {
      id: provider.id,
      name: provider.name,
      source: curated.length > 0 ? "curated" : "unavailable",
      models: curated,
      error: error.message || `Could not fetch models from ${provider.name}.`,
    };
    cache.set(providerId, { at: Date.now(), payload });
    return payload;
  }
}

export async function getAllProviderModels() {
  const results = await Promise.all(AI_PROVIDERS.map((p) => getProviderModels(p.id)));
  return results;
}

export function clearProviderModelsCache(providerId) {
  if (providerId) cache.delete(providerId);
  else cache.clear();
}

// ── Server-side chat config (avoids browser CORS, keeps keys server-side) ──
const CHAT_DEFAULTS = {
  openrouter: "meta-llama/llama-3.1-8b-instruct:free",
  groq: "llama-3.1-8b-instant",
  nvidia: "meta/muse-glimmer-30b",
  together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
};

const CHAT_BASE_URLS = {
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  together: "https://api.together.xyz/v1",
};

export function resolveChatConfig(providerId, modelId) {
  const id = typeof providerId === "string" && providerId ? providerId : "nvidia";
  const provider = AI_PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    const err = new Error(`Unknown provider: ${id}`);
    err.statusCode = 400;
    throw err;
  }
  const apiKey = process.env[provider.apiKeyEnv]?.trim();
  if (!apiKey) {
    const err = new Error(`${provider.name} is not configured (${provider.apiKeyEnv} missing).`);
    err.statusCode = 503;
    throw err;
  }
  const baseURL =
    (id === "nvidia" && process.env.NVIDIA_BASE_URL?.trim()) || CHAT_BASE_URLS[id];
  const envModel =
    id === "nvidia"
      ? process.env.NVIDIA_MODEL?.trim()
      : id === "openrouter"
        ? process.env.OPENROUTER_MODEL?.trim()
        : id === "groq"
          ? process.env.GROQ_MODEL?.trim()
          : process.env.TOGETHER_MODEL?.trim();
  const model =
    typeof modelId === "string" && modelId.trim()
      ? modelId.trim().slice(0, 200)
      : envModel || CHAT_DEFAULTS[id];
  return { id, name: provider.name, apiKey, baseURL, model };
}
