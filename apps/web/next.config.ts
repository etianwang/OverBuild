import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['dhtmlx-gantt'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
