/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: ''
      }
    ]
  },
  webpack: (config) => {
    // Clerk v4 statically pulls react-dom/scheduler into the Edge middleware
    // bundle; those code paths never run on Edge, so the warnings are false
    // positives. Scoped to node_modules so warnings in app code still show.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules[\\/](scheduler|@clerk)[\\/]/,
        message: /not supported in the Edge Runtime/
      }
    ];
    return config;
  }
};

export default nextConfig;