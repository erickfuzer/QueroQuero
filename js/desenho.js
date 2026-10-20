// Desenho dos aviões e aeroportos no canvas, clique e dica do mouse
import { FORMAS } from './aeronaves.js';
import { aeroportos } from './aeroportos.js';
import { toque } from './config.js';
import { TINTAS, corAltitude, paleta } from './cores.js';
import { ativo, avioes, nomeDoVoo, posicaoExibida } from './estado.js';
import { passaFiltro } from './filtros.js';
import { mapa } from './mapa.js';
import { fecharPainel, selecionado, selecionar } from './painel.js';
import { abrirAeroporto, aeroSelecionado, fecharAeroporto } from './painel-aeroporto.js';
import { emAltitude, prefs } from './prefs.js';
import { $, RAD, limitar } from './util.js';

const canvas = document.createElement('canvas');
canvas.className = 'camada-avioes';
mapa.getContainer().appendChild(canvas);
const ctx = canvas.getContext('2d');
let dpr = 1;

function redimensionar() {
  const tam = mapa.getSize();
  dpr = window.devicePixelRatio || 1;
  canvas.width = tam.x * dpr;
  canvas.height = tam.y * dpr;
  canvas.style.width = tam.x + 'px';
  canvas.style.height = tam.y + 'px';
}
redimensionar();
mapa.on('resize', redimensionar);
// Durante a animação de zoom as posições ficam erradas; a camada some por um instante
mapa.on('zoomstart', () => canvas.classList.add('em-zoom'));
mapa.on('zoomend', () => canvas.classList.remove('em-zoom'));

let naTela = [];
let sobMouse = null;

// Igual ao latLngToContainerPoint do Leaflet, mas sem arredondar para o pixel:
// assim o avião anda frações de pixel por quadro e o movimento fica liso
function paraTela(lat, lon) {
  const p = mapa.project([lat, lon]).subtract(mapa.getPixelOrigin());
  return p.add(L.DomUtil.getPosition(mapa.getPane('mapPane')));
}

function ajustarLon(lon, centroLon) {
  while (lon - centroLon > 180) lon -= 360;
  while (lon - centroLon < -180) lon += 360;
  return lon;
}

