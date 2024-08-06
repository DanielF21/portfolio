/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://scheme-interpreter.onrender.com/:path*',
      },
    ];
  },
};
export default nextConfig;
