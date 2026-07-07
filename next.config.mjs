// Applied to every response. A full Content-Security-Policy is not set here
// because Clerk, Stripe Checkout, and the Cloudinary upload widget each inject
// scripts/frames; adding one requires allowlisting their hosts and testing
// each flow. frame-ancestors is covered by X-Frame-Options below.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        // Only this app's Cloudinary account, not arbitrary Cloudinary users.
        pathname: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
          ? `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`
          : '/**',
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
