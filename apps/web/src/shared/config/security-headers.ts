interface Header {
  key: string;
  value: string;
}

function contentSecurityPolicy(isDevelopment: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", ...(isDevelopment ? ["'unsafe-inline'"] : [])],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(isDevelopment ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(isDevelopment: boolean): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDevelopment) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
}
