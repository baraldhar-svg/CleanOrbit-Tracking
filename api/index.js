export default async function handler(req, res) {
  const mod = await import("../backend/dist/index.mjs");
  const app = mod.default || mod;
  return app(req, res);
}
