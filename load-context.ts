import { type PlatformProxy } from 'wrangler';

type Cloudflare = Omit<PlatformProxy<Env>, 'dispose'>;

declare module '@remix-run/vercel' {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}
