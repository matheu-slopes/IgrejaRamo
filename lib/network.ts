export class RequestTimeoutError extends Error {
  constructor(message = "A conexão demorou demais. Verifique a internet e tente novamente.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

/** Fetch com limite de tempo para a interface nunca ficar presa em carregamento. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  const timer = setTimeout(() => controller.abort(new RequestTimeoutError()), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}
