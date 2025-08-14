import { createRequestHandler } from '@vercel/remix/server';

import * as build from '@remix-run/dev/server-build';

export default createRequestHandler({ build });
