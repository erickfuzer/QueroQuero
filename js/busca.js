// Busca de voos e aeroportos
import { iconeForma } from './aeronaves.js';
import { aeroportos, carregarAeroportos, semAcento } from './aeroportos.js';
import { corAltitude } from './cores.js';
import { ativo, avioes, nomeDoVoo } from './estado.js';
import { limparFiltros, passaFiltro } from './filtros.js';
import { fecharPopovers } from './interface.js';
import { selecionar } from './painel.js';
import { abrirAeroporto } from './painel-aeroporto.js';
import { emAltitude } from './prefs.js';
import { $, SVG_NS } from './util.js';

export const busca = $('busca');
const sugestoes = $('sugestoes');
let resultados = [];
let indice = -1;

const normalizar = s => s.toUpperCase().replace(/[\s-]/g, '');

function procurar() {
  const termo = normalizar(busca.value);
  indice = -1;
  if (!termo) { sugestoes.hidden = true; return; }
  const agora = Date.now();
  const voos = [];
  for (const av of avioes.values()) {
    if (!ativo(av, agora)) continue;
    const campos = [normalizar(av.indicativo), normalizar(av.matricula), av.hex.toUpperCase()];
    const pos = Math.min(...campos.map(c => { const i = c.indexOf(termo); return i < 0 ? 99 : i; }));
    if (pos < 99) voos.push({ av, pos });
  }
  voos.sort((a, b) => a.pos - b.pos || (a.av.indicativo || 'zz').localeCompare(b.av.indicativo || 'zz'));

  // Aeroportos: código exato primeiro, depois começo do código, depois nome ou cidade
  const aeros = [];
  if (termo.length >= 2) {
    if (!aeroportos) carregarAeroportos().then(() => { if (busca.value && document.activeElement === busca) procurar(); });
    else {
      const t = semAcento(busca.value.trim());
      for (const a of aeroportos) {
        const nota = a.iata === termo || a.icao === termo ? 0
          : a.iata.startsWith(termo) || a.icao.startsWith(termo) ? 1
          : t.length >= 3 && a.chave.includes(t) ? 2 + a.porte : 99;
        if (nota < 99) aeros.push({ a, nota });
      }
      aeros.sort((x, y) => x.nota - y.nota || x.a.porte - y.a.porte);
    }
  }
  const exato = aeros.length && aeros[0].nota === 0;
  const listaVoos = voos.slice(0, exato ? 4 : 6).map(r => ({ av: r.av }));
  const listaAeros = aeros.slice(0, 4).map(r => ({ aero: r.a }));
  resultados = exato ? [...listaAeros, ...listaVoos] : [...listaVoos, ...listaAeros];

  sugestoes.replaceChildren();
  if (!resultados.length) {
    const li = document.createElement('li');
    li.className = 'vazio';
    li.textContent = 'Nenhum voo ou aeroporto encontrado';
    sugestoes.append(li);
  }
  resultados.forEach((r, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.id = 'sugestao-' + i;
    const b = document.createElement('b');
    const span = document.createElement('span');
    if (r.av) {
      const av = r.av;
      b.textContent = nomeDoVoo(av);
      span.textContent = [av.matricula, av.solo ? 'em solo' : av.alt != null ? emAltitude(av.alt)[0] : ''].filter(Boolean).join(' · ');
      li.append(iconeForma(av.forma, corAltitude(av.alt, av.solo), 45), b, span);
    } else {
      const a = r.aero;
      b.textContent = a.iata || a.icao;
      span.textContent = [a.cidade, a.pais].filter(Boolean).join(' · ');
      const icone = document.createElementNS(SVG_NS, 'svg');
      icone.setAttribute('viewBox', '0 0 24 24');
      icone.setAttribute('class', 'icone-aero');
      icone.innerHTML = '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>';
      li.title = a.nome;
      li.append(icone, b, span);
    }
    li.addEventListener('mousedown', e => { e.preventDefault(); escolher(i); });
    sugestoes.append(li);
  });
  sugestoes.hidden = false;
}

function marcar(i) {
  indice = i;
  [...sugestoes.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
  busca.setAttribute('aria-activedescendant', i >= 0 ? 'sugestao-' + i : '');
}

function escolher(i) {
  const r = resultados[i];
  if (!r) return;
  if (r.aero) {
    busca.value = r.aero.iata || r.aero.icao;
    sugestoes.hidden = true;
    busca.blur();
    abrirAeroporto(r.aero, true);
    return;
  }
  const av = r.av;
  // Se o avião estiver escondido pelos filtros, eles são liberados para ele aparecer
  if (!passaFiltro(av)) limparFiltros();
  busca.value = nomeDoVoo(av);
  sugestoes.hidden = true;
  busca.blur();
  selecionar(av.hex, true);
}

busca.addEventListener('input', procurar);
busca.addEventListener('focus', () => { fecharPopovers(); if (busca.value) procurar(); });
busca.addEventListener('blur', () => { sugestoes.hidden = true; });
busca.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); marcar(Math.min(indice + 1, resultados.length - 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(Math.max(indice - 1, 0)); }
  else if (e.key === 'Enter') { e.preventDefault(); escolher(Math.max(indice, 0)); }
  else if (e.key === 'Escape') { busca.value = ''; sugestoes.hidden = true; busca.blur(); }
});
