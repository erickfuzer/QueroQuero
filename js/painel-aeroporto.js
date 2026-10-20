// Painel do aeroporto: chegadas e partidas
import { iconeForma } from './aeronaves.js';
import { CONFIG } from './config.js';
import { corAltitude } from './cores.js';
import { ativo, avioes, nomeDoVoo } from './estado.js';
import { mapa } from './mapa.js';
import { fecharPainel, medirFolha, painel, selecionado, selecionar } from './painel.js';
import { NOME_PAIS, bandeira } from './paises.js';
import { buscarRota, ehIndicativoDeCompanhia, rotaConfere, rotas } from './rotas.js';
import { $, distanciaKm, num, texto } from './util.js';

const painelAero = $('painel-aero');
export let aeroSelecionado = null;
export function abrirAeroporto(a, centralizar = false) {
  if (selecionado) fecharPainel();
  aeroSelecionado = a;
  $('dica').hidden = true;
  painelAero.hidden = false;
  document.body.classList.add('com-painel');
  texto('a-codigo', a.iata || a.icao);
  texto('a-nome', a.nome);
  texto('a-cidade', [a.cidade, `${bandeira(a.pais)} ${NOME_PAIS[a.pais] || a.pais}`.trim()].filter(Boolean).join(', '));
  texto('a-codigos', [a.iata && `IATA ${a.iata}`, `ICAO ${a.icao}`].filter(Boolean).join(' · '));
  if (centralizar) mapa.setView([a.lat, a.lon], Math.max(mapa.getZoom(), 9), { animate: false });
  medirFolha();
  preencherAeroporto();
}

export function fecharAeroporto() {
  aeroSelecionado = null;
  painelAero.hidden = true;
  if (painel.hidden) document.body.classList.remove('com-painel');
  medirFolha();
}
$('bt-fechar-aero').addEventListener('click', fecharAeroporto);

// Chegadas e partidas: voos de companhia perto do aeroporto cuja rota (que confere) liga a ele.
// Só os mais próximos têm a rota consultada, com no máximo 4 pedidos ao mesmo tempo.
let buscaDoAeroporto = 0;
export async function preencherAeroporto() {
  const a = aeroSelecionado;
  if (!a) return;
  const vez = ++buscaDoAeroporto;
  const agora = Date.now();
  const candidatos = [...avioes.values()]
    .filter(av => ativo(av, agora) && ehIndicativoDeCompanhia(av.indicativo.toUpperCase()))
    .map(av => ({ av, dist: distanciaKm(av.lat, av.lon, a.lat, a.lon) }))
    .filter(c => c.dist <= CONFIG.raioAeroporto)
    .sort((x, y) => x.dist - y.dist);
  const faltam = candidatos.filter(({ av }) => !rotas.has(av.indicativo.toUpperCase())).slice(0, CONFIG.consultasAeroporto).map(c => c.av);
  let feitas = 0;
  const desenharListas = () => {
    if (aeroSelecionado !== a) return;
    const chegando = [], saindo = [];
    for (const { av, dist } of candidatos) {
      const rota = rotas.get(av.indicativo.toUpperCase());
      if (!rotaConfere(av, rota)) continue;
      if (rota.destino.icao === a.icao) chegando.push({ av, dist, outro: rota.origem, sentido: 'de' });
      else if (rota.origem.icao === a.icao) saindo.push({ av, dist, outro: rota.destino, sentido: 'para' });
    }
    chegando.sort((x, y) => x.dist - y.dist);
    saindo.sort((x, y) => x.dist - y.dist);
    lista('a-chegando', chegando, `Nenhum voo chegando a até ${CONFIG.raioAeroporto} km`);
    lista('a-saindo', saindo, `Nenhum voo saindo a até ${CONFIG.raioAeroporto} km`);
    texto('a-n-chegando', chegando.length ? String(chegando.length) : '');
    texto('a-n-saindo', saindo.length ? String(saindo.length) : '');
    texto('a-nota', feitas < faltam.length
      ? `Consultando rotas… ${feitas} de ${faltam.length}`
      : `Voos a até ${CONFIG.raioAeroporto} km do aeroporto, com rota cadastrada no adsbdb que confere com a posição.`);
  };
  const lista = (id, itens, vazio) => {
    const ul = $(id);
    if (!itens.length) { ul.replaceChildren(Object.assign(document.createElement('li'), { className: 'vazio', textContent: vazio })); return; }
    ul.replaceChildren(...itens.map(({ av, dist, outro, sentido }) => {
      const li = document.createElement('li');
      const meio = document.createElement('div');
      meio.append(Object.assign(document.createElement('b'), { textContent: nomeDoVoo(av) }),
                  Object.assign(document.createElement('small'), { textContent: `${sentido} ${outro.iata || outro.icao} · ${outro.cidade || outro.nome || ''}` }));
      li.append(iconeForma(av.forma, corAltitude(av.alt, av.solo), 45), meio,
                Object.assign(document.createElement('span'), { className: 'a-dist', textContent: `${num(dist)} km` }));
      li.addEventListener('click', () => selecionar(av.hex, true));
      return li;
    }));
  };
  desenharListas();
  let i = 0;
  const trabalhador = async () => {
    while (i < faltam.length && aeroSelecionado === a && vez === buscaDoAeroporto) {
      await buscarRota(faltam[i++].indicativo.toUpperCase());
      feitas++;
      desenharListas();
    }
  };
  await Promise.all([1, 2, 3, 4].map(trabalhador));
  if (vez === buscaDoAeroporto) desenharListas();
}
