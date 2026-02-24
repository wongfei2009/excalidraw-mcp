export function createDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger: (...args: TArgs) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        callback(...args);
      }, delayMs);
    },
    cancel: () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    },
  };
}
