import path from 'path';
import { existsSync } from 'fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Resolve @/ee to the real EE submodule when present, otherwise fall back to CE stubs.
const eeIndex    = path.resolve(__dirname, 'src/ee/index.ts');
const eeFallback = path.resolve(__dirname, 'src/ee-fallback.ts');
const eeEntry    = existsSync(eeIndex) ? path.dirname(eeIndex) : eeFallback;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack(config) {
    config.resolve.alias['@/ee'] = eeEntry;
    return config;
  },
};

export default nextConfig;
