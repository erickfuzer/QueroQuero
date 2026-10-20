// Mapa Leaflet e estilos de mapa base
import { CONFIG, params } from './config.js';
import { limitar } from './util.js';

const inicio = (params.get('c') || '').split(',').map(Number);
export const temInicio = inicio.length === 3 && inicio.every(Number.isFinite);

export const mapa = L.map('mapa', {
  center: temInicio ? [inicio[0], inicio[1]] : CONFIG.centroPadrao,
  zoom: temInicio ? limitar(inicio[2], 3, 16) : CONFIG.zoomPadrao,
  minZoom: 3,
  maxZoom: 16,
  zoomControl: false,
  worldCopyJump: true,
});
mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

// Estilos de mapa base, todos da Esri e sem chave. "paleta" diz se o fundo é escuro ou claro,
// para escolher as cores dos aviões; "escurecer" aplica o filtro que deixa o cinza mais fechado.
export const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const linkEsri = '<a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>';
const linkOsm = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
export const ESTILOS = {
  escuro: { nome: 'Escuro', paleta: 'escuro', escurecer: true, max: 16,
            servicos: ['Canvas/World_Dark_Gray_Base', 'Canvas/World_Dark_Gray_Reference'], credito: `Mapa: ${linkEsri}, HERE, Garmin, ${linkOsm}` },
  claro: { nome: 'Claro', paleta: 'claro', max: 16,
           servicos: ['Canvas/World_Light_Gray_Base', 'Canvas/World_Light_Gray_Reference'], credito: `Mapa: ${linkEsri}, HERE, Garmin, ${linkOsm}` },
  satelite: { nome: 'Satélite', paleta: 'escuro', max: 18,
              servicos: ['World_Imagery', 'Reference/World_Boundaries_and_Places'], credito: `Imagens: ${linkEsri}, Maxar, Earthstar Geographics` },
  relevo: { nome: 'Relevo', paleta: 'claro', max: 18,
            servicos: ['World_Topo_Map'], credito: `Mapa: ${linkEsri}, HERE, Garmin, USGS, ${linkOsm}` },
  ruas: { nome: 'Ruas', paleta: 'claro', max: 18,
          servicos: ['World_Street_Map'], credito: `Mapa: ${linkEsri}, HERE, Garmin, USGS, ${linkOsm}` },
};
const camadasBase = {};
export function camadaBase(id) {
  const e = ESTILOS[id];
  if (!camadasBase[id]) {
    camadasBase[id] = L.layerGroup(e.servicos.map((sv, i) => L.tileLayer(`${ESRI}${sv}/MapServer/tile/{z}/{y}/{x}`,
      { maxZoom: 19, maxNativeZoom: e.max, attribution: i === 0 ? e.credito : undefined })));
  }
  return camadasBase[id];
}
// Panes próprios: a sombra da noite e o radar ficam entre o mapa e os aviões
mapa.createPane('noite');
mapa.createPane('radar');

L.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
