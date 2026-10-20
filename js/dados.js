// Busca periódica dos voos no proxy e situação da conexão
import { esconderAviso, mostrarAviso } from './avisos.js';
import { ALT_SEM_LIMITE, CONFIG, PROXY } from './config.js';
import { TINTAS, paleta } from './cores.js';
import { ativo, avioes, receber } from './estado.js';
import { altMax, altMin, companhiasSel, gruposOcultos, montarCompanhias, passaFiltro, situacao, soEmergencia } from './filtros.js';
import { mapa } from './mapa.js';
import { abrirVooCompartilhado, preencherPainel, selecionado } from './painel.js';
import { aeroSelecionado, preencherAeroporto } from './painel-aeroporto.js';
import { $, distanciaKm, num, texto } from './util.js';

let timer = null;
let buscando = false;
let ultimaBusca = 0;
let ultimaArea = null;
let ultimoSucesso = 0;
let pausaAte = 0;
let falhas = 0;
let raioLimitado = false;
let fonteAtual = '';
let estadoConexao = 'carregando';

function agendar(ms) {
  clearTimeout(timer);
  timer = setTimeout(atualizar, Math.max(ms, pausaAte - Date.now(), 0));
}

// Círculo que cobre a área visível do mapa (as APIs consultam por raio)
function areaDeBusca() {
  const c = mapa.getCenter().wrap();
  const canto = mapa.getBounds().getNorthEast();
  const nm = c.distanceTo(canto) / 1852;
  return { lat: c.lat, lon: c.lng, raio: Math.ceil(Math.min(nm * 1.05, CONFIG.raioMaximo)), limitado: nm > CONFIG.raioMaximo };
}

// Com o mapa afastado além do alcance das fontes: contorno da área coberta e aviso com atalho
let contornoAlcance = null;
function mostrarAlcance(area) {
  document.body.classList.toggle('com-alcance', area.limitado);
  $('alcance').hidden = !area.limitado;
  if (!area.limitado) {
    if (contornoAlcance) contornoAlcance.remove();
    contornoAlcance = null;
    return;
  }
  texto('alcance-texto', `O mapa está maior que o alcance das fontes: só aparecem voos a até ${num(CONFIG.raioMaximo * 1.852)} km do centro.`);
  const estilo = { color: TINTAS[paleta].aeroporto, weight: 1.5, opacity: 0.55, dashArray: '6 6', fill: false, interactive: false, pane: 'noite' };
  if (contornoAlcance) contornoAlcance.setLatLng([area.lat, area.lon]).setStyle(estilo);
  else contornoAlcance = L.circle([area.lat, area.lon], { ...estilo, radius: CONFIG.raioMaximo * 1852 }).addTo(mapa);
}
$('bt-aproximar').addEventListener('click', () => {
  const nm = mapa.getCenter().distanceTo(mapa.getBounds().getNorthEast()) / 1852;
  mapa.zoomIn(Math.max(1, Math.ceil(Math.log2(nm * 1.05 / CONFIG.raioMaximo))));
});

// Só busca de novo ao mexer no mapa se a área mudou de verdade
function areaMudou() {
  if (!ultimaArea) return true;
  const a = areaDeBusca();
  const deslocamento = distanciaKm(a.lat, a.lon, ultimaArea.lat, ultimaArea.lon) / 1.852;
  return deslocamento > ultimaArea.raio * 0.25 || Math.abs(a.raio - ultimaArea.raio) > ultimaArea.raio * 0.2;
}

