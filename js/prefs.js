// Preferências do usuário (tema, unidades, mapa e camadas) e formatação de unidades
import { guardado, num } from './util.js';

// Preferências do usuário (tema, unidades, nomes no mapa, estilo do mapa e camadas)
const PREFS_PADRAO = {
  tema: 'auto', altitude: 'ft', velocidade: 'kt', nomes: 'auto', mapa: 'auto',
  camadas: { radar: false, aeroportos: false, noite: false, rastros: false },
};
export const prefs = (() => {
  let salvo = {};
  try { salvo = JSON.parse(guardado.ler('qq-prefs') || '{}') || {}; } catch (e) { /* preferências corrompidas: usa o padrão */ }
  const p = { ...PREFS_PADRAO, ...salvo, camadas: { ...PREFS_PADRAO.camadas, ...(salvo.camadas || {}) } };
  if (!salvo.tema && guardado.ler('qq-tema')) p.tema = guardado.ler('qq-tema');
  return p;
})();
export function salvarPrefs() {
  guardado.gravar('qq-prefs', JSON.stringify(prefs));
  guardado.gravar('qq-tema', prefs.tema);   // lido no <head> para aplicar o tema sem piscar
}

// Valores formatados na unidade escolhida: [principal, secundário]
export const emAltitude = ft => prefs.altitude === 'm' ? [`${num(ft * 0.3048)} m`, `${num(ft)} ft`] : [`${num(ft)} ft`, `${num(ft * 0.3048)} m`];
export const emVelocidade = kt => prefs.velocidade === 'kmh' ? [`${num(kt * 1.852)} km/h`, `${num(kt)} kt`] : [`${num(kt)} kt`, `${num(kt * 1.852)} km/h`];
