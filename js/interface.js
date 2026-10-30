// Navbar, popovers, preferências, tema, camadas, relógio, localização e atalhos
import { carregarAeroportos } from './aeroportos.js';
import { mostrarAviso } from './avisos.js';
import { busca } from './busca.js';
import { ALT_SEM_LIMITE, CONFIG, temaSistema } from './config.js';
import { ESCALAS, definirPaleta, definirTema, paleta, tema } from './cores.js';
import { altMax, altMin, definirAltitude, montarCompanhias, montarTipos } from './filtros.js';
import { ESRI, ESTILOS, camadaBase, mapa } from './mapa.js';
import { alternarSeguir, fecharPainel, preencherPainel, seguindo, selecionado } from './painel.js';
import { aeroSelecionado, fecharAeroporto } from './painel-aeroporto.js';
import { prefs, salvarPrefs } from './prefs.js';
import { $, RAD, horaUtc, texto } from './util.js';

// Atalhos: "/" foca a busca, Esc fecha o que estiver aberto
document.addEventListener('keydown', e => {
  const digitando = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (e.key === '/' && !digitando) { e.preventDefault(); busca.focus(); }
  else if (e.key === 'Escape' && !digitando) {
    if ($('sobre').open) return;
    if (popoverAberto()) fecharPopovers();
    else if (selecionado) fecharPainel();
    else if (aeroSelecionado) fecharAeroporto();
  }
});

// ───────────────────────────── Popovers: mapa, filtros e preferências ─────────────────────────────
const popovers = [[$('bt-mapa'), $('mapas')], [$('bt-filtros'), $('filtros')], [$('bt-prefs'), $('prefs')]];
const popoverAberto = () => popovers.some(([, p]) => !p.hidden);

export function fecharPopovers() {
  for (const [botao, pop] of popovers) { pop.hidden = true; botao.setAttribute('aria-expanded', 'false'); }
}
for (const [botao, pop] of popovers) {
  botao.addEventListener('click', e => {
    e.stopPropagation();
    const abrir = pop.hidden;
    fecharPopovers();
    if (!abrir) return;
    if (pop.id === 'filtros') montarCompanhias();
    pop.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    // Alinha a borda direita do popover com a do botão (no celular o CSS ocupa a largura toda)
    const nav = document.querySelector('.navbar').getBoundingClientRect();
    pop.style.right = Math.max(8, nav.right - botao.getBoundingClientRect().right) + 'px';
  });
  pop.addEventListener('click', e => e.stopPropagation());
}
document.addEventListener('click', fecharPopovers);
mapa.on('movestart', () => { if (!seguindo) fecharPopovers(); });

// ── Preferências ──
function marcarPrefs() {
  document.querySelectorAll('#prefs .segmentado').forEach(grupo => {
    grupo.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.valor === prefs[grupo.dataset.pref])));
  });
  const rotulos = prefs.altitude === 'm'
    ? ['solo', '3 mil', '6 mil', '9 mil', '12 mil m']
    : ['solo', '10 mil', '20 mil', '30 mil', '40 mil ft'];
  document.querySelectorAll('.rotulos-altitude').forEach(el => el.replaceChildren(...rotulos.map(t => Object.assign(document.createElement('span'), { textContent: t }))));
}
document.querySelectorAll('#prefs .segmentado').forEach(grupo => {
  grupo.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    prefs[grupo.dataset.pref] = b.dataset.valor;
    salvarPrefs();
    if (grupo.dataset.pref === 'tema') aplicarTema();
    else {
      marcarPrefs();
      definirAltitude(altMin, altMax);
      if (selecionado) preencherPainel();
    }
  });
});

// ── Estilos de mapa, com miniatura de São Paulo ──
export function montarEstilos() {
  const bloco = id => `${ESRI}${ESTILOS[id].servicos[0]}/MapServer/tile/7/72/47`;
  const opcoes = [['auto', 'Automático'], ...Object.entries(ESTILOS).map(([id, e]) => [id, e.nome])];
  $('estilos').replaceChildren(...opcoes.map(([id, nome]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'estilo';
    b.dataset.estilo = id;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === prefs.mapa));
    const mini = document.createElement('span');
    mini.className = 'miniatura';
    const imagens = id === 'auto' ? ['claro', 'escuro'] : [id];
    for (const im of imagens) {
      mini.append(Object.assign(document.createElement('img'), {
        src: bloco(im), alt: '', loading: 'lazy', className: ESTILOS[im].escurecer ? 'escurecida' : ESTILOS[im].papel ? 'papel' : '',
      }));
    }
    b.append(mini, Object.assign(document.createElement('span'), { textContent: id === 'auto' ? 'Segue o tema' : nome }));
    b.addEventListener('click', () => { prefs.mapa = id; salvarPrefs(); aplicarMapa(); });
    return b;
  }));
}

