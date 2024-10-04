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
        destination: 'https://spotify-app-six-rosy.vercel.app/spotify-insights/:path*',
      },
    ];
  },
};

export default nextConfig;
