// Configuração, parâmetros da URL e consultas de mídia

export const CONFIG = {
  // Endereço do proxy publicado no Cloudflare Workers (veja proxy/worker.js e o README).
  // Também pode ser passado pela URL: index.html?proxy=https://...workers.dev
  proxy: 'https://queroquero.erickfuzer.workers.dev',
  intervalo: 10000,                 // ms entre atualizações
  raioMaximo: 250,                  // milhas náuticas (limite das APIs)
  centroPadrao: [-23.55, -46.63],   // São Paulo
  zoomPadrao: 8,
  tempoSumir: 30000,                // ms sem notícia até o avião sumir do mapa
  pontosRastro: 360,                // posições guardadas por avião (~1 h)
  raioAeroporto: 200,               // km ao redor do aeroporto para chegadas e partidas
  consultasAeroporto: 25,           // rotas novas consultadas por vez no painel do aeroporto
  validadeRota: 24 * 3600000,       // ms que uma rota fica guardada no navegador
};

export const params = new URLSearchParams(location.search);
export const PROXY = (params.get('proxy') || CONFIG.proxy).replace(/\/+$/, '');
export const ALT_SEM_LIMITE = 45000;
export const celular = window.matchMedia('(max-width: 640px)');
export const temaSistema = window.matchMedia('(prefers-color-scheme: dark)');
export const toque = window.matchMedia('(hover: none)');