function desenhar() {
  requestAnimationFrame(desenhar);
  if (document.hidden) return;
  const agora = Date.now();
  const tam = mapa.getSize();
  const centroLon = mapa.getCenter().lng;
  const zoom = mapa.getZoom();
  const tinta = TINTAS[paleta];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, tam.x, tam.y);
  naTela = [];

  desenharAeroportos(zoom, centroLon, tinta);

  // Rastro de todos os aviões (camada opcional): um traço fino na cor da altitude atual
  if (prefs.camadas.rastros) {
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.5;
    for (const av of avioes.values()) {
      if (av.hex === selecionado || av.rastro.length < 2 || !ativo(av, agora) || !passaFiltro(av)) continue;
      const pos = posicaoExibida(av, agora);
      const fim = paraTela(pos.lat, ajustarLon(pos.lon, centroLon));
      if (fim.x < -300 || fim.y < -300 || fim.x > tam.x + 300 || fim.y > tam.y + 300) continue;
      ctx.strokeStyle = corAltitude(av.alt, av.solo);
      ctx.beginPath();
      av.rastro.slice(-120).forEach(([la, lo], i) => {
        const p = paraTela(la, ajustarLon(lo, centroLon));
        if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      });
      ctx.lineTo(fim.x, fim.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Rastro do avião selecionado, colorido pela altitude de cada trecho
  const sel = selecionado && avioes.get(selecionado);
  let pSel = null;
  if (sel) {
    pSel = posicaoExibida(sel, agora);
    const pontos = sel.rastro.map(([la, lo, alt, solo]) => ({ p: paraTela(la, ajustarLon(lo, centroLon)), alt, solo }));
    pontos.push({ p: paraTela(pSel.lat, ajustarLon(pSel.lon, centroLon)), alt: sel.alt, solo: sel.solo });
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 1; i < pontos.length; i++) {
      ctx.strokeStyle = corAltitude(pontos[i].alt, pontos[i].solo);
      ctx.beginPath();
      ctx.moveTo(pontos[i - 1].p.x, pontos[i - 1].p.y);
      ctx.lineTo(pontos[i].p.x, pontos[i].p.y);
      ctx.stroke();
    }
  }

  const rotulos = prefs.nomes === 'sempre' ? true : prefs.nomes === 'nunca' ? false : zoom >= 9;
  ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';

  const pendentes = [];
  for (const av of avioes.values()) {
    if (av === sel) continue;
    if (!ativo(av, agora) || !passaFiltro(av)) continue;
    desenharAviao(av, posicaoExibida(av, agora), agora, centroLon, tam, tinta, av.hex === sobMouse ? 'mouse' : null, rotulos && (!av.solo || prefs.nomes === 'sempre'), pendentes);
  }
  if (sel && ativo(sel, agora)) desenharAviao(sel, pSel, agora, centroLon, tam, tinta, 'selecionado', true, pendentes);

  // Rótulos por último, pulando os que cairiam em cima de outro (o selecionado tem prioridade)
  pendentes.sort((a, b) => b.forte - a.forte);
  const ocupados = [];
  ctx.lineWidth = 3;
  for (const r of pendentes) {
    const caixa = { x1: r.x - 2, y1: r.y - 8, x2: r.x + ctx.measureText(r.texto).width + 2, y2: r.y + 8 };
    if (ocupados.some(o => caixa.x1 < o.x2 && caixa.x2 > o.x1 && caixa.y1 < o.y2 && caixa.y2 > o.y1)) continue;
    ocupados.push(caixa);
    ctx.globalAlpha = r.alfa;
    ctx.strokeStyle = tinta.textoFundo;
    ctx.strokeText(r.texto, r.x, r.y);
    ctx.fillStyle = r.forte ? tinta.textoForte : tinta.texto;
    ctx.fillText(r.texto, r.x, r.y);
  }
  ctx.globalAlpha = 1;
}

function desenharAviao(av, pos, agora, centroLon, tam, tinta, destaque, rotulo, pendentes) {
  const p = paraTela(pos.lat, ajustarLon(pos.lon, centroLon));
  if (p.x < -30 || p.y < -30 || p.x > tam.x + 30 || p.y > tam.y + 30) return;
  naTela.push({ hex: av.hex, x: p.x, y: p.y });

  // Some aos poucos quando o sinal está se perdendo
  const idade = agora - av.visto;
  ctx.globalAlpha = idade > 15000 ? limitar(1 - (idade - 15000) / 15000, 0.15, 1) : 1;

  const forma = FORMAS[av.forma] || FORMAS.comercial;
  const escala = forma.escala * (destaque === 'selecionado' ? 1.25 : 1);
  if (destaque) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, destaque === 'selecionado' ? 21 : 16, 0, Math.PI * 2);
    ctx.fillStyle = destaque === 'selecionado' ? tinta.haloFundo : tinta.mouse;
    ctx.fill();
    if (destaque === 'selecionado') {
      ctx.strokeStyle = tinta.halo;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const cor = corAltitude(av.alt, av.solo);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (!forma.semRumo) ctx.rotate(pos.ang * RAD);
  ctx.scale(escala, escala);
  ctx.lineJoin = 'round';
  // Militares ganham um contorno de destaque por fora
  if (av.militar) {
    ctx.strokeStyle = tinta.militar;
    ctx.lineWidth = 4.2 / escala;
    ctx.stroke(forma.caminho);
  }
  ctx.fillStyle = cor;
  ctx.strokeStyle = tinta.contorno;
  ctx.lineWidth = 1.4 / escala;
  ctx.fill(forma.caminho);
  ctx.stroke(forma.caminho);
  // Rotor girando por cima do helicóptero
  if (forma.rotor) {
    // Disco translúcido do rotor e as pás girando por cima
    const alfa = ctx.globalAlpha;
    ctx.fillStyle = cor;
    ctx.globalAlpha = alfa * 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(av.solo && av.gs < 1 ? 0.6 : (agora / 70) % (Math.PI * 2));
    ctx.globalAlpha = alfa * 0.6;
    for (let i = 0; i < forma.rotor; i++) {
      ctx.rotate((Math.PI * 2) / forma.rotor);
      ctx.beginPath();
      ctx.rect(0, -1.2, 12.5, 2.4);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();

  if (rotulo) {
    const forte = destaque === 'selecionado';
    pendentes.push({ texto: nomeDoVoo(av), x: p.x + (forte ? 26 : 16), y: p.y, forte, alfa: ctx.globalAlpha });
  }
  ctx.globalAlpha = 1;
}
requestAnimationFrame(desenhar);

let aeroportosNaTela = [];
// Grandes aparecem a partir do zoom 5 e médios a partir do 7; o código aparece com mais zoom
function desenharAeroportos(zoom, centroLon, tinta) {
  aeroportosNaTela = [];
  if (!aeroportos || zoom < 5) return;
  const mostrarTodos = prefs.camadas.aeroportos;
  if (!mostrarTodos && !aeroSelecionado) return;
  const tam = mapa.getSize();
  ctx.font = '600 10.5px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  for (const a of mostrarTodos ? aeroportos : [aeroSelecionado]) {
    const escolhido = a === aeroSelecionado;
    if (!escolhido && a.porte === 2 && zoom < 7) continue;
    const p = paraTela(a.lat, ajustarLon(a.lon, centroLon));
    if (p.x < -20 || p.y < -20 || p.x > tam.x + 20 || p.y > tam.y + 20) continue;
    aeroportosNaTela.push({ a, x: p.x, y: p.y });
    const r = escolhido ? 5.5 : a.porte === 1 ? 4 : 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = tinta.aeroportoFundo;
    ctx.fill();
    ctx.lineWidth = escolhido ? 2.5 : 1.6;
    ctx.strokeStyle = escolhido ? tinta.halo : tinta.aeroporto;
    ctx.stroke();
    if (escolhido || (a.porte === 1 && zoom >= 6) || zoom >= 8) {
      const codigo = a.iata || a.icao;
      ctx.lineWidth = 3;
      ctx.strokeStyle = tinta.textoFundo;
      ctx.strokeText(codigo, p.x + r + 4, p.y);
      ctx.fillStyle = tinta.aeroporto;
      ctx.fillText(codigo, p.x + r + 4, p.y);
    }
  }
}

function aeroportoPerto(ponto, raio) {
  let melhor = null, menor = raio * raio;
  for (const x of aeroportosNaTela) {
    const d = (x.x - ponto.x) ** 2 + (x.y - ponto.y) ** 2;
    if (d <= menor) { menor = d; melhor = x.a; }
  }
  return melhor;
}

// O avião mais próximo de um ponto da tela
function avioesPerto(ponto, raio) {
  let melhor = null, menor = raio * raio;
  for (const a of naTela) {
    const d = (a.x - ponto.x) ** 2 + (a.y - ponto.y) ** 2;
    if (d <= menor) { menor = d; melhor = a.hex; }
  }
  return melhor;
}

mapa.on('click', e => {
  const dedo = e.originalEvent && e.originalEvent.pointerType === 'touch';
  const hex = avioesPerto(e.containerPoint, dedo ? 26 : 18);
  const aero = !hex && aeroportoPerto(e.containerPoint, dedo ? 18 : 10);
  if (hex) selecionar(hex);
  else if (aero) abrirAeroporto(aero);
  else { if (selecionado) fecharPainel(); if (aeroSelecionado) fecharAeroporto(); }
});

// Dica ao passar o mouse
const dica = $('dica');
mapa.on('mousemove', e => {
  if (toque.matches) return;
  const hex = avioesPerto(e.containerPoint, 18);
  const aero = !hex && aeroportoPerto(e.containerPoint, 10);
  sobMouse = hex;
  mapa.getContainer().style.cursor = hex || aero ? 'pointer' : '';
  const av = hex && avioes.get(hex);
  if ((!av || hex === selecionado) && (!aero || aero === aeroSelecionado)) { dica.hidden = true; return; }
  const b = document.createElement('b');
  const span = document.createElement('span');
  if (av) {
    const partes = [av.solo ? 'em solo' : av.alt != null ? emAltitude(av.alt)[0] : null, av.tipo || null].filter(Boolean);
    b.textContent = nomeDoVoo(av);
    span.textContent = partes.length ? ' · ' + partes.join(' · ') : '';
  } else {
    b.textContent = aero.iata || aero.icao;
    span.textContent = ` · ${aero.nome}`;
  }
  dica.replaceChildren(b, span);
  dica.hidden = false;
  const x = e.originalEvent.clientX, y = e.originalEvent.clientY;
  const largura = dica.offsetWidth;
  dica.style.left = Math.min(x + 14, window.innerWidth - largura - 8) + 'px';
  dica.style.top = (y + 16) + 'px';
});
mapa.on('mouseout', () => { dica.hidden = true; sobMouse = null; });
mapa.on('movestart', () => { dica.hidden = true; });
