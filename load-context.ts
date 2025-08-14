import { type PlatformProxy } from 'wrangler';

type Cloudflare = Omit<PlatformProxy<Env>, 'dispose'>;

declare module '@vercel/remix' {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}
