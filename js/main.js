// Ponto de entrada: monta a interface e começa a buscar os voos
import { ALT_SEM_LIMITE, celular } from './config.js';
import { atualizar } from './dados.js';
import { definirAltitude, filtrosMudaram } from './filtros.js';
import { aplicarCamada, aplicarTema, atualizarRelogio, localizar, montarEstilos } from './interface.js';
import { temInicio } from './mapa.js';
import { prefs } from './prefs.js';
import { $ } from './util.js';
import './desenho.js';
import './busca.js';
import './painel-aeroporto.js';
import './rotas.js';

// ───────────────────────────── Início ─────────────────────────────
const painel = $('painel');
const painelAero = $('painel-aero');
const busca = $('busca');
for (const el of [painel, painelAero, $('alcance'), $('mapas'), $('filtros'), $('prefs'), $('status'), $('radar-controle'), document.querySelector('.legenda')]) {
  L.DomEvent.disableClickPropagation(el);
  L.DomEvent.disableScrollPropagation(el);
}

const textoBusca = () => { busca.placeholder = celular.matches ? 'Voo ou aeroporto' : 'Buscar voo, matrícula ou aeroporto'; };
celular.addEventListener('change', textoBusca);
textoBusca();

montarEstilos();
aplicarTema();
filtrosMudaram();
definirAltitude(0, ALT_SEM_LIMITE);
atualizarRelogio();
Object.keys(prefs.camadas).forEach(aplicarCamada);
if (!temInicio) localizar(false);
atualizar();
