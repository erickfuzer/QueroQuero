// Painel do voo selecionado: dados, foto, rota, seguir e compartilhar
import { FORMAS, iconeForma } from './aeronaves.js';
import { mostrarAviso } from './avisos.js';
import { celular, params, toque } from './config.js';
import { corAltitude } from './cores.js';
import { EMERGENCIAS, ativo, avioes, nomeDoVoo, posicaoExibida } from './estado.js';
import { mapa } from './mapa.js';
import { aeroSelecionado, fecharAeroporto } from './painel-aeroporto.js';
import { paisDoHex } from './paises.js';
import { emAltitude, emVelocidade, prefs } from './prefs.js';
import { buscarRota, ehIndicativoDeCompanhia, rotaConfere, rotas } from './rotas.js';
import { $, cardeal, coordenada, num, texto } from './util.js';

export const painel = $('painel');
export let selecionado = null;

export function selecionar(hex, centralizar = false) {
  const av = avioes.get(hex);
  if (!av) return;
  if (aeroSelecionado) fecharAeroporto();
  if (selecionado !== hex) alternarSeguir(false);
  selecionado = hex;
  $('dica').hidden = true;
  painel.hidden = false;
  painel.classList.remove('expandida');
  document.body.classList.add('com-painel');
  preencherPainel();
  mostrarFoto(av);
  medirFolha();
  const pos = posicaoExibida(av, Date.now());
  if (centralizar) mapa.setView([pos.lat, pos.lon], Math.max(mapa.getZoom(), 9), { animate: false });
  manterVisivel(pos);
}

export function fecharPainel() {
  selecionado = null;
  alternarSeguir(false);
  painel.hidden = true;
  painel.classList.remove('expandida');
  if (!aeroSelecionado) document.body.classList.remove('com-painel');
  medirFolha();
}
$('bt-fechar').addEventListener('click', fecharPainel);

// Painel aberto agora: o do voo ou o do aeroporto
const painelAero = $('painel-aero');
const painelAberto = () => !painel.hidden ? painel : !painelAero.hidden ? painelAero : null;

// No celular o painel é uma folha inferior: os controles do rodapé sobem junto
export function medirFolha() {
  const aberto = painelAberto();
  const altura = aberto && celular.matches ? aberto.offsetHeight : 0;
  document.documentElement.style.setProperty('--folga', altura + 'px');
}
new ResizeObserver(medirFolha).observe(painel);
new ResizeObserver(medirFolha).observe(painelAero);
celular.addEventListener('change', medirFolha);

// Área do mapa que não fica escondida atrás do painel
function areaLivre() {
  // O mapa começa abaixo da navbar; no computador o painel ocupa a lateral esquerda
  const tam = mapa.getSize();
  const topo = 8;
  const aberto = painelAberto();
  if (!aberto) return { x1: 0, y1: topo, x2: tam.x, y2: tam.y };
  return celular.matches
    ? { x1: 0, y1: topo, x2: tam.x, y2: tam.y - aberto.offsetHeight }
    : { x1: aberto.offsetWidth + 12, y1: topo, x2: tam.x - 60, y2: tam.y - 50 };
}

// Se o avião ficou atrás do painel, move o mapa para ele aparecer
function manterVisivel(pos) {
  const p = mapa.latLngToContainerPoint([pos.lat, pos.lon]);
  const area = areaLivre();
  const m = 40;
  if (p.x < area.x1 + m || p.x > area.x2 - m || p.y < area.y1 + m || p.y > area.y2 - m) {
    mapa.panBy([p.x - (area.x1 + area.x2) / 2, p.y - (area.y1 + area.y2) / 2]);
  }
}

