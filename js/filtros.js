// Filtros por tipo, situação, companhia e altitude
import { GRUPOS, iconeForma } from './aeronaves.js';
import { nomeCompanhia, prefixo } from './companhias.js';
import { ALT_SEM_LIMITE } from './config.js';
import { TINTAS, tema } from './cores.js';
import { atualizarStatus } from './dados.js';
import { EMERGENCIAS, ativo, avioes } from './estado.js';
import { fecharPainel, selecionado } from './painel.js';
import { emAltitude } from './prefs.js';
import { $ } from './util.js';

export let altMin = 0, altMax = ALT_SEM_LIMITE;
export const gruposOcultos = new Set();
export let situacao = 'todos';          // todos, ar ou solo
export let soEmergencia = false;
export const companhiasSel = new Set(); // prefixos ICAO marcados (vazio = todas)

export function passaFiltro(av) {
  if (gruposOcultos.has(av.grupo)) return false;
  if (situacao === 'ar' && av.solo) return false;
  if (situacao === 'solo' && !av.solo) return false;
  if (soEmergencia && !EMERGENCIAS[av.squawk]) return false;
  if (companhiasSel.size && !companhiasSel.has(prefixo(av))) return false;
  const alt = av.solo ? 0 : av.alt;
  if (alt == null) return altMin === 0;
  return alt >= altMin && (altMax >= ALT_SEM_LIMITE || alt <= altMax);
}

// Filtro por tipo: um botão por grupo, com o ícone do grupo
export function montarTipos() {
  const cor = TINTAS[tema].icone;
  $('tipos').replaceChildren(...GRUPOS.map(g => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tipo';
    b.setAttribute('aria-pressed', String(!gruposOcultos.has(g.id)));
    b.append(iconeForma(g.forma, cor), Object.assign(document.createElement('span'), { textContent: g.nome }));
    b.addEventListener('click', () => {
      if (gruposOcultos.has(g.id)) gruposOcultos.delete(g.id); else gruposOcultos.add(g.id);
      b.setAttribute('aria-pressed', String(!gruposOcultos.has(g.id)));
      filtrosMudaram();
    });
    return b;
  }));
}

const entradaMin = $('alt-min');
const entradaMax = $('alt-max');

export function definirAltitude(min, max) {
  altMin = min;
  altMax = max;
  entradaMin.value = min;
  entradaMax.value = max;
  $('min-saida').textContent = min === 0 ? 'solo' : emAltitude(min)[0];
  $('max-saida').textContent = max >= ALT_SEM_LIMITE ? 'sem limite' : emAltitude(max)[0];
  filtrosMudaram();
}

// Atalhos: "só um grupo" esconde todos os outros; Emergências mostra só squawk 7500/7600/7700
const soGrupo = id => gruposOcultos.size === GRUPOS.length - 1 && !gruposOcultos.has(id);
document.querySelectorAll('.atalho-filtro').forEach(b => b.addEventListener('click', () => {
  const atalho = b.dataset.atalho;
  if (atalho === 'emergencias') soEmergencia = !soEmergencia;
  else {
    const id = atalho === 'militares' ? 'militar' : 'helicoptero';
    const ligar = !soGrupo(id);
    gruposOcultos.clear();
    if (ligar) GRUPOS.forEach(g => { if (g.id !== id) gruposOcultos.add(g.id); });
    montarTipos();
  }
  filtrosMudaram();
}));

$('situacao').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  situacao = b.dataset.situacao;
  filtrosMudaram();
});

// Companhias presentes na área, com quantos voos cada uma tem agora
export function montarCompanhias() {
  const agora = Date.now();
  const contagem = new Map();
  for (const av of avioes.values()) {
    const pre = ativo(av, agora) && prefixo(av);
    if (pre) contagem.set(pre, (contagem.get(pre) || 0) + 1);
  }
  const ordem = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([pre]) => pre);
  for (const pre of companhiasSel) if (!ordem.includes(pre)) ordem.push(pre);
  $('companhias').replaceChildren(...ordem.map(pre => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'companhia';
    b.title = `${nomeCompanhia(pre)} (${pre})`;
    b.setAttribute('aria-pressed', String(companhiasSel.has(pre)));
    b.append(Object.assign(document.createElement('b'), { textContent: pre }),
             document.createTextNode(nomeCompanhia(pre) !== pre ? nomeCompanhia(pre) + ' ' : ''),
             Object.assign(document.createElement('span'), { textContent: String(contagem.get(pre) || 0) }));
    b.addEventListener('click', () => {
      if (companhiasSel.has(pre)) companhiasSel.delete(pre); else companhiasSel.add(pre);
      b.setAttribute('aria-pressed', String(companhiasSel.has(pre)));
      filtrosMudaram();
    });
    return b;
  }));
}

export function filtrosMudaram() {
  const ativos = (gruposOcultos.size ? 1 : 0) + (altMin > 0 || altMax < ALT_SEM_LIMITE ? 1 : 0)
    + (situacao !== 'todos' ? 1 : 0) + (soEmergencia ? 1 : 0) + (companhiasSel.size ? 1 : 0);
  const selo = $('filtros-ativos');
  selo.hidden = !ativos;
  selo.textContent = ativos;
  document.querySelectorAll('.atalho-filtro').forEach(b => {
    const a = b.dataset.atalho;
    b.setAttribute('aria-pressed', String(a === 'emergencias' ? soEmergencia : soGrupo(a === 'militares' ? 'militar' : 'helicoptero')));
  });
  document.querySelectorAll('#situacao button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.situacao === situacao)));
  if (selecionado && !passaFiltro(avioes.get(selecionado))) fecharPainel();
  atualizarStatus();
}

export function limparFiltros() {
  gruposOcultos.clear();
  situacao = 'todos';
  soEmergencia = false;
  companhiasSel.clear();
  montarTipos();
  montarCompanhias();
  definirAltitude(0, ALT_SEM_LIMITE);
}
$('limpar-filtros').addEventListener('click', limparFiltros);

entradaMin.addEventListener('input', () => {
  const min = Number(entradaMin.value);
  definirAltitude(min, Math.max(min, altMax));
});
entradaMax.addEventListener('input', () => {
  const max = Number(entradaMax.value);
  definirAltitude(Math.min(altMin, max), max);
});
