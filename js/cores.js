// Cores por altitude e do desenho, conforme o tema e o fundo do mapa
import { limitar } from './util.js';

// Escala de cores por altitude (pés), uma para cada fundo
export const ESCALAS = {
  escuro: [
    [0, [255, 107, 74]], [5000, [255, 162, 58]], [10000, [255, 216, 74]], [20000, [126, 224, 108]],
    [30000, [63, 208, 224]], [40000, [138, 125, 255]], [45000, [199, 125, 255]],
  ],
  claro: [
    [0, [232, 89, 12]], [5000, [240, 140, 0]], [10000, [214, 168, 0]], [20000, [47, 158, 68]],
    [30000, [16, 152, 173]], [40000, [95, 61, 196]], [45000, [156, 54, 181]],
  ],
};
const COR_SOLO = { escuro: 'rgb(125, 133, 144)', claro: 'rgb(120, 128, 140)' };

export let tema = document.documentElement.getAttribute('data-tema') || 'escuro';   // tema da interface
export let paleta = tema;                                                          // cores do desenho, conforme o fundo do mapa
export function definirTema(t) { tema = t; }
export function definirPaleta(p) { paleta = p; }

export function corAltitude(alt, solo) {
  if (solo) return COR_SOLO[paleta];
  if (alt == null) return paleta === 'escuro' ? 'rgb(200, 200, 200)' : 'rgb(110, 110, 110)';
  const escala = ESCALAS[paleta];
  for (let i = 1; i < escala.length; i++) {
    const [a1, c1] = escala[i - 1], [a2, c2] = escala[i];
    if (alt <= a2) {
      const k = limitar((alt - a1) / (a2 - a1), 0, 1);
      return `rgb(${c1.map((c, j) => Math.round(c + (c2[j] - c) * k)).join(', ')})`;
    }
  }
  return `rgb(${escala[escala.length - 1][1].join(', ')})`;
}

// Cores do desenho no canvas que mudam com o tema
export const TINTAS = {
  escuro: { contorno: 'rgba(0, 0, 0, 0.7)', halo: 'rgba(224, 87, 77, 0.95)', haloFundo: 'rgba(224, 87, 77, 0.16)', mouse: 'rgba(255, 255, 255, 0.1)',
            militar: 'rgba(255, 255, 255, 0.95)', texto: 'rgba(232, 230, 225, 0.88)', textoForte: '#ffffff', textoFundo: 'rgba(21, 24, 28, 0.9)', icone: '#e8e6e1' },
  claro: { contorno: 'rgba(0, 0, 0, 0.55)', halo: 'rgba(200, 56, 47, 0.95)', haloFundo: 'rgba(200, 56, 47, 0.1)', mouse: 'rgba(28, 31, 35, 0.07)',
           militar: 'rgba(28, 31, 35, 0.95)', texto: 'rgba(28, 31, 35, 0.85)', textoForte: '#1c1f23', textoFundo: 'rgba(255, 255, 255, 0.92)', icone: '#1c1f23' },
};
TINTAS.escuro.aeroporto = '#e8e6e1'; TINTAS.escuro.aeroportoFundo = 'rgba(21, 24, 28, 0.9)';
TINTAS.claro.aeroporto = '#1c1f23'; TINTAS.claro.aeroportoFundo = 'rgba(255, 255, 255, 0.95)';