// Seguir: o mapa acompanha o avião selecionado, mantendo-o no centro da área livre
export let seguindo = false;
export function alternarSeguir(ligar) {
  seguindo = ligar;
  $('bt-seguir').setAttribute('aria-pressed', String(ligar));
  if (ligar) acompanhar(false);
}
function acompanhar(suave = true) {
  const av = selecionado && avioes.get(selecionado);
  if (!av) return;
  const pos = posicaoExibida(av, Date.now());
  const p = mapa.latLngToContainerPoint([pos.lat, pos.lon]);
  const area = areaLivre();
  const dx = p.x - (area.x1 + area.x2) / 2, dy = p.y - (area.y1 + area.y2) / 2;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  mapa.panBy([dx, dy], suave ? { animate: true, duration: 1, easeLinearity: 1, noMoveStart: true } : { animate: true });
}
setInterval(() => { if (seguindo && !document.hidden) acompanhar(); }, 1000);
$('bt-seguir').addEventListener('click', () => alternarSeguir(!seguindo));
mapa.on('dragstart', () => alternarSeguir(false));

// Compartilhar: link que abre o mapa no avião com ele selecionado
$('bt-compartilhar').addEventListener('click', async () => {
  const av = selecionado && avioes.get(selecionado);
  if (!av) return;
  const pos = posicaoExibida(av, Date.now());
  const url = new URL(location.pathname, location.origin);
  if (params.get('proxy')) url.searchParams.set('proxy', params.get('proxy'));
  url.searchParams.set('voo', av.hex);
  url.searchParams.set('c', `${pos.lat.toFixed(3)},${pos.lon.toFixed(3)},${mapa.getZoom()}`);
  const link = url.toString();
  if (navigator.share && toque.matches) {
    try {
      await navigator.share({ title: `${nomeDoVoo(av)} no Quero-Quero`, url: link });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    mostrarAviso('Link do voo copiado.', '', 2500);
  } catch (e) {
    mostrarAviso('Não foi possível copiar o link automaticamente.', 'erro', 4000);
  }
});

// Voo vindo de um link compartilhado: abre assim que os dados chegarem
let vooCompartilhado = (params.get('voo') || '').toLowerCase();
export function abrirVooCompartilhado() {
  if (!vooCompartilhado) return;
  const hex = vooCompartilhado;
  vooCompartilhado = '';
  const limpa = new URL(location.href);
  limpa.searchParams.delete('voo');
  limpa.searchParams.delete('c');
  history.replaceState(null, '', limpa);
  if (avioes.has(hex)) selecionar(hex);
  else mostrarAviso('O voo compartilhado não está mais transmitindo nesta área.', '', 5000);
}

// Folha do celular: arrastar para cima expande, para baixo recolhe ou fecha; toque alterna
let arrasto = null;
painel.addEventListener('pointerdown', e => {
  if (!celular.matches || e.target.closest('button') || !e.target.closest('.alca, .p-cab')) return;
  arrasto = { y0: e.clientY, dy: 0 };
  painel.setPointerCapture(e.pointerId);
  painel.classList.add('arrastando');
});
painel.addEventListener('pointermove', e => {
  if (!arrasto) return;
  arrasto.dy = e.clientY - arrasto.y0;
  painel.style.transform = `translateY(${Math.max(arrasto.dy, -16)}px)`;
});
function soltar() {
  if (!arrasto) return;
  const dy = arrasto.dy;
  arrasto = null;
  painel.classList.remove('arrastando');
  painel.style.transform = '';
  const expandida = painel.classList.contains('expandida');
  if (Math.abs(dy) < 6) painel.classList.toggle('expandida');
  else if (dy < -30) painel.classList.add('expandida');
  else if (dy > 50) { if (expandida) painel.classList.remove('expandida'); else fecharPainel(); }
}
painel.addEventListener('pointerup', soltar);
painel.addEventListener('pointercancel', soltar);

export function preencherPainel() {
  const av = avioes.get(selecionado);
  if (!av) return;
  const agora = Date.now();
  const cor = corAltitude(av.alt, av.solo);
  painel.style.setProperty('--cor-voo', cor);
  const forma = FORMAS[av.forma] || FORMAS.comercial;

  const icone = $('p-forma');
  icone.setAttribute('d', forma.d);
  icone.setAttribute('fill', cor);


  texto('p-indicativo', nomeDoVoo(av));
  const rota = rotas.get(av.indicativo.toUpperCase());
  const companhia = rota && !(rota instanceof Promise) ? rota.companhia : null;
  texto('p-subtitulo', companhia || av.descricao || av.tipo || '');

  // Etiquetas: militar, tipo e emergência
  const etiquetas = [];
  if (av.militar) etiquetas.push(['Militar', 'militar']);
  etiquetas.push([av.semCategoria ? 'Tipo não informado' : forma.nome, '']);
  if (EMERGENCIAS[av.squawk]) etiquetas.push([EMERGENCIAS[av.squawk], 'alerta']);
  $('p-etiquetas').replaceChildren(...etiquetas.map(([t, c]) => Object.assign(document.createElement('span'), { className: 'etiqueta ' + c, textContent: t })));

  // Resumo
  if (av.solo) { texto('p-altitude', 'Em solo'); texto('p-altitude-2', ''); }
  else if (av.alt == null) { texto('p-altitude', '–'); texto('p-altitude-2', ''); }
  else { const [a1, a2] = emAltitude(av.alt); texto('p-altitude', a1); texto('p-altitude-2', a2); }
  const [v1, v2] = emVelocidade(av.gs);
  texto('p-velocidade', v1);
  texto('p-velocidade-2', v2);
  const v = av.vertical;
  if (v == null || av.solo) { texto('p-vertical', '–'); texto('p-vertical-2', ''); }
  else if (Math.abs(v) <= 64) { texto('p-vertical', 'Nivelado'); texto('p-vertical-2', ''); }
  else if (prefs.altitude === 'm') { texto('p-vertical', `${v > 0 ? '↑' : '↓'} ${num(Math.abs(v) * 0.00508, 1)}`); texto('p-vertical-2', 'm/s'); }
  else { texto('p-vertical', `${v > 0 ? '↑' : '↓'} ${num(Math.abs(v))}`); texto('p-vertical-2', 'ft/min'); }

  // Voo
  texto('p-rumo', `${num(av.rumo)}° ${cardeal(av.rumo)}`);
  texto('p-squawk', av.squawk || '–');
  $('p-squawk').className = 'codigo' + (EMERGENCIAS[av.squawk] ? ' alerta' : '');
  texto('p-posicao', `${coordenada(av.lat, 'N', 'S')}, ${coordenada(av.lon, 'L', 'O')}`);
  const s = Math.max(0, Math.round((agora - av.t) / 1000));
  texto('p-visto', s < 2 ? 'agora' : `há ${s} s`);

  // Aeronave
  texto('p-matricula', av.matricula || '–');
  $('p-matricula').className = 'codigo';
  texto('p-modelo', av.descricao || av.tipo || '–');
  texto('p-hex', av.hex.toUpperCase());
  $('p-hex').className = 'codigo';
  texto('p-pais', paisDoHex(av.hex) || 'Não identificado');

  painel.classList.toggle('perdido', !ativo(av, agora));
  mostrarRota(av);
}
setInterval(() => { if (selecionado && !document.hidden) preencherPainel(); }, 1000);

// Foto da aeronave pelo Planespotters.net (busca pelo código ICAO; se não houver, pela matrícula).
// Regras da API: crédito do fotógrafo ao lado e a miniatura linkando para a página da foto.
const fotos = new Map(); // hex → foto | null | Promise

async function buscarFoto(av) {
  const api = 'https://api.planespotters.net/pub/photos/';
  const pedir = async caminho => {
    const r = await fetch(api + caminho);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return (d.photos || [])[0] || null;
  };
  let foto = await pedir('hex/' + av.hex);
  if (!foto && av.matricula) foto = await pedir('reg/' + encodeURIComponent(av.matricula));
  if (!foto) return null;
  const img = foto.thumbnail_large || foto.thumbnail;
  if (!img || !/^https:\/\//.test(img.src) || !/^https:\/\/www\.planespotters\.net\//.test(foto.link)) return null;
  return { src: img.src, link: foto.link, fotografo: foto.photographer || 'autor desconhecido' };
}

function mostrarFoto(av) {
  const fig = $('p-foto');
  const img = $('p-foto-img');
  const foto = fotos.get(av.hex);
  if (foto === undefined) {
    fig.hidden = false;
    fig.classList.add('carregando');
    img.classList.remove('carregada');
    img.removeAttribute('src');
    fotos.set(av.hex, buscarFoto(av)
      .then(f => { fotos.set(av.hex, f); })
      .catch(() => { fotos.set(av.hex, null); })
      .finally(() => { if (selecionado === av.hex) mostrarFoto(av); }));
    return;
  }
  if (foto instanceof Promise) return;
  if (!foto) { fig.hidden = true; return; }
  fig.hidden = false;
  fig.classList.remove('carregando');
  if (img.getAttribute('src') !== foto.src) {
    img.classList.remove('carregada');
    img.onload = () => img.classList.add('carregada');
    img.onerror = () => { fig.hidden = true; };
    img.src = foto.src;
  }
  img.alt = `Foto da aeronave ${av.matricula || av.hex.toUpperCase()}`;
  $('p-foto-link').href = foto.link;
  $('p-foto-credito').href = foto.link;
  $('p-foto-credito').textContent = `Foto: ${foto.fotografo} · Planespotters.net`;
}

function mostrarRota(av) {
  const el = $('p-rota');
  const cs = av.indicativo.toUpperCase();
  const semRota = msg => {
    el.replaceChildren(Object.assign(document.createElement('p'), { className: 'r-vazia', textContent: msg }));
  };
  if (!ehIndicativoDeCompanhia(cs)) return semRota('Rota não disponível para este voo.');

  const rota = rotas.get(cs);
  if (rota === undefined) {
    semRota('Buscando rota…');
    buscarRota(cs).then(() => { if (selecionado === av.hex) preencherPainel(); });
    return;
  }
  if (rota instanceof Promise) return;
  if (!rota || !rota.origem || !rota.destino) return semRota('Rota não disponível para este voo.');
  const conta = rotaConfere(av, rota);
  if (!conta) return semRota('Rota não disponível: a cadastrada para este indicativo não confere com a posição do avião.');
  const { origem: o, destino: d } = rota;
  const { feito, falta, fracao } = conta;

  const ponto = (a, classe) => {
    const div = document.createElement('div');
    div.className = 'r-ap ' + classe;
    div.append(Object.assign(document.createElement('b'), { textContent: a.iata || a.icao || '?' }),
               Object.assign(document.createElement('span'), { textContent: a.cidade || a.nome || '' }));
    return div;
  };
  const pontos = document.createElement('div');
  pontos.className = 'r-pontos';
  pontos.append(ponto(o, 'partida'), ponto(d, 'chegada'));

  const barra = document.createElement('div');
  barra.className = 'r-barra';
  const feitoEl = document.createElement('div');
  feitoEl.className = 'r-feito';
  feitoEl.style.width = (fracao * 100).toFixed(1) + '%';
  const aviao = document.createElement('div');
  aviao.className = 'r-aviao';
  aviao.style.left = (fracao * 100).toFixed(1) + '%';
  aviao.append(iconeForma('comercial', 'currentColor'));
  barra.append(feitoEl, aviao);

  const dist = document.createElement('div');
  dist.className = 'r-dist';
  dist.append(Object.assign(document.createElement('span'), { textContent: `${num(feito)} km percorridos` }),
              Object.assign(document.createElement('span'), { textContent: `faltam ${num(falta)} km` }));

  const nota = Object.assign(document.createElement('p'), { className: 'r-nota', textContent: 'Rota cadastrada no adsbdb' });
  el.replaceChildren(pontos, barra, dist, nota);
}
