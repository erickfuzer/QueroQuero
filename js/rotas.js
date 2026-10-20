// Rotas pelo adsbdb, com cache no navegador
import { nomesCompanhia } from './companhias.js';
import { CONFIG, PROXY } from './config.js';
import { posicaoExibida } from './estado.js';
import { distanciaKm, guardado, limitar } from './util.js';

export const rotas = new Map(); // indicativo → rota | null | Promise
// Rotas já consultadas ficam guardadas no navegador por um dia (as "sem rota", por 6 h),
// para não repetir pedidos ao proxy a cada visita
const rotasGuardadas = (() => {
  try { return JSON.parse(guardado.ler('qq-rotas') || '{}') || {}; } catch (e) { return {}; }
})();
for (const [cs, { r, t }] of Object.entries(rotasGuardadas)) {
  if (Date.now() - t > (r ? CONFIG.validadeRota : CONFIG.validadeRota / 4)) { delete rotasGuardadas[cs]; continue; }
  rotas.set(cs, r);
  if (r && r.companhia) nomesCompanhia.set(cs.slice(0, 3), r.companhia);
}
// Grava no máximo uma vez por segundo, e de novo ao sair da página
let gravacaoRotas = null;
function gravarRotas() {
  clearTimeout(gravacaoRotas);
  gravacaoRotas = null;
  const recentes = Object.entries(rotasGuardadas).sort((a, b) => b[1].t - a[1].t).slice(0, 400);
  guardado.gravar('qq-rotas', JSON.stringify(Object.fromEntries(recentes)));
}
function guardarRota(cs, rota) {
  rotasGuardadas[cs] = { r: rota, t: Date.now() };
  if (!gravacaoRotas) gravacaoRotas = setTimeout(gravarRotas, 1000);
}
window.addEventListener('pagehide', () => { if (gravacaoRotas) gravarRotas(); });

// Rota pelo adsbdb (via proxy). Só para indicativos de companhia (ex.: GLO1234).
export const ehIndicativoDeCompanhia = cs => /^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test(cs);

export function buscarRota(cs) {
  const atual = rotas.get(cs);
  if (atual !== undefined) return Promise.resolve(atual);
  const pedido = fetch(`${PROXY}/rota?indicativo=${encodeURIComponent(cs)}`)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(d => {
      rotas.set(cs, d.rota);
      guardarRota(cs, d.rota);
      if (d.rota && d.rota.companhia) nomesCompanhia.set(cs.slice(0, 3), d.rota.companhia);
      return d.rota;
    })
    .catch(() => { rotas.delete(cs); return null; });
  rotas.set(cs, pedido);
  return pedido;
}

// A base de rotas é colaborativa e às vezes está velha: só vale se a posição do avião confere
export function rotaConfere(av, rota) {
  if (!rota || rota instanceof Promise || !rota.origem || !rota.destino) return null;
  const { origem: o, destino: d } = rota;
  const pos = posicaoExibida(av, Date.now());
  const total = distanciaKm(o.lat, o.lon, d.lat, d.lon);
  const feito = distanciaKm(o.lat, o.lon, pos.lat, pos.lon);
  const falta = distanciaKm(pos.lat, pos.lon, d.lat, d.lon);
  if (feito + falta > total * 1.3 + 100) return null;
  return { feito, falta, fracao: limitar(feito / (feito + falta), 0, 1) };
}
