// ============================================================
// Debug logging (routes through SDK → host log file)
// ============================================================

let _logFn: ((msg: string) => void) | null = null;

export function fsLog(msg: string) {
  if (_logFn) _logFn(msg);
}

export function setLogFn(fn: (msg: string) => void) {
  _logFn = fn;
}
