/** Limits the whole operation, including session lookup and response parsing. */
export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("A pesquisa demorou demais. Tente novamente ou cole o link do vídeo.");
      error.name = "TimeoutError";
      controller.abort(error);
      reject(error);
    }, milliseconds);
  });
  try {
    return await Promise.race([deadline, operation(controller.signal)]);
  } finally {
    clearTimeout(timer);
  }
}
