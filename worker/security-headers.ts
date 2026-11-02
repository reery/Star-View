// Shared by vite.config.ts (static assets via _headers) and the Worker's object pages.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
].join('; ')

// Meta policies ignore frame-ancestors, so only response headers carry it.
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}
export const HTTPS_ONLY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}