// ── Camadas sobrepostas ──
const interruptores = { radar: $('cam-radar'), aeroportos: $('cam-aeroportos'), noite: $('cam-noite'), rastros: $('cam-rastros') };
for (const [nome, el] of Object.entries(interruptores)) {
  el.checked = prefs.camadas[nome];
  el.addEventListener('change', () => {
    prefs.camadas[nome] = el.checked;
    salvarPrefs();
    aplicarCamada(nome);
  });
}
export function aplicarCamada(nome) {
  const ligada = prefs.camadas[nome];
  if (nome === 'radar') ligarRadar(ligada);
  else if (nome === 'noite') ligarNoite(ligada);
  else if (nome === 'aeroportos' && ligada) carregarAeroportos();
}

// Radar de chuva do RainViewer: 13 quadros das últimas 2 horas, 10 min entre eles
const creditoRadar = 'Radar: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>';
const radar = { quadros: [], camadas: [], indice: -1, animacao: null, carregado: 0 };
async function ligarRadar(ligar) {
  pararRadar();
  radar.camadas.forEach(c => c && c.remove());
  radar.camadas = [];
  radar.quadros = [];
  mapa.attributionControl.removeAttribution(creditoRadar);
  $('radar-controle').hidden = !ligar;
  if (!ligar) return;
  try {
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!prefs.camadas.radar) return;
    radar.quadros = (d.radar && d.radar.past || []).map(q => ({ tempo: q.time * 1000, url: `${d.host}${q.path}/256/{z}/{x}/{y}/2/1_1.png` }));
    radar.carregado = Date.now();
    if (!radar.quadros.length) throw new Error('sem quadros');
    mapa.attributionControl.addAttribution(creditoRadar);
    mostrarQuadro(radar.quadros.length - 1);
  } catch (e) {
    mostrarAviso('Não foi possível carregar o radar de chuva agora.', 'erro', 4000);
    $('radar-controle').hidden = true;
  }
}
function camadaRadar(i) {
  if (!radar.camadas[i]) {
    radar.camadas[i] = L.tileLayer(radar.quadros[i].url, { pane: 'radar', opacity: 0, maxNativeZoom: 7, maxZoom: 19 }).addTo(mapa);
  }
  return radar.camadas[i];
}
function mostrarQuadro(i) {
  radar.indice = i;
  radar.quadros.forEach((q, j) => { if (radar.camadas[j] || j === i) camadaRadar(j).setOpacity(j === i ? 0.65 : 0); });
  texto('radar-hora', horaUtc(radar.quadros[i].tempo));
}
function pararRadar() {
  clearInterval(radar.animacao);
  radar.animacao = null;
  $('radar-icone').setAttribute('d', 'M8 5.5v13l10.5-6.5z');
  $('bt-radar-play').setAttribute('aria-label', 'Animar as últimas 2 horas');
  if (radar.quadros.length) mostrarQuadro(radar.quadros.length - 1);
}
$('bt-radar-play').addEventListener('click', () => {
  if (radar.animacao) { pararRadar(); return; }
  if (!radar.quadros.length) return;
  radar.quadros.forEach((q, j) => camadaRadar(j));     // pré-carrega todos os quadros
  let pausa = 0;
  mostrarQuadro(0);
  radar.animacao = setInterval(() => {
    if (radar.indice === radar.quadros.length - 1 && pausa++ < 3) return;   // segura um pouco no quadro mais recente
    pausa = 0;
    mostrarQuadro((radar.indice + 1) % radar.quadros.length);
  }, 600);
  $('radar-icone').setAttribute('d', 'M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z');
  $('bt-radar-play').setAttribute('aria-label', 'Parar a animação');
});
setInterval(() => {   // novos quadros a cada 10 min
  if (prefs.camadas.radar && !radar.animacao && !document.hidden && Date.now() - radar.carregado > 10 * 60000) ligarRadar(true);
}, 60000);

