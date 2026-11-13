import { loadEnv, type Plugin } from 'vite';

// Serves the Vercel function api/admin/users.ts from the Vite dev server, so admin
// user management works with `npm run dev`. Dev only; in production Vercel runs the function.
// Server-side variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are read from .env into
// process.env for the dev server only; they are never exposed to the browser bundle.
const ROUTES: Record<string, string> = {
  '/api/admin/users': '/api/admin/users.ts',
};

export function devApi(): Plugin {
  return {
    name: 'sleepwalker-dev-api',
    apply: 'serve',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const modulePath = ROUTES[url.pathname];
        if (!modulePath) return next();

        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          const body = raw ? JSON.parse(raw) : undefined;

          const { default: handler } = await server.ssrLoadModule(modulePath);
          const response = {
            status(code: number) {
              res.statusCode = code;
              return response;
            },
            json(data: unknown) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            setHeader(name: string, value: string) {
              res.setHeader(name, value);
            },
            end() {
              res.end();
            },
          };
          await handler(
            { method: req.method, query: Object.fromEntries(url.searchParams), body, headers: req.headers },
            response,
          );
        } catch (error) {
          server.config.logger.error(`[dev-api] ${String(error)}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Dev API error' }));
        }
      });
    },
  };
}
