/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://scheme-interpreter.onrender.com/:path*',
      },
      {
        source: '/spotify-insights/:path*',
        destination: 'https://spotify-6ppuwxweq-danielf21s-projects.vercel.app/spotify-insights/:path*',
      },
    ];
  },
};

module.exports = nextConfig;