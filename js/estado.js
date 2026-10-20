// Estado dos aviões: posições, interpolação e recebimento dos dados
import { classificar } from './aeronaves.js';
import { CONFIG } from './config.js';
import { fecharPainel, selecionado } from './painel.js';
import { RAD, distanciaKm, limitar } from './util.js';

export const avioes = new Map();     // hex → dados do avião
export const EMERGENCIAS = { 7500: 'Interferência ilícita', 7600: 'Falha de rádio', 7700: 'Emergência' };

// Posição estimada pelo deslocamento desde o último dado (velocidade e rumo constantes)
function estimar(av, agora) {
  const dt = limitar((agora - av.t) / 1000, 0, 60);
  const d = av.gs * 0.514444 * dt;                 // nós → m/s × s
  const r = av.rumo * RAD;
  return {
    lat: av.lat + (d * Math.cos(r)) / 111320,
    lon: av.lon + (d * Math.sin(r)) / (111320 * Math.cos(av.lat * RAD)),
    ang: av.rumo,
  };
}

// Posição desenhada: a estimativa mais uma correção que some aos poucos,
// para o avião deslizar até o dado novo em vez de pular
export function posicaoExibida(av, agora) {
  const p = estimar(av, agora);
  const tr = av.transicao;
  if (tr) {
    const k = limitar((agora - tr.t0) / 1500, 0, 1);
    const resto = (1 - k) ** 3;
    p.lat += tr.dLat * resto;
    p.lon += tr.dLon * resto;
    p.ang += tr.dAng * resto;
    if (k >= 1) av.transicao = null;
  }
  return p;
}

export function receber(lista) {
  const agora = Date.now();
  for (const a of lista) {
    if (typeof a.lat !== 'number' || !a.hex) continue;
    const hex = a.hex.toLowerCase();
    const solo = a.alt_baro === 'ground';
    const alt = solo ? 0 : (typeof a.alt_baro === 'number' ? a.alt_baro : (typeof a.alt_geom === 'number' ? a.alt_geom : null));
    const t = agora - (a.seen_pos || 0) * 1000;

    let av = avioes.get(hex);
    const antes = av ? posicaoExibida(av, agora) : null;
    if (!av) {
      av = { hex, rastro: [], transicao: null };
      avioes.set(hex, av);
    }
    Object.assign(av, classificar(a), {
      indicativo: (a.flight || '').replace(/@/g, '').trim(),
      matricula: (a.r || '').trim(),
      tipo: a.t || '',
      descricao: a.desc || '',
      squawk: a.squawk || '',
      alt, solo,
      gs: a.gs || 0,
      rumo: a.track ?? a.true_heading ?? av.rumo ?? 0,
      vertical: a.baro_rate ?? a.geom_rate ?? null,
      lat: a.lat, lon: a.lon, t,
      visto: agora,
    });

    // Liga a posição antiga à nova suavemente (se o salto não for absurdo)
    if (antes) {
      const novo = estimar(av, agora);
      const dLat = antes.lat - novo.lat, dLon = antes.lon - novo.lon;
      if (Math.abs(dLat) < 0.2 && Math.abs(dLon) < 0.2) {
        av.transicao = { dLat, dLon, dAng: ((antes.ang - novo.ang + 540) % 360) - 180, t0: agora };
      }
    }

    const ultimo = av.rastro[av.rastro.length - 1];
    if (!ultimo || distanciaKm(ultimo[0], ultimo[1], a.lat, a.lon) > 0.1) {
      av.rastro.push([a.lat, a.lon, alt, solo]);
      if (av.rastro.length > CONFIG.pontosRastro) av.rastro.shift();
    }
  }

  // Esquece aviões sem notícia há muito tempo (o selecionado fica mais um pouco)
  for (const [hex, av] of avioes) {
    const limite = hex === selecionado ? 5 * 60000 : 2 * 60000;
    if (agora - av.visto > limite) avioes.delete(hex);
  }
  if (selecionado && !avioes.has(selecionado)) fecharPainel();
}

export const ativo = (av, agora) => agora - av.visto < CONFIG.tempoSumir;

export const nomeDoVoo = av => av.indicativo || av.matricula || av.hex.toUpperCase();