// Dia e noite: polígono do lado escuro da Terra, recalculado a cada minuto
let camadaNoite = null;
function terminador(data) {
  const n = data / 86400000 + 2440587.5 - 2451545.0;          // dias desde J2000
  const L0 = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L0 + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lonSol = ra / RAD - gmst * 15;                          // longitude onde o Sol está a pino
  const pontos = [];
  for (let lon = -540; lon <= 540; lon += 2) {
    pontos.push([Math.atan(-Math.cos((lon - lonSol) * RAD) / Math.tan(dec)) / RAD, lon]);
  }
  const polo = dec > 0 ? -90 : 90;                              // a noite fecha no polo sem Sol
  pontos.push([polo, 540], [polo, -540]);
  return pontos;
}
function ligarNoite(ligar) {
  if (!ligar) { if (camadaNoite) camadaNoite.remove(); camadaNoite = null; return; }
  const pontos = terminador(Date.now());
  if (camadaNoite) camadaNoite.setLatLngs(pontos);
  else camadaNoite = L.polygon(pontos, { pane: 'noite', stroke: false, fillColor: '#05070a', fillOpacity: 0.3, interactive: false }).addTo(mapa);
}
setInterval(() => { if (prefs.camadas.noite && !document.hidden) ligarNoite(true); }, 60000);

// Relógio UTC (Zulu)
export function atualizarRelogio() { texto('relogio', horaUtc(Date.now())); }
setInterval(atualizarRelogio, 1000);

// Janela "Sobre"
const sobre = $('sobre');
const abrirSobre = () => { fecharPopovers(); sobre.showModal(); };
$('link-sobre').addEventListener('click', abrirSobre);
$('bt-fechar-sobre').addEventListener('click', () => sobre.close());
sobre.addEventListener('click', e => { if (e.target === sobre) sobre.close(); });

// ───────────────────────────── Tema e estilo do mapa ─────────────────────────────
export function aplicarTema() {
  definirTema(prefs.tema === 'auto' ? (temaSistema.matches ? 'escuro' : 'claro') : prefs.tema);
  document.documentElement.setAttribute('data-tema', tema);
  document.querySelector('meta[name="theme-color"]').content = tema === 'escuro' ? '#0e1416' : '#f7f3e8';
  montarTipos();
  marcarPrefs();
  aplicarMapa();
}
temaSistema.addEventListener('change', () => { if (prefs.tema === 'auto') aplicarTema(); });

let estiloAtual = null;
function aplicarMapa() {
  const id = prefs.mapa === 'auto' ? tema : prefs.mapa;
  if (id !== estiloAtual) {
    if (estiloAtual) camadaBase(estiloAtual).remove();
    camadaBase(id).addTo(mapa);
    estiloAtual = id;
  }
  definirPaleta(ESTILOS[id].paleta);
  mapa.getContainer().classList.toggle('mapa-escurecido', !!ESTILOS[id].escurecer);
  mapa.getContainer().classList.toggle('mapa-papel', !!ESTILOS[id].papel);
  const escala = ESCALAS[paleta].map(([alt, c]) => `rgb(${c.join(', ')}) ${(alt / ALT_SEM_LIMITE) * 100}%`).join(', ');
  document.documentElement.style.setProperty('--escala', `linear-gradient(90deg, ${escala})`);
  document.querySelectorAll('#estilos .estilo').forEach(b => b.setAttribute('aria-checked', String(b.dataset.estilo === prefs.mapa)));
  if (selecionado) preencherPainel();
}

// Botão "minha localização"
const ControleLocal = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd() {
    const div = L.DomUtil.create('div', 'leaflet-bar');
    const botao = L.DomUtil.create('button', 'botao-mapa', div);
    botao.type = 'button';
    botao.title = 'Ir para minha localização';
    botao.setAttribute('aria-label', 'Ir para minha localização');
    botao.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" class="cheio"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.on(botao, 'click', () => localizar(true));
    return div;
  },
});
new ControleLocal().addTo(mapa);

let marcadorVoce = null;

// Pede a localização; se o usuário recusar, o mapa fica em São Paulo
export function localizar(pedidoDoUsuario) {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if (!marcadorVoce) {
      marcadorVoce = L.marker(ll, {
        icon: L.divIcon({ className: '', html: '<div class="voce"></div>', iconSize: [14, 14] }),
        interactive: false,
        keyboard: false,
      }).addTo(mapa);
    } else {
      marcadorVoce.setLatLng(ll);
    }
    alternarSeguir(false);
    mapa.setView(ll, Math.max(mapa.getZoom(), CONFIG.zoomPadrao));
  }, () => {
    if (pedidoDoUsuario) mostrarAviso('Não foi possível obter sua localização. Verifique a permissão do navegador.', 'erro', 5000);
  }, { timeout: 10000, maximumAge: 600000 });
}