export async function atualizar() {
  clearTimeout(timer);
  if (document.hidden || buscando) return;
  if (!PROXY) {
    mostrarAviso('O proxy de dados não está configurado. Veja no README como publicar o seu.', 'erro');
    definirConexao('erro');
    return;
  }
  buscando = true;
  ultimaBusca = Date.now();
  const area = areaDeBusca();
  try {
    const resp = await fetch(`${PROXY}/voos?lat=${area.lat.toFixed(2)}&lon=${area.lon.toFixed(2)}&raio=${area.raio}`);
    if (resp.status === 429) {
      const s = Number(resp.headers.get('Retry-After')) || 30;
      pausaAte = Date.now() + s * 1000;
      mostrarAviso(`Limite de consultas gratuitas atingido. Tentando de novo em ${s} s.`);
      definirConexao('erro');
      agendar(s * 1000);
      return;
    }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const dados = await resp.json();
    receber(dados.ac || []);
    ultimaArea = area;
    raioLimitado = area.limitado;
    mostrarAlcance(area);
    ultimoSucesso = Date.now();
    definirFonte(dados.fonte);
    definirConexao('ok');
    falhas = 0;
    esconderAviso();
    abrirVooCompartilhado();
    if (selecionado) preencherPainel();
    if (aeroSelecionado) preencherAeroporto();
    if (!$('filtros').hidden) montarCompanhias();
    agendar(CONFIG.intervalo);
  } catch (e) {
    falhas++;
    const s = Math.min(60, 10 * 2 ** (falhas - 1));
    mostrarAviso(`Não foi possível buscar os voos agora. Nova tentativa em ${s} s.`, 'erro');
    definirConexao('erro');
    agendar(s * 1000);
  } finally {
    buscando = false;
    atualizarStatus();
  }
}

// Crédito da fonte que respondeu, no canto do mapa
const LINKS_FONTES = {
  'adsb.fi': 'https://adsb.fi',
  'airplanes.live': 'https://airplanes.live',
  'adsb.lol': 'https://adsb.lol',
};
function definirFonte(fonte) {
  if (!fonte || fonte === fonteAtual || !LINKS_FONTES[fonte]) return;
  const credito = f => `Voos: <a href="${LINKS_FONTES[f]}" target="_blank" rel="noopener">${f}</a>`;
  if (fonteAtual) mapa.attributionControl.removeAttribution(credito(fonteAtual));
  mapa.attributionControl.addAttribution(credito(fonte));
  fonteAtual = fonte;
}

function definirConexao(estado) {
  estadoConexao = estado;
  $('status').className = 'status ' + (estado === 'ok' ? '' : estado);
}

// Rodapé: quantos aviões e há quanto tempo veio o último dado
export function atualizarStatus() {
  const agora = Date.now();
  let total = 0, visiveis = 0;
  for (const av of avioes.values()) {
    if (!ativo(av, agora)) continue;
    total++;
    if (passaFiltro(av)) visiveis++;
  }
  const el = $('status-texto');
  if (estadoConexao === 'carregando') { el.textContent = 'Conectando…'; return; }
  if (estadoConexao === 'erro' && !ultimoSucesso) { el.textContent = 'Sem conexão com os dados'; return; }
  const filtrando = altMin > 0 || altMax < ALT_SEM_LIMITE || gruposOcultos.size > 0 || situacao !== 'todos' || soEmergencia || companhiasSel.size > 0;
  let linha = filtrando ? `${num(visiveis)} de ${num(total)} aviões` : `${num(total)} ${total === 1 ? 'avião' : 'aviões'}`;
  const s = Math.round((agora - ultimoSucesso) / 1000);
  linha += estadoConexao === 'erro' ? ' · reconectando' : s < 2 ? ' · ao vivo' : ` · há ${s} s`;
  el.textContent = linha;
  $('status').title = raioLimitado ? 'Mostrando um raio de 250 milhas náuticas a partir do centro do mapa' : '';
}
setInterval(() => { if (!document.hidden) atualizarStatus(); }, 1000);

// Recarrega ao mexer no mapa, sem passar de uma consulta a cada 3 s
mapa.on('moveend', () => {
  if (!areaDeBusca().limitado) mostrarAlcance({ limitado: false });   // some na hora, sem esperar a consulta
  if (!buscando && areaMudou()) agendar(Math.max(600, ultimaBusca + 3000 - Date.now()));
});

// Aba oculta: para tudo. Ao voltar, atualiza na hora.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else agendar(0);
});
