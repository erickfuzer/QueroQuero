// Proxy do Quero-Quero para o Cloudflare Workers (plano gratuito).
//
// Por que existe: OpenSky, adsb.lol, airplanes.live e adsb.fi não liberam CORS,
// então o navegador bloqueia a leitura direta a partir do GitHub Pages.
// Este Worker faz a consulta do lado do servidor, devolve só os campos que o
// app usa e acrescenta os cabeçalhos de CORS para as origens permitidas.
//
// Rotas:
//   /voos?lat=-29.7&lon=-53.7&raio=120   aeronaves num raio (milhas náuticas, até 250)
//   /rota?indicativo=TAM3300             origem e destino cadastrados no adsbdb

// Origens que podem usar o proxy ("null" é o index.html aberto direto do disco)
const ORIGENS = [
  'https://erickfuzer.github.io',
  'null',
];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Serviços tentados em ordem: se um falhar ou pedir pausa, vai para o próximo
const FONTES = [
  { nome: 'adsb.fi', url: (lat, lon, r) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${r}` },
  { nome: 'airplanes.live', url: (lat, lon, r) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${r}` },
  { nome: 'adsb.lol', url: (lat, lon, r) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${r}` },
];

// Campos repassados ao app (o resto é descartado para economizar banda)
const CAMPOS = ['hex', 'flight', 'r', 't', 'desc', 'category', 'alt_baro', 'alt_geom', 'gs', 'track',
  'true_heading', 'baro_rate', 'geom_rate', 'squawk', 'lat', 'lon', 'seen_pos', 'seen', 'dbFlags'];

export default {
  async fetch(req, env, ctx) {
    const origem = req.headers.get('Origin');
    if (!origem || !(ORIGENS.includes(origem) || LOCAL.test(origem))) {
      return new Response('Origem não permitida', { status: 403 });
    }
    const cors = {
      'Access-Control-Allow-Origin': origem,
      'Access-Control-Expose-Headers': 'Retry-After, X-Fonte',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET') return new Response('Método não permitido', { status: 405, headers: cors });

    const url = new URL(req.url);
    try {
      if (url.pathname.endsWith('/voos')) return await voos(url, cors, ctx);
      if (url.pathname.endsWith('/rota')) return await rota(url, cors, ctx);
    } catch (e) {
      return json({ erro: 'falha interna' }, 502, cors);
    }
    return json({ erro: 'rota inexistente' }, 404, cors);
  },
};

async function voos(url, cors, ctx) {
  // Arredonda o pedido para que usuários vendo a mesma região dividam o cache
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const raio = Math.round(Number(url.searchParams.get('raio')));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !(raio > 0)) {
    return json({ erro: 'parâmetros inválidos' }, 400, cors);
  }
  const la = lat.toFixed(2), lo = lon.toFixed(2), r = Math.min(raio, 250);
  const chave = new Request(`https://cache.queroquero/voos/${la}/${lo}/${r}`);

  const emCache = await lerCache(chave);
  if (emCache) return comCors(emCache, cors);

  let pausa = 0;
  for (const fonte of FONTES) {
    let resp;
    try {
      resp = await fetch(fonte.url(la, lo, r), { headers: { 'User-Agent': 'QueroQuero (github.com/erickfuzer/QueroQuero)' } });
    } catch (e) {
      continue;
    }
    if (resp.status === 429) {
      pausa = Math.max(pausa, Number(resp.headers.get('Retry-After')) || 10);
      continue;
    }
    if (!resp.ok) continue;

    const dados = await resp.json().catch(() => null);
    const lista = dados && (dados.ac || dados.aircraft);
    if (!Array.isArray(lista)) continue;

    const ac = lista.filter(a => typeof a.lat === 'number').map(a => {
      const o = {};
      for (const c of CAMPOS) if (a[c] !== undefined) o[c] = a[c];
      return o;
    });
    const saida = json({ fonte: fonte.nome, ac }, 200, { 'Cache-Control': 'public, max-age=5', 'X-Fonte': fonte.nome });
    gravarCache(ctx, chave, saida.clone());
    return comCors(saida, cors);
  }

  if (pausa) return json({ erro: 'limite atingido' }, 429, { ...cors, 'Retry-After': String(pausa) });
  return json({ erro: 'nenhuma fonte respondeu' }, 502, cors);
}

async function rota(url, cors, ctx) {
  const indicativo = (url.searchParams.get('indicativo') || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(indicativo)) return json({ erro: 'indicativo inválido' }, 400, cors);
  const chave = new Request(`https://cache.queroquero/rota/${indicativo}`);

  const emCache = await lerCache(chave);
  if (emCache) return comCors(emCache, cors);

  const resp = await fetch(`https://api.adsbdb.com/v0/callsign/${indicativo}`);
  // 404 significa "rota desconhecida": responde 200 com rota nula para o app não registrar erro
  if (resp.status === 404) {
    const saida = json({ rota: null }, 200, { 'Cache-Control': 'public, max-age=3600' });
    gravarCache(ctx, chave, saida.clone());
    return comCors(saida, cors);
  }
  if (resp.status === 429) return json({ erro: 'limite atingido' }, 429, { ...cors, 'Retry-After': '30' });
  if (!resp.ok) return json({ erro: 'adsbdb indisponível' }, 502, cors);

  const fr = (await resp.json()).response?.flightroute;
  const aeroporto = a => a && {
    iata: a.iata_code, icao: a.icao_code, nome: a.name, cidade: a.municipality,
    pais: a.country_iso_name, lat: a.latitude, lon: a.longitude,
  };
  const saida = json({
    rota: fr ? {
      companhia: fr.airline?.name || null,
      origem: aeroporto(fr.origin),
      destino: aeroporto(fr.destination),
    } : null,
  }, 200, { 'Cache-Control': 'public, max-age=3600' });
  gravarCache(ctx, chave, saida.clone());
  return comCors(saida, cors);
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function json(obj, status, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function comCors(resp, cors) {
  const r = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
  return r;
}

// Cache da borda da Cloudflare. Só tem efeito com domínio próprio (no workers.dev
// a gravação é ignorada) e não existe fora da Cloudflare, por isso o teste.
async function lerCache(chave) {
  return typeof caches !== 'undefined' ? caches.default.match(chave) : null;
}

function gravarCache(ctx, chave, resp) {
  if (typeof caches !== 'undefined' && ctx) ctx.waitUntil(caches.default.put(chave, resp));
}
