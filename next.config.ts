import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Enable DNS prefetching for performance
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent clickjacking (belt-and-suspenders with CSP frame-ancestors)
          { key: 'X-Frame-Options', value: 'DENY' },
          // XSS filter for legacy browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Don't leak full URL in Referer header cross-origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unused browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Force HTTPS for 1 year (only takes effect over HTTPS — Vercel handles this)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Content Security Policy
          // Note: unsafe-eval + unsafe-inline are required by Next.js/React in both dev and prod
          // with Turbopack. The primary XSS mitigation here is frame-ancestors, object-src 'none',
          // base-uri 'self', and restricting connect-src to known hosts.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://app.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              // blob: for local image previews; https: for Supabase Storage and external images
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Supabase (REST + realtime WS), PostHog analytics
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.posthog.com https://us.i.posthog.com",
              // No plugins, no embeds
              "object-src 'none'",
              "media-src 'none'",
              // Prevent <base> tag injection
              "base-uri 'self'",
              // Prevent framing by any external site
              "frame-ancestors 'none'",
              // Only allow forms to submit to self
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
