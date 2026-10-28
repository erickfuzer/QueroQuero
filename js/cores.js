// Cores por altitude e do desenho, conforme o tema e o fundo do mapa
import { limitar } from './util.js';

// Escala de cores por altitude (pés), uma para cada fundo
// Escalas curtas e pouco saturadas, para o mapa não virar confete: do baixo (quente) ao alto (frio)
export const ESCALAS = {
  escuro: [
    [0, [226, 132, 96]], [10000, [214, 190, 112]], [20000, [128, 202, 150]],
    [30000, [104, 178, 214]], [40000, [160, 150, 222]], [45000, [160, 150, 222]],
  ],
  claro: [
    [0, [178, 78, 44]], [10000, [150, 112, 24]], [20000, [42, 122, 84]],
    [30000, [30, 98, 152]], [40000, [92, 64, 152]], [45000, [92, 64, 152]],
  ],
};
const COR_SOLO = { escuro: 'rgb(122, 140, 146)', claro: 'rgb(120, 122, 130)' };

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
  escuro: { contorno: 'rgba(0, 0, 0, 0.75)', halo: 'rgba(230, 165, 60, 0.95)', haloFundo: 'rgba(230, 165, 60, 0.14)', mouse: 'rgba(219, 229, 227, 0.1)',
            militar: 'rgba(230, 165, 60, 0.95)', texto: 'rgba(219, 229, 227, 0.9)', textoSuave: 'rgba(150, 172, 178, 0.9)', textoForte: '#f2c46e',
            textoFundo: 'rgba(14, 20, 22, 0.9)', icone: '#dbe5e3', aeroporto: '#dbe5e3', aeroportoFundo: 'rgba(14, 20, 22, 0.9)' },
  claro: { contorno: 'rgba(29, 43, 72, 0.6)', halo: 'rgba(168, 51, 111, 0.95)', haloFundo: 'rgba(168, 51, 111, 0.1)', mouse: 'rgba(29, 43, 72, 0.07)',
           militar: 'rgba(168, 51, 111, 0.95)', texto: 'rgba(29, 43, 72, 0.9)', textoSuave: 'rgba(95, 106, 126, 0.95)', textoForte: '#a8336f',
           textoFundo: 'rgba(247, 243, 232, 0.92)', icone: '#1d2b48', aeroporto: '#1d2b48', aeroportoFundo: 'rgba(247, 243, 232, 0.95)' },
};
