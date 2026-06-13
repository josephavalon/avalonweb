export function safeErrorCode(err, fallback = 'server_error') {
  const code = err?.code || err?.type || err?.statusCode || err?.status || err?.name || fallback;
  return String(code).replace(/[^a-z0-9_:-]+/gi, '_').slice(0, 80) || fallback;
}

export function safeLogContext(err, fallback = 'server_error') {
  return {
    code: safeErrorCode(err, fallback),
    status: err?.statusCode || err?.status || null,
  };
}
