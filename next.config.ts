import type { NextConfig } from "next";
const development = process.env.NODE_ENV === "development";
const csp = ["default-src 'self'", development ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", development ? "connect-src 'self' ws: wss:" : "connect-src 'self'", "font-src 'self' data:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"].join("; ");
const nextConfig: NextConfig = {
  output: "standalone", poweredByHeader: false,
  experimental: { cpus: 1 },
  async headers() { return [{ source: "/:path*", headers: [
    {key:"X-Content-Type-Options",value:"nosniff"}, {key:"X-Frame-Options",value:"DENY"},
    {key:"Referrer-Policy",value:"no-referrer"}, {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
    {key:"Content-Security-Policy",value:csp},
  ] }]; },
};
export default nextConfig;
