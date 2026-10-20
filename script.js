(function () {
  'use strict';

  // ───────────────────────────── Configuração ─────────────────────────────
  const CONFIG = {
    // Endereço do proxy publicado no Cloudflare Workers (veja proxy/worker.js e o README).
    // Também pode ser passado pela URL: index.html?proxy=https://...workers.dev
    proxy: 'https://queroquero.erickfuzer.workers.dev',
    intervalo: 10000,                 // ms entre atualizações
    raioMaximo: 250,                  // milhas náuticas (limite das APIs)
    centroPadrao: [-23.55, -46.63],   // São Paulo
    zoomPadrao: 8,
    tempoSumir: 30000,                // ms sem notícia até o avião sumir do mapa
    pontosRastro: 360,                // posições guardadas por avião (~1 h)
  };

  const params = new URLSearchParams(location.search);
  const PROXY = (params.get('proxy') || CONFIG.proxy).replace(/\/+$/, '');
  const ALT_SEM_LIMITE = 45000;
  const celular = window.matchMedia('(max-width: 640px)');
  const temaSistema = window.matchMedia('(prefers-color-scheme: dark)');
  const toque = window.matchMedia('(hover: none)');

  // ───────────────────────────── Utilitários ─────────────────────────────
  const $ = id => document.getElementById(id);
  const num = (n, casas = 0) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const RAD = Math.PI / 180;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // localStorage pode não existir (aba anônima, bloqueio); nada aqui é essencial
  const guardado = {
    ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } },
    gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* sem persistência */ } },
  };

  // Preferências do usuário (tema, unidades, nomes no mapa, estilo do mapa e camadas)
  const PREFS_PADRAO = {
    tema: 'auto', altitude: 'ft', velocidade: 'kt', nomes: 'auto', mapa: 'auto',
    camadas: { radar: false, aeroportos: false, noite: false, rastros: false },
  };
  const prefs = (() => {
    let salvo = {};
    try { salvo = JSON.parse(guardado.ler('qq-prefs') || '{}') || {}; } catch (e) { /* preferências corrompidas: usa o padrão */ }
    const p = { ...PREFS_PADRAO, ...salvo, camadas: { ...PREFS_PADRAO.camadas, ...(salvo.camadas || {}) } };
    if (!salvo.tema && guardado.ler('qq-tema')) p.tema = guardado.ler('qq-tema');
    return p;
  })();
  function salvarPrefs() {
    guardado.gravar('qq-prefs', JSON.stringify(prefs));
    guardado.gravar('qq-tema', prefs.tema);   // lido no <head> para aplicar o tema sem piscar
  }

  // Valores formatados na unidade escolhida: [principal, secundário]
  const emAltitude = ft => prefs.altitude === 'm' ? [`${num(ft * 0.3048)} m`, `${num(ft)} ft`] : [`${num(ft)} ft`, `${num(ft * 0.3048)} m`];
  const emVelocidade = kt => prefs.velocidade === 'kmh' ? [`${num(kt * 1.852)} km/h`, `${num(kt)} kt`] : [`${num(kt)} kt`, `${num(kt * 1.852)} km/h`];

  function distanciaKm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  const PONTOS_CARDEAIS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const cardeal = graus => PONTOS_CARDEAIS[Math.round(((graus % 360) + 360) % 360 / 22.5) % 16];

  function coordenada(valor, positivo, negativo) {
    return `${num(Math.abs(valor), 3)}° ${valor >= 0 ? positivo : negativo}`;
  }

  // ───────────────────────────── Tipos de aeronave ─────────────────────────────
  // Silhuetas vistas de cima, apontando para o norte, num quadro de -16 a 16.
  // O mesmo traçado vira Path2D no mapa e <path> nos ícones da interface.
  // Cada silhueta é geométrica (retas nas asas, curvas suaves no nariz, naceles e cauda) e segue
  // as medidas publicadas do modelo de referência: comprimento, envergadura, largura da fuselagem,
  // posição da asa, dos motores e da empenagem. O Gripen foi traçado sobre foto de cima da Saab.
  // Todas formam um contorno único, sem naceles sobrepostas.
  const FORMAS = {
    comercial: {  // A320
      nome: 'Jato comercial', escala: 0.85,
      d: 'M-4.97 -6.73L-5.19 -6.65L-5.37 -6.52L-5.51 -6.35L-5.6 -6.16L-5.63 -5.96L-5.63 -4.1L-5.32 -2.96L-4.88 -2.96L-14.52 2.32L-14.77 2.57L-14.77 3.64L-5.12 0.51L-1.63 0.35L-1.63 5.16L-1.58 6.51L-1.52 7.41L-1.38 8.76L-1.06 10.95L-5.13 13.3L-5.13 14.45L-0.42 14.53L-0.26 15.5L0.26 15.5L0.42 14.53L5.13 14.45L5.13 13.3L1.06 10.95L1.38 8.76L1.52 7.41L1.58 6.51L1.63 5.16L1.63 0.35L5.12 0.51L14.77 3.64L14.77 2.57L14.52 2.32L4.88 -2.96L5.32 -2.96L5.63 -4.1L5.62 -6.06L5.56 -6.26L5.45 -6.44L5.19 -6.65L4.97 -6.73L4.74 -6.75L4.41 -6.69L4.2 -6.59L4.04 -6.44L3.89 -6.16L3.86 -5.96L3.86 -4.1L4.04 -3.42L1.63 -4.74L1.63 -11.21L1.57 -12.28L1.43 -13.18L1.3 -13.71L1.18 -14.07L1.03 -14.43L0.85 -14.78L0.59 -15.14L0.41 -15.32L0 -15.5L-0.41 -15.32L-0.59 -15.14L-0.85 -14.78L-1.11 -14.25L-1.3 -13.71L-1.47 -13L-1.57 -12.28L-1.63 -11.39L-1.63 -4.74L-4.04 -3.42L-3.86 -4.1L-3.86 -5.96L-3.89 -6.16L-4.04 -6.44L-4.3 -6.65L-4.63 -6.75Z',
    },
    pesado: {  // 777-300ER
      nome: 'Grande porte', escala: 0.95,
      d: 'M-4.28 -6.08L-4.57 -5.95L-4.72 -5.82L-4.82 -5.65L-4.88 -5.46L-4.89 -3.64L-4.6 -2.58L-4.57 -2.58L-11.96 2.37L-13.59 4.47L-13.38 4.8L-4.82 0.69L-1.3 0.61L-1.29 7.08L-1.21 8.61L-0.99 10.57L-4.49 13.11L-4.49 14.03L-0.41 14.11L-0.19 15.5L0.19 15.5L0.41 14.11L4.49 14.03L4.49 13.11L0.99 10.57L1.21 8.61L1.29 7.08L1.3 0.61L4.82 0.69L13.38 4.8L13.59 4.47L11.96 2.37L4.57 -2.58L4.6 -2.58L4.89 -3.64L4.89 -5.37L4.86 -5.56L4.78 -5.74L4.57 -5.95L4.28 -6.08L4.07 -6.1L3.86 -6.08L3.57 -5.95L3.42 -5.82L3.31 -5.65L3.25 -5.37L3.25 -3.64L3.31 -3.43L1.3 -4.77L1.3 -11.68L1.27 -12.35L1.22 -12.84L1.14 -13.34L1.03 -13.84L0.89 -14.34L0.76 -14.67L0.59 -15L0.33 -15.33L0 -15.5L-0.33 -15.33L-0.59 -15L-0.76 -14.67L-0.89 -14.34L-1.03 -13.84L-1.14 -13.34L-1.22 -12.84L-1.27 -12.35L-1.3 -11.68L-1.3 -4.77L-3.31 -3.43L-3.25 -3.64L-3.25 -5.37L-3.28 -5.56L-3.42 -5.82L-3.66 -6L-3.96 -6.1Z',
    },
    jumbo: {  // 747-400
      nome: 'Quadrimotor de grande porte', escala: 1,
      d: 'M-5.42 -3.95L-5.56 -3.88L-5.67 -3.78L-5.75 -3.65L-5.79 -3.51L-5.8 -1.97L-5.7 -1.57L-8.67 0.92L-8.68 -0.11L-8.72 -0.24L-8.79 -0.36L-8.9 -0.46L-9.04 -0.53L-9.26 -0.57L-9.49 -0.53L-9.68 -0.41L-9.81 -0.24L-9.86 -0.04L-9.86 1.4L-9.75 1.82L-14.14 5.49L-14.23 5.84L-14.14 7.16L-4.74 1.45L-1.43 1.02L-1.43 5.58L-1.4 6.82L-1.28 8.47L-1.02 10.53L-4.87 13.3L-4.87 14.36L-0.31 14.62L-0.18 15.5L0.18 15.5L0.31 14.62L4.87 14.36L4.87 13.3L1.02 10.53L1.28 8.47L1.4 6.82L1.43 5.58L1.43 1.02L4.74 1.45L14.14 7.16L14.23 5.84L14.14 5.49L9.75 1.82L9.86 1.4L9.86 -0.04L9.81 -0.24L9.68 -0.41L9.49 -0.53L9.26 -0.57L9.04 -0.53L8.9 -0.46L8.79 -0.36L8.72 -0.24L8.68 -0.11L8.67 0.92L5.7 -1.57L5.8 -1.97L5.8 -3.44L5.75 -3.65L5.62 -3.83L5.42 -3.95L5.18 -4L5.02 -3.98L4.87 -3.92L4.69 -3.78L4.61 -3.65L4.57 -3.51L4.57 -2.51L1.43 -5.13L1.43 -11.5L1.37 -12.55L1.24 -13.41L1.01 -14.28L0.87 -14.63L0.69 -14.98L0.57 -15.15L0.41 -15.33L0 -15.5L-0.41 -15.33L-0.57 -15.15L-0.79 -14.8L-0.94 -14.46L-1.11 -13.94L-1.27 -13.24L-1.38 -12.37L-1.43 -11.5L-1.43 -5.13L-4.57 -2.51L-4.57 -3.44L-4.59 -3.59L-4.65 -3.72L-4.81 -3.88L-5.02 -3.98L-5.18 -4Z',
    },
    cargueiro: {  // KC-390
      nome: 'Transporte militar', escala: 0.9,
      d: 'M-5.1 -9.13L-5.22 -9.09L-5.45 -8.97L-5.63 -8.81L-5.76 -8.61L-5.83 -8.38L-5.83 -5.83L-5.72 -5.38L-15.41 0L-15.5 0.35L-15.5 1.41L-2.82 -1.2L-2.86 -1.06L-2.64 0.88L-2.08 2.11L-2.07 5.2L-2.04 6.1L-1.97 6.99L-1.86 7.89L-1.65 9.23L-1.47 10.13L-1.19 11.37L-4.93 13.91L-5.06 14.09L-5.06 14.93L-0.54 13.81L-0.09 15.5L0.09 15.5L0.54 13.81L5.06 14.93L5.06 14.09L4.93 13.91L1.19 11.37L1.47 10.13L1.65 9.23L1.86 7.89L1.97 6.99L2.04 6.1L2.07 5.2L2.08 2.11L2.64 0.88L2.86 -1.06L2.82 -1.2L15.5 1.41L15.5 0.35L15.41 0L5.72 -5.38L5.83 -5.83L5.83 -8.38L5.76 -8.61L5.7 -8.71L5.54 -8.9L5.34 -9.04L5.1 -9.13L4.97 -9.15L4.84 -9.16L4.59 -9.13L4.46 -9.09L4.24 -8.97L4.14 -8.9L3.99 -8.71L3.89 -8.5L3.85 -8.27L3.85 -6.41L2.08 -7.4L2.08 -9.09L2.03 -9.92L1.9 -11.04L1.68 -12.15L1.34 -13.27L1.12 -13.83L0.85 -14.38L0.53 -14.94L0.32 -15.22L0 -15.5L-0.32 -15.22L-0.53 -14.94L-0.85 -14.38L-1.12 -13.83L-1.34 -13.27L-1.68 -12.15L-1.9 -11.04L-2.03 -9.92L-2.08 -9.09L-2.08 -7.4L-3.85 -6.41L-3.85 -8.27L-3.89 -8.5L-3.93 -8.61L-3.99 -8.71L-4.14 -8.9L-4.24 -8.97L-4.46 -9.09L-4.59 -9.13L-4.84 -9.16Z',
    },
    caca: {  // F-39 Gripen F, traçado sobre foto de cima da Saab
      nome: 'Caça', escala: 0.85,
      d: 'M-0.28 -14.74L-0.49 -13.84L-0.69 -12.45L-0.94 -8.63L-0.97 -6.69L-4.65 -1.63L-4.65 -0.45L-2.15 -1.42L-1.46 -1.21L-1.46 -0.45L-8.18 5.93L-8.18 3.71L-8.67 3.71L-8.67 10.92L-8.18 10.92L-8.18 9.05L-4.85 9.54L-1.73 10.16L-1.46 11.48L-1.25 12.17L-0.69 14.81L-0.49 15.29L-0.24 15.5L0.24 15.5L0.49 15.29L0.69 14.81L1.25 12.17L1.46 11.48L1.73 10.16L4.85 9.54L8.18 9.05L8.18 10.92L8.67 10.92L8.67 3.71L8.18 3.71L8.18 5.93L1.46 -0.45L1.46 -1.21L2.15 -1.42L4.65 -0.45L4.65 -1.63L0.97 -6.69L0.94 -8.63L0.69 -12.45L0.49 -13.84L0.28 -14.74L0 -15.5Z',
    },
    turboelice: {  // ATR 72-600
      nome: 'Regional turboélice', escala: 0.85,
      d: 'M-5.21 -6.03L-5.31 -5.88L-5.36 -5.64L-5.36 -3.28L-15.4 -2.95L-15.44 -1.35L-5.34 -0.69L-5.02 1.5L-4.34 1.5L-4.03 -0.6L-1.64 -0.44L-1.63 4.38L-1.56 6.31L-1.49 7.28L-1.35 8.73L-1.16 10.18L-0.89 12L-4.16 12.68L-4.16 13.94L-0.56 14.04L-0.34 15.5L0.34 15.5L0.56 14.04L4.16 13.94L4.16 12.68L0.89 12L1.16 10.18L1.35 8.73L1.49 7.28L1.56 6.31L1.63 4.38L1.64 -0.44L4.03 -0.6L4.34 1.5L5.02 1.5L5.34 -0.69L15.44 -1.35L15.4 -2.95L5.36 -3.28L5.36 -5.64L5.31 -5.88L5.21 -6.03L6.9 -6.03L6.9 -6.43L2.45 -6.43L2.45 -6.03L4.15 -6.03L4.05 -5.88L3.99 -5.64L3.99 -3.33L1.64 -3.4L1.64 -11.39L1.61 -12.08L1.55 -12.59L1.42 -13.28L1.28 -13.79L1.08 -14.3L0.91 -14.64L0.69 -14.99L0.36 -15.33L0 -15.5L-0.36 -15.33L-0.69 -14.99L-0.91 -14.64L-1.08 -14.3L-1.28 -13.79L-1.42 -13.28L-1.55 -12.59L-1.61 -12.08L-1.64 -11.39L-1.64 -3.4L-3.99 -3.33L-3.99 -5.64L-4.05 -5.88L-4.15 -6.03L-2.45 -6.03L-2.45 -6.43L-6.9 -6.43L-6.9 -6.03Z',
    },
    executivo: {  // Phenom 300
      nome: 'Jato executivo', escala: 0.8,
      d: 'M-0.62 -14.2L-0.97 -13.43L-1.29 -12.41L-1.51 -11.39L-1.65 -10.37L-1.72 -9.1L-1.72 -3.1L-15.5 1.88L-15.5 3.79L-1.72 1.88L-1.72 3.32L-1.91 3.08L-2.1 2.95L-2.34 2.86L-2.71 2.84L-2.95 2.9L-3.17 3.01L-3.26 3.08L-3.41 3.26L-3.51 3.47L-3.54 3.69L-3.54 7.39L-3.25 9.34L-1.91 9.34L-1.63 7.39L-1.63 6.24L-1.45 8.22L-1.19 10.34L-5.74 12.78L-5.74 14.12L-0.7 13.4L-0.42 14.96L0.42 14.96L0.7 13.4L5.74 14.12L5.74 12.78L1.19 10.34L1.45 8.22L1.63 6.24L1.63 7.39L1.91 9.34L3.25 9.34L3.54 7.39L3.54 3.69L3.51 3.47L3.41 3.26L3.26 3.08L3.17 3.01L2.95 2.9L2.71 2.84L2.34 2.86L2.1 2.95L1.91 3.08L1.72 3.32L1.72 1.88L15.5 3.79L15.5 1.88L1.72 -3.1L1.71 -9.35L1.62 -10.63L1.41 -11.9L1.22 -12.67L0.97 -13.43L0.62 -14.2L0.3 -14.71L0 -14.96L-0.3 -14.71Z',
    },
    leve: {  // Cessna 172
      nome: 'Aviação leve', escala: 0.8,
      d: 'M-2.68 -11.33L-0.51 -11.33L-1.18 -10.65L-1.41 -8.96L-1.58 -6.99L-1.58 -6.28L-15.08 -6.09L-15.44 -5.72L-15.5 -4.31L-15.36 -3.1L-14.94 -2.87L-7.33 -1.69L-1.58 -1.69L-0.62 8.51L-4.88 9.07L-4.88 11.19L-0.51 11.61L-0.34 11.84L0.34 11.84L0.51 11.61L4.88 11.19L4.88 9.07L0.62 8.51L1.58 -1.69L7.33 -1.69L14.94 -2.87L15.36 -3.1L15.5 -4.31L15.44 -5.72L15.08 -6.09L1.58 -6.28L1.58 -6.99L1.41 -8.96L1.18 -10.65L0.51 -11.33L2.68 -11.33L2.68 -11.84L-2.68 -11.84Z',
    },
    helicoptero: {  // AS350 Esquilo
      nome: 'Helicóptero', escala: 0.9, rotor: 3,
      d: 'M-0.57 -7.73L-0.8 -7.61L-0.97 -7.49L-1.23 -7.26L-1.42 -7.02L-1.57 -6.79L-1.74 -6.43L-1.92 -5.84L-1.98 -5.49L-2 -5.13L-2.01 -0.87L-1.53 0.87L-0.7 2.4L-0.44 3.92L-0.35 10.14L-2.83 10.25L-2.83 11.45L-0.35 11.55L-0.33 14.61L-0.65 14.82L-0.65 15.98L0.65 15.98L0.65 14.82L0.33 14.61L0.35 11.55L2.83 11.45L2.83 10.25L0.35 10.14L0.44 3.92L0.7 2.4L1.53 0.87L2.01 -0.87L2 -5.25L1.92 -5.84L1.74 -6.43L1.49 -6.9L1.33 -7.14L1.11 -7.38L0.8 -7.61L0.57 -7.73L0 -7.85Z',
    },
    helicoptero_militar: {  // UH-60 Black Hawk
      nome: 'Helicóptero militar', escala: 0.95, rotor: 4,
      d: 'M-0.41 -6.28L-0.74 -6.01L-0.98 -5.74L-1.18 -5.47L-1.43 -5.07L-1.74 -4.4L-1.86 -4L-1.93 -3.6L-1.97 -3.07L-1.97 4.38L-1.9 4.75L-1.53 5.04L-1.02 5.29L-0.73 5.62L-0.64 6.13L-0.28 11.68L-0.23 12.63L-3.2 12.78L-3.2 13.72L-0.23 14.09L-0.32 16L0.32 16L0.23 14.09L3.2 13.72L3.2 12.78L0.23 12.63L0.28 11.68L0.64 6.13L0.73 5.62L1.02 5.29L1.53 5.04L1.9 4.75L1.97 4.38L1.97 -3.2L1.89 -3.87L1.74 -4.4L1.43 -5.07L1.08 -5.61L0.74 -6.01L0.41 -6.28Z',
    },
    planador: {
      nome: 'Planador', escala: 0.8,
      d: 'M-0.79 0.17L-0.38 4L-0.32 5.67L-2.89 5.86L-2.89 7.1L-0.1 7.36L-0.1 7.1L0.1 7.1L0.1 7.36L2.89 7.1L2.89 5.86L0.32 5.67L0.38 4L0.79 0.17L15.5 -0.8L15.5 -2.2L1.02 -2.6L1.01 -4.92L0.91 -5.78L0.72 -6.52L0.46 -7.05L0.16 -7.33L0 -7.36L-0.16 -7.33L-0.46 -7.05L-0.72 -6.52L-0.91 -5.78L-1.01 -4.92L-1.02 -2.6L-15.5 -2.2L-15.5 -0.8Z',
    },
    drone: {
      nome: 'Drone', escala: 0.75,
      d: 'M-1.07 0.91L-0.71 5.06L-4.03 6.86L-4.03 8.49L-2.33 7.99L-2.33 8.33L2.33 8.33L2.33 7.99L4.03 8.49L4.03 6.86L0.71 5.06L1.07 0.91L15.5 0L15.5 -1.51L1.21 -1.96L1.21 -6.16L1.15 -6.88L0.98 -7.53L0.71 -8.04L0.37 -8.37L0 -8.49L-0.37 -8.37L-0.71 -8.04L-0.98 -7.53L-1.15 -6.88L-1.21 -6.16L-1.21 -1.96L-15.5 -1.51L-15.5 0Z',
    },
    balao: {
      nome: 'Balão', escala: 0.6, semRumo: true,
      d: 'M0 -11A8.5 8.5 0 1 1 -0.01 -11ZM-2.5 7.5L2.5 7.5L2.5 11L-2.5 11Z',
    },
    veiculo: {
      nome: 'Veículo em solo', escala: 0.6,
      d: 'M-4.5 -7L4.5 -7L4.5 7L-4.5 7Z',
    },
  };
  for (const f of Object.values(FORMAS)) f.caminho = new Path2D(f.d);

  // Grupos do filtro por tipo
  const GRUPOS = [
    { id: 'comercial', nome: 'Linhas aéreas', forma: 'comercial' },
    { id: 'executivo', nome: 'Regional e executivo', forma: 'executivo' },
    { id: 'leve', nome: 'Aviação leve', forma: 'leve' },
    { id: 'helicoptero', nome: 'Helicópteros', forma: 'helicoptero' },
    { id: 'militar', nome: 'Militares', forma: 'caca' },
    { id: 'outros', nome: 'Outros', forma: 'planador' },
  ];

  // Modelos (designador ICAO) para quando a categoria não vem ou não basta
  const lista = s => new Set(s.split(' '));
  const HELICOPTEROS = lista('R22 R44 R66 AS50 AS55 AS65 AS32 AS3B EC20 EC25 EC30 EC35 EC45 EC55 EC75 H160 B06 B06T B206 B407 B412 B429 B505 B212 S76 S92 S61 A109 A119 A139 A169 A189 BK17 H60 S70 UH1 H500 MD52 MD60 NH90 H47 H64');
  const HELICOPTEROS_MILITARES = lista('H60 S70 UH1 H47 H64');
  const QUADRIMOTORES = lista('A388 B741 B742 B743 B744 B748 B74S A342 A343 A345 A346 IL96 A124 C5M');
  const GRANDES = lista('A306 A30B A310 A332 A333 A338 A339 A359 A35K B762 B763 B764 B772 B773 B77L B77W B778 B779 B788 B789 B78X MD11');
  const CARGUEIROS = lista('C130 C30J E390 KC39 A400 C295 CN35 C27J C160 AN12 AN26 AN32 IL76 C17');
  const TURBOELICES = lista('AT43 AT44 AT45 AT46 AT72 AT73 AT75 AT76 DH8A DH8B DH8C DH8D E110 E120 SF34 JS31 JS32 JS41 D328 B190 F50 L410 C212');
  const CACAS = lista('F5 F15 F16 F18H F18S F22 F35 EUFI RFAL T38 A10 HAWK L39');
  // Jatos executivos leves: o transponder costuma informar categoria A1 (leve), mas são jatos
  const JATOS_EXECUTIVOS = lista('C500 C501 C510 C525 C25A C25B C25C C25M C550 C560 C56X C680 C68A C700 C750 E50P E55P E545 E550 HDJT EA50 SF50 PC24 LJ31 LJ35 LJ40 LJ45 LJ60 LJ75 PRM1 BE40 H25B G150 G280 CL30 CL35 FA10 FA20 FA50 F900 F2TH FA7X GLF4 GLF5 GLF6 GLEX GL5T GL7T');
  const FABRICANTES_LEVES = /\b(CESSNA|PIPER|BEECH|CIRRUS|DIAMOND|MOONEY|TECNAM|ROBIN|SOCATA|NEIVA|AERO BOERO|EXTRA|VANS|GRUMMAN AMERICAN)\b/i;

  function classificar(a) {
    const tipo = (a.t || '').toUpperCase();
    const cat = a.category || '';
    const militar = (a.dbFlags & 1) === 1;
    let forma;
    if (cat === 'A7' || HELICOPTEROS.has(tipo)) forma = militar || HELICOPTEROS_MILITARES.has(tipo) ? 'helicoptero_militar' : 'helicoptero';
    else if (cat === 'A6' || CACAS.has(tipo)) forma = 'caca';
    else if (CARGUEIROS.has(tipo)) forma = 'cargueiro';
    else if (QUADRIMOTORES.has(tipo)) forma = 'jumbo';
    else if (cat === 'A5' || GRANDES.has(tipo)) forma = 'pesado';
    else if (TURBOELICES.has(tipo)) forma = 'turboelice';
    else if (JATOS_EXECUTIVOS.has(tipo)) forma = 'executivo';
    else if (cat === 'A3' || cat === 'A4') forma = 'comercial';
    else if (cat === 'A2') forma = 'executivo';
    else if (cat === 'A1' || cat === 'B4') forma = 'leve';
    else if (cat === 'B1') forma = 'planador';
    else if (cat === 'B2') forma = 'balao';
    else if (cat === 'B6') forma = 'drone';
    else if (/^C\d$/.test(cat)) forma = 'veiculo';
    // Sem categoria: tenta pelo fabricante; se não der, usa a silhueta padrão
    else if (FABRICANTES_LEVES.test(a.desc || '')) forma = 'leve';
    else forma = 'comercial';
    const grupo = militar ? 'militar'
      : {
        comercial: 'comercial', pesado: 'comercial', jumbo: 'comercial', cargueiro: 'comercial',
        turboelice: 'executivo', executivo: 'executivo', leve: 'leve',
        helicoptero: 'helicoptero', helicoptero_militar: 'helicoptero', caca: 'militar',
      }[forma] || 'outros';
    const conhecido = [HELICOPTEROS, CACAS, CARGUEIROS, QUADRIMOTORES, GRANDES, TURBOELICES, JATOS_EXECUTIVOS].some(l => l.has(tipo));
    return { forma, grupo, militar, semCategoria: !cat && !conhecido && !FABRICANTES_LEVES.test(a.desc || '') };
  }

  // Ícone SVG de uma forma (busca, filtros e painel)
  function iconeForma(forma, cor, angulo = 0) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-16 -16 32 32');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', FORMAS[forma].d);
    path.setAttribute('fill', cor);
    path.setAttribute('stroke', 'rgba(0, 0, 0, 0.5)');
    path.setAttribute('stroke-width', '1');
    if (angulo) path.setAttribute('transform', `rotate(${angulo})`);
    svg.append(path);
    const pas = FORMAS[forma].rotor || 0;
    if (pas) {
      const disco = document.createElementNS(SVG_NS, 'circle');
      disco.setAttribute('r', '12.5');
      disco.setAttribute('fill', cor);
      disco.setAttribute('stroke', 'none');
      disco.setAttribute('opacity', '0.18');
      svg.prepend(disco);
    }
    for (let i = 0; i < pas; i++) {
      const pa = document.createElementNS(SVG_NS, 'path');
      pa.setAttribute('d', 'M0 -1.2H12.5V1.2H0Z');
      pa.setAttribute('fill', cor);
      pa.setAttribute('stroke', 'rgba(0, 0, 0, 0.5)');
      pa.setAttribute('stroke-width', '1');
      pa.setAttribute('opacity', '0.65');
      pa.setAttribute('transform', `rotate(${angulo + 30 + (i * 360) / pas})`);
      svg.append(pa);
    }
    return svg;
  }

  // ───────────────────────────── Cores e tema ─────────────────────────────
  // Escala de cores por altitude (pés), uma para cada fundo
  const ESCALAS = {
    escuro: [
      [0, [255, 107, 74]], [5000, [255, 162, 58]], [10000, [255, 216, 74]], [20000, [126, 224, 108]],
      [30000, [63, 208, 224]], [40000, [138, 125, 255]], [45000, [199, 125, 255]],
    ],
    claro: [
      [0, [232, 89, 12]], [5000, [240, 140, 0]], [10000, [214, 168, 0]], [20000, [47, 158, 68]],
      [30000, [16, 152, 173]], [40000, [95, 61, 196]], [45000, [156, 54, 181]],
    ],
  };
  const COR_SOLO = { escuro: 'rgb(125, 133, 144)', claro: 'rgb(120, 128, 140)' };

  let tema = document.documentElement.getAttribute('data-tema') || 'escuro';   // tema da interface
  let paleta = tema;                                                          // cores do desenho, conforme o fundo do mapa

  function corAltitude(alt, solo) {
    if (solo) return COR_SOLO[paleta];
    if (alt == null) return paleta === 'escuro' ? 'rgb(200, 200, 200)' : 'rgb(110, 110, 110)';
    const escala = ESCALAS[paleta];
    for (let i = 1; i < escala.length; i++) {
      const [a1, c1] = escala[i - 1], [a2, c2] = escala[i];
      if (alt <= a2) {
        const k = limitar((alt - a1) / (a2 - a1), 0, 1);
        return `rgb(${c1.map((c, j) => Math.round(c + (c2[j] - c) * k)).join(', ')})`;
      }
    }
    return `rgb(${escala[escala.length - 1][1].join(', ')})`;
  }

  // Cores do desenho no canvas que mudam com o tema
  const TINTAS = {
    escuro: { contorno: 'rgba(0, 0, 0, 0.7)', halo: 'rgba(224, 87, 77, 0.95)', haloFundo: 'rgba(224, 87, 77, 0.16)', mouse: 'rgba(255, 255, 255, 0.1)',
              militar: 'rgba(255, 255, 255, 0.95)', texto: 'rgba(232, 230, 225, 0.88)', textoForte: '#ffffff', textoFundo: 'rgba(21, 24, 28, 0.9)', icone: '#e8e6e1' },
    claro: { contorno: 'rgba(0, 0, 0, 0.55)', halo: 'rgba(200, 56, 47, 0.95)', haloFundo: 'rgba(200, 56, 47, 0.1)', mouse: 'rgba(28, 31, 35, 0.07)',
             militar: 'rgba(28, 31, 35, 0.95)', texto: 'rgba(28, 31, 35, 0.85)', textoForte: '#1c1f23', textoFundo: 'rgba(255, 255, 255, 0.92)', icone: '#1c1f23' },
  };
  TINTAS.escuro.aeroporto = '#e8e6e1'; TINTAS.escuro.aeroportoFundo = 'rgba(21, 24, 28, 0.9)';
  TINTAS.claro.aeroporto = '#1c1f23'; TINTAS.claro.aeroportoFundo = 'rgba(255, 255, 255, 0.95)';

  // ───────────────────────────── Mapa ─────────────────────────────
  const inicio = (params.get('c') || '').split(',').map(Number);
  const temInicio = inicio.length === 3 && inicio.every(Number.isFinite);

  const mapa = L.map('mapa', {
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
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const linkEsri = '<a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>';
  const linkOsm = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  const ESTILOS = {
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
  function camadaBase(id) {
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
  function localizar(pedidoDoUsuario) {
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

  // ───────────────────────────── Tema e estilo do mapa ─────────────────────────────
  function aplicarTema() {
    tema = prefs.tema === 'auto' ? (temaSistema.matches ? 'escuro' : 'claro') : prefs.tema;
    document.documentElement.setAttribute('data-tema', tema);
    document.querySelector('meta[name="theme-color"]').content = tema === 'escuro' ? '#15181c' : '#ffffff';
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
    paleta = ESTILOS[id].paleta;
    mapa.getContainer().classList.toggle('mapa-escurecido', !!ESTILOS[id].escurecer);
    const escala = ESCALAS[paleta].map(([alt, c]) => `rgb(${c.join(', ')}) ${(alt / ALT_SEM_LIMITE) * 100}%`).join(', ');
    document.documentElement.style.setProperty('--escala', `linear-gradient(90deg, ${escala})`);
    document.querySelectorAll('#estilos .estilo').forEach(b => b.setAttribute('aria-checked', String(b.dataset.estilo === prefs.mapa)));
    if (selecionado) preencherPainel();
  }

  // ───────────────────────────── Avisos ─────────────────────────────
  let avisoTimer = null;
  function mostrarAviso(texto, tipo = '', duracao = 0) {
    const el = $('aviso');
    el.textContent = texto;
    el.className = 'aviso ' + tipo;
    el.hidden = false;
    clearTimeout(avisoTimer);
    if (duracao) avisoTimer = setTimeout(esconderAviso, duracao);
  }
  function esconderAviso() { $('aviso').hidden = true; }

  // País de registro pelo endereço ICAO de 24 bits (faixas alocadas pela ICAO)
  const PAISES = [
    [0x008000, 0x00FFFF, 'ZA', 'África do Sul'], [0x010000, 0x017FFF, 'EG', 'Egito'],
    [0x020000, 0x027FFF, 'MA', 'Marrocos'], [0x040000, 0x040FFF, 'ET', 'Etiópia'],
    [0x06A000, 0x06AFFF, 'QA', 'Catar'], [0x0AC000, 0x0ACFFF, 'CO', 'Colômbia'],
    [0x0C2000, 0x0C2FFF, 'PA', 'Panamá'], [0x0D0000, 0x0D7FFF, 'MX', 'México'],
    [0x0D8000, 0x0DFFFF, 'VE', 'Venezuela'], [0x100000, 0x1FFFFF, 'RU', 'Rússia'],
    [0x300000, 0x33FFFF, 'IT', 'Itália'], [0x340000, 0x37FFFF, 'ES', 'Espanha'],
    [0x380000, 0x3BFFFF, 'FR', 'França'], [0x3C0000, 0x3FFFFF, 'DE', 'Alemanha'],
    [0x400000, 0x43FFFF, 'GB', 'Reino Unido'], [0x440000, 0x447FFF, 'AT', 'Áustria'],
    [0x448000, 0x44FFFF, 'BE', 'Bélgica'], [0x458000, 0x45FFFF, 'DK', 'Dinamarca'],
    [0x460000, 0x467FFF, 'FI', 'Finlândia'], [0x478000, 0x47FFFF, 'NO', 'Noruega'],
    [0x480000, 0x487FFF, 'NL', 'Países Baixos'], [0x488000, 0x48FFFF, 'PL', 'Polônia'],
    [0x490000, 0x497FFF, 'PT', 'Portugal'], [0x4A8000, 0x4AFFFF, 'SE', 'Suécia'],
    [0x4B0000, 0x4B7FFF, 'CH', 'Suíça'], [0x4B8000, 0x4BFFFF, 'TR', 'Turquia'],
    [0x4CA000, 0x4CAFFF, 'IE', 'Irlanda'], [0x4CC000, 0x4CCFFF, 'IS', 'Islândia'],
    [0x4D0000, 0x4D03FF, 'LU', 'Luxemburgo'], [0x710000, 0x717FFF, 'SA', 'Arábia Saudita'],
    [0x718000, 0x71FFFF, 'KR', 'Coreia do Sul'], [0x738000, 0x73FFFF, 'IL', 'Israel'],
    [0x768000, 0x76FFFF, 'SG', 'Singapura'], [0x780000, 0x7BFFFF, 'CN', 'China'],
    [0x7C0000, 0x7FFFFF, 'AU', 'Austrália'], [0x800000, 0x83FFFF, 'IN', 'Índia'],
    [0x840000, 0x87FFFF, 'JP', 'Japão'], [0x896000, 0x896FFF, 'AE', 'Emirados Árabes'],
    [0xA00000, 0xAFFFFF, 'US', 'Estados Unidos'], [0xC00000, 0xC3FFFF, 'CA', 'Canadá'],
    [0xC80000, 0xC87FFF, 'NZ', 'Nova Zelândia'], [0xE00000, 0xE3FFFF, 'AR', 'Argentina'],
    [0xE40000, 0xE7FFFF, 'BR', 'Brasil'], [0xE80000, 0xE80FFF, 'CL', 'Chile'],
    [0xE84000, 0xE84FFF, 'EC', 'Equador'], [0xE88000, 0xE88FFF, 'PY', 'Paraguai'],
    [0xE8C000, 0xE8CFFF, 'PE', 'Peru'], [0xE90000, 0xE90FFF, 'UY', 'Uruguai'],
    [0xE94000, 0xE94FFF, 'BO', 'Bolívia'],
  ];
  function paisDoHex(hex) {
    const n = parseInt(hex, 16);
    const p = PAISES.find(([ini, fim]) => n >= ini && n <= fim);
    if (!p) return null;
    const bandeira = String.fromCodePoint(...[...p[2]].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    return `${bandeira} ${p[3]}`;
  }

  // ───────────────────────────── Estado dos aviões ─────────────────────────────
  const avioes = new Map();     // hex → dados do avião
  let selecionado = null;
  let altMin = 0, altMax = ALT_SEM_LIMITE;
  const gruposOcultos = new Set();
  let situacao = 'todos';          // todos, ar ou solo
  let soEmergencia = false;
  const companhiasSel = new Set(); // prefixos ICAO marcados (vazio = todas)

  const EMERGENCIAS = { 7500: 'Interferência ilícita', 7600: 'Falha de rádio', 7700: 'Emergência' };

  // Companhia pelo prefixo ICAO do indicativo (GLO1234 → GLO)
  const prefixo = av => /^[A-Z]{3}\d/.test(av.indicativo) ? av.indicativo.slice(0, 3) : null;
  const COMPANHIAS = {
    GLO: 'Gol', TAM: 'LATAM Brasil', AZU: 'Azul', PTB: 'Voepass', TTL: 'Total', MWM: 'Modern Logistics', SID: 'Sideral',
    LAN: 'LATAM Chile', LPE: 'LATAM Peru', ARG: 'Aerolíneas Argentinas', AVA: 'Avianca', CMP: 'Copa', JAT: 'JetSMART',
    SKU: 'Sky Airline', BOV: 'Boliviana', AAL: 'American', UAL: 'United', DAL: 'Delta', ACA: 'Air Canada', AMX: 'Aeroméxico',
    AFR: 'Air France', KLM: 'KLM', DLH: 'Lufthansa', BAW: 'British Airways', IBE: 'Iberia', TAP: 'TAP', AEA: 'Air Europa',
    ITY: 'ITA Airways', SWR: 'Swiss', UAE: 'Emirates', QTR: 'Qatar Airways', ETH: 'Ethiopian', THY: 'Turkish Airlines',
    SAA: 'South African', RAM: 'Royal Air Maroc', FDX: 'FedEx', UPS: 'UPS', GTI: 'Atlas Air', CLX: 'Cargolux',
    FAB: 'Força Aérea Brasileira',
  };
  const nomesCompanhia = new Map();  // prefixo → nome vindo do adsbdb, para os que não estão na tabela
  const nomeCompanhia = pre => COMPANHIAS[pre] || nomesCompanhia.get(pre) || pre;

  // Posição estimada pelo deslocamento desde o último dado (velocidade e rumo constantes)
  function estimar(av, agora) {
    const dt = limitar((agora - av.t) / 1000, 0, 60);
    const d = av.gs * 0.514444 * dt;                 // nós → m/s × s
    const r = av.rumo * RAD;
    return {
      lat: av.lat + (d * Math.cos(r)) / 111320,
      lon: av.lon + (d * Math.sin(r)) / (111320 * Math.cos(av.lat * RAD)),
      ang: av.rumo,
    };
  }

  // Posição desenhada: a estimativa mais uma correção que some aos poucos,
  // para o avião deslizar até o dado novo em vez de pular
  function posicaoExibida(av, agora) {
    const p = estimar(av, agora);
    const tr = av.transicao;
    if (tr) {
      const k = limitar((agora - tr.t0) / 1500, 0, 1);
      const resto = (1 - k) ** 3;
      p.lat += tr.dLat * resto;
      p.lon += tr.dLon * resto;
      p.ang += tr.dAng * resto;
      if (k >= 1) av.transicao = null;
    }
    return p;
  }

  function receber(lista) {
    const agora = Date.now();
    for (const a of lista) {
      if (typeof a.lat !== 'number' || !a.hex) continue;
      const hex = a.hex.toLowerCase();
      const solo = a.alt_baro === 'ground';
      const alt = solo ? 0 : (typeof a.alt_baro === 'number' ? a.alt_baro : (typeof a.alt_geom === 'number' ? a.alt_geom : null));
      const t = agora - (a.seen_pos || 0) * 1000;

      let av = avioes.get(hex);
      const antes = av ? posicaoExibida(av, agora) : null;
      if (!av) {
        av = { hex, rastro: [], transicao: null };
        avioes.set(hex, av);
      }
      Object.assign(av, classificar(a), {
        indicativo: (a.flight || '').replace(/@/g, '').trim(),
        matricula: (a.r || '').trim(),
        tipo: a.t || '',
        descricao: a.desc || '',
        squawk: a.squawk || '',
        alt, solo,
        gs: a.gs || 0,
        rumo: a.track ?? a.true_heading ?? av.rumo ?? 0,
        vertical: a.baro_rate ?? a.geom_rate ?? null,
        lat: a.lat, lon: a.lon, t,
        visto: agora,
      });

      // Liga a posição antiga à nova suavemente (se o salto não for absurdo)
      if (antes) {
        const novo = estimar(av, agora);
        const dLat = antes.lat - novo.lat, dLon = antes.lon - novo.lon;
        if (Math.abs(dLat) < 0.2 && Math.abs(dLon) < 0.2) {
          av.transicao = { dLat, dLon, dAng: ((antes.ang - novo.ang + 540) % 360) - 180, t0: agora };
        }
      }

      const ultimo = av.rastro[av.rastro.length - 1];
      if (!ultimo || distanciaKm(ultimo[0], ultimo[1], a.lat, a.lon) > 0.1) {
        av.rastro.push([a.lat, a.lon, alt, solo]);
        if (av.rastro.length > CONFIG.pontosRastro) av.rastro.shift();
      }
    }

    // Esquece aviões sem notícia há muito tempo (o selecionado fica mais um pouco)
    for (const [hex, av] of avioes) {
      const limite = hex === selecionado ? 5 * 60000 : 2 * 60000;
      if (agora - av.visto > limite) avioes.delete(hex);
    }
    if (selecionado && !avioes.has(selecionado)) fecharPainel();
  }

  const ativo = (av, agora) => agora - av.visto < CONFIG.tempoSumir;

  function passaFiltro(av) {
    if (gruposOcultos.has(av.grupo)) return false;
    if (situacao === 'ar' && av.solo) return false;
    if (situacao === 'solo' && !av.solo) return false;
    if (soEmergencia && !EMERGENCIAS[av.squawk]) return false;
    if (companhiasSel.size && !companhiasSel.has(prefixo(av))) return false;
    const alt = av.solo ? 0 : av.alt;
    if (alt == null) return altMin === 0;
    return alt >= altMin && (altMax >= ALT_SEM_LIMITE || alt <= altMax);
  }

  const nomeDoVoo = av => av.indicativo || av.matricula || av.hex.toUpperCase();

  // ───────────────────────────── Busca de dados ─────────────────────────────
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

  // Só busca de novo ao mexer no mapa se a área mudou de verdade
  function areaMudou() {
    if (!ultimaArea) return true;
    const a = areaDeBusca();
    const deslocamento = distanciaKm(a.lat, a.lon, ultimaArea.lat, ultimaArea.lon) / 1.852;
    return deslocamento > ultimaArea.raio * 0.25 || Math.abs(a.raio - ultimaArea.raio) > ultimaArea.raio * 0.2;
  }

  async function atualizar() {
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
  function atualizarStatus() {
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
    let texto = filtrando ? `${num(visiveis)} de ${num(total)} aviões` : `${num(total)} ${total === 1 ? 'avião' : 'aviões'}`;
    const s = Math.round((agora - ultimoSucesso) / 1000);
    texto += estadoConexao === 'erro' ? ' · reconectando' : s < 2 ? ' · ao vivo' : ` · há ${s} s`;
    el.textContent = texto;
    $('status').title = raioLimitado ? 'Mostrando um raio de 250 milhas náuticas a partir do centro do mapa' : '';
  }
  setInterval(() => { if (!document.hidden) atualizarStatus(); }, 1000);

  // Recarrega ao mexer no mapa, sem passar de uma consulta a cada 3 s
  mapa.on('moveend', () => {
    if (!buscando && areaMudou()) agendar(Math.max(600, ultimaBusca + 3000 - Date.now()));
  });

  // Aba oculta: para tudo. Ao voltar, atualiza na hora.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else agendar(0);
  });

  // ───────────────────────────── Desenho dos aviões ─────────────────────────────
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

  // ───────────────────────────── Aeroportos ─────────────────────────────
  // Base enxuta do OurAirports (médios e grandes com voo regular), carregada só quando for usada
  let aeroportos = null;
  let carregandoAeroportos = null;
  let aeroportosNaTela = [];
  let aeroSelecionado = null;
  const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  function carregarAeroportos() {
    if (!carregandoAeroportos) {
      carregandoAeroportos = fetch('assets/dados/aeroportos.json')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(lista => {
          aeroportos = lista.map(([icao, iata, nome, cidade, pais, lat, lon, porte]) =>
            ({ icao, iata, nome, cidade, pais, lat, lon, porte, chave: semAcento(`${nome} ${cidade}`) }));
          return aeroportos;
        })
        .catch(() => { carregandoAeroportos = null; return null; });
    }
    return carregandoAeroportos;
  }

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

  // ───────────────────────────── Painel do voo ─────────────────────────────
  const painel = $('painel');
  const rotas = new Map(); // indicativo → rota | null | Promise

  function selecionar(hex, centralizar = false) {
    const av = avioes.get(hex);
    if (!av) return;
    if (aeroSelecionado) fecharAeroporto();
    if (selecionado !== hex) alternarSeguir(false);
    selecionado = hex;
    dica.hidden = true;
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

  function fecharPainel() {
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
  function medirFolha() {
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
  let seguindo = false;
  function alternarSeguir(ligar) {
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
  function abrirVooCompartilhado() {
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

  function texto(id, valor) { $(id).textContent = valor; }

  function preencherPainel() {
    const av = avioes.get(selecionado);
    if (!av) return;
    const agora = Date.now();
    const cor = corAltitude(av.alt, av.solo);
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

  // Rota pelo adsbdb (via proxy). Só para indicativos de companhia (ex.: GLO1234).
  const ehIndicativoDeCompanhia = cs => /^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test(cs);

  function buscarRota(cs) {
    const atual = rotas.get(cs);
    if (atual !== undefined) return Promise.resolve(atual);
    const pedido = fetch(`${PROXY}/rota?indicativo=${encodeURIComponent(cs)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        rotas.set(cs, d.rota);
        if (d.rota && d.rota.companhia) nomesCompanhia.set(cs.slice(0, 3), d.rota.companhia);
        return d.rota;
      })
      .catch(() => { rotas.delete(cs); return null; });
    rotas.set(cs, pedido);
    return pedido;
  }

  // A base de rotas é colaborativa e às vezes está velha: só vale se a posição do avião confere
  function rotaConfere(av, rota) {
    if (!rota || rota instanceof Promise || !rota.origem || !rota.destino) return null;
    const { origem: o, destino: d } = rota;
    const pos = posicaoExibida(av, Date.now());
    const total = distanciaKm(o.lat, o.lon, d.lat, d.lon);
    const feito = distanciaKm(o.lat, o.lon, pos.lat, pos.lon);
    const falta = distanciaKm(pos.lat, pos.lon, d.lat, d.lon);
    if (feito + falta > total * 1.3 + 100) return null;
    return { feito, falta, fracao: limitar(feito / (feito + falta), 0, 1) };
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

  // ───────────────────────────── Painel do aeroporto ─────────────────────────────
  const NOME_PAIS = Object.fromEntries(PAISES.map(p => [p[2], p[3]]));
  const bandeira = iso => /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '';

  function abrirAeroporto(a, centralizar = false) {
    if (selecionado) fecharPainel();
    aeroSelecionado = a;
    dica.hidden = true;
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

  function fecharAeroporto() {
    aeroSelecionado = null;
    painelAero.hidden = true;
    if (painel.hidden) document.body.classList.remove('com-painel');
    medirFolha();
  }
  $('bt-fechar-aero').addEventListener('click', fecharAeroporto);

  // Chegadas e partidas: voos de companhia na área cuja rota (que confere) liga ao aeroporto.
  // Busca as rotas que faltam com no máximo 4 pedidos ao mesmo tempo.
  let buscaDoAeroporto = 0;
  async function preencherAeroporto() {
    const a = aeroSelecionado;
    if (!a) return;
    const vez = ++buscaDoAeroporto;
    const agora = Date.now();
    const candidatos = [...avioes.values()].filter(av => ativo(av, agora) && ehIndicativoDeCompanhia(av.indicativo.toUpperCase()));
    const faltam = candidatos.filter(av => !(rotas.has(av.indicativo.toUpperCase())));
    let feitas = 0;
    const desenharListas = () => {
      if (aeroSelecionado !== a) return;
      const chegando = [], saindo = [];
      for (const av of candidatos) {
        const rota = rotas.get(av.indicativo.toUpperCase());
        if (!rotaConfere(av, rota)) continue;
        const dist = distanciaKm(av.lat, av.lon, a.lat, a.lon);
        if (rota.destino.icao === a.icao) chegando.push({ av, dist, outro: rota.origem, sentido: 'de' });
        else if (rota.origem.icao === a.icao) saindo.push({ av, dist, outro: rota.destino, sentido: 'para' });
      }
      chegando.sort((x, y) => x.dist - y.dist);
      saindo.sort((x, y) => x.dist - y.dist);
      lista('a-chegando', chegando, 'Nenhum voo chegando na área do mapa');
      lista('a-saindo', saindo, 'Nenhum voo saindo na área do mapa');
      texto('a-n-chegando', chegando.length ? String(chegando.length) : '');
      texto('a-n-saindo', saindo.length ? String(saindo.length) : '');
      texto('a-nota', feitas < faltam.length
        ? `Consultando rotas… ${feitas} de ${faltam.length}`
        : 'Voos na área do mapa com rota cadastrada no adsbdb que confere com a posição.');
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

  // ───────────────────────────── Busca ─────────────────────────────
  const busca = $('busca');
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

  function fecharPopovers() {
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
  function montarEstilos() {
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
          src: bloco(im), alt: '', loading: 'lazy', className: ESTILOS[im].escurecer ? 'escurecida' : '',
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
  function aplicarCamada(nome) {
    const ligada = prefs.camadas[nome];
    if (nome === 'radar') ligarRadar(ligada);
    else if (nome === 'noite') ligarNoite(ligada);
    else if (nome === 'aeroportos' && ligada) carregarAeroportos();
  }

  // Radar de chuva do RainViewer: 13 quadros das últimas 2 horas, 10 min entre eles
  const creditoRadar = 'Radar: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>';
  const radar = { quadros: [], camadas: [], indice: -1, animacao: null, carregado: 0 };
  const horaUtc = t => new Date(t).toISOString().slice(11, 16) + 'Z';

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
  function atualizarRelogio() { texto('relogio', horaUtc(Date.now())); }
  setInterval(atualizarRelogio, 1000);

  // Janela "Sobre"
  const sobre = $('sobre');
  const abrirSobre = () => { fecharPopovers(); sobre.showModal(); };
  $('bt-sobre').addEventListener('click', abrirSobre);
  $('link-sobre').addEventListener('click', abrirSobre);
  $('bt-fechar-sobre').addEventListener('click', () => sobre.close());
  sobre.addEventListener('click', e => { if (e.target === sobre) sobre.close(); });

  // Filtro por tipo: um botão por grupo, com o ícone do grupo
  function montarTipos() {
    const cor = TINTAS[tema].icone;
    $('tipos').replaceChildren(...GRUPOS.map(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tipo';
      b.setAttribute('aria-pressed', String(!gruposOcultos.has(g.id)));
      b.append(iconeForma(g.forma, cor), Object.assign(document.createElement('span'), { textContent: g.nome }));
      b.addEventListener('click', () => {
        if (gruposOcultos.has(g.id)) gruposOcultos.delete(g.id); else gruposOcultos.add(g.id);
        b.setAttribute('aria-pressed', String(!gruposOcultos.has(g.id)));
        filtrosMudaram();
      });
      return b;
    }));
  }

  const entradaMin = $('alt-min');
  const entradaMax = $('alt-max');

  function definirAltitude(min, max) {
    altMin = min;
    altMax = max;
    entradaMin.value = min;
    entradaMax.value = max;
    $('min-saida').textContent = min === 0 ? 'solo' : emAltitude(min)[0];
    $('max-saida').textContent = max >= ALT_SEM_LIMITE ? 'sem limite' : emAltitude(max)[0];
    filtrosMudaram();
  }

  // Atalhos: "só um grupo" esconde todos os outros; Emergências mostra só squawk 7500/7600/7700
  const soGrupo = id => gruposOcultos.size === GRUPOS.length - 1 && !gruposOcultos.has(id);
  document.querySelectorAll('.atalho-filtro').forEach(b => b.addEventListener('click', () => {
    const atalho = b.dataset.atalho;
    if (atalho === 'emergencias') soEmergencia = !soEmergencia;
    else {
      const id = atalho === 'militares' ? 'militar' : 'helicoptero';
      const ligar = !soGrupo(id);
      gruposOcultos.clear();
      if (ligar) GRUPOS.forEach(g => { if (g.id !== id) gruposOcultos.add(g.id); });
      montarTipos();
    }
    filtrosMudaram();
  }));

  $('situacao').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    situacao = b.dataset.situacao;
    filtrosMudaram();
  });

  // Companhias presentes na área, com quantos voos cada uma tem agora
  function montarCompanhias() {
    const agora = Date.now();
    const contagem = new Map();
    for (const av of avioes.values()) {
      const pre = ativo(av, agora) && prefixo(av);
      if (pre) contagem.set(pre, (contagem.get(pre) || 0) + 1);
    }
    const ordem = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([pre]) => pre);
    for (const pre of companhiasSel) if (!ordem.includes(pre)) ordem.push(pre);
    $('companhias').replaceChildren(...ordem.map(pre => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'companhia';
      b.title = `${nomeCompanhia(pre)} (${pre})`;
      b.setAttribute('aria-pressed', String(companhiasSel.has(pre)));
      b.append(Object.assign(document.createElement('b'), { textContent: pre }),
               document.createTextNode(nomeCompanhia(pre) !== pre ? nomeCompanhia(pre) + ' ' : ''),
               Object.assign(document.createElement('span'), { textContent: String(contagem.get(pre) || 0) }));
      b.addEventListener('click', () => {
        if (companhiasSel.has(pre)) companhiasSel.delete(pre); else companhiasSel.add(pre);
        b.setAttribute('aria-pressed', String(companhiasSel.has(pre)));
        filtrosMudaram();
      });
      return b;
    }));
  }

  function filtrosMudaram() {
    const ativos = (gruposOcultos.size ? 1 : 0) + (altMin > 0 || altMax < ALT_SEM_LIMITE ? 1 : 0)
      + (situacao !== 'todos' ? 1 : 0) + (soEmergencia ? 1 : 0) + (companhiasSel.size ? 1 : 0);
    const selo = $('filtros-ativos');
    selo.hidden = !ativos;
    selo.textContent = ativos;
    document.querySelectorAll('.atalho-filtro').forEach(b => {
      const a = b.dataset.atalho;
      b.setAttribute('aria-pressed', String(a === 'emergencias' ? soEmergencia : soGrupo(a === 'militares' ? 'militar' : 'helicoptero')));
    });
    document.querySelectorAll('#situacao button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.situacao === situacao)));
    if (selecionado && !passaFiltro(avioes.get(selecionado))) fecharPainel();
    atualizarStatus();
  }

  function limparFiltros() {
    gruposOcultos.clear();
    situacao = 'todos';
    soEmergencia = false;
    companhiasSel.clear();
    montarTipos();
    montarCompanhias();
    definirAltitude(0, ALT_SEM_LIMITE);
  }
  $('limpar-filtros').addEventListener('click', limparFiltros);

  entradaMin.addEventListener('input', () => {
    const min = Number(entradaMin.value);
    definirAltitude(min, Math.max(min, altMax));
  });
  entradaMax.addEventListener('input', () => {
    const max = Number(entradaMax.value);
    definirAltitude(Math.min(altMin, max), max);
  });

  // ───────────────────────────── Início ─────────────────────────────
  for (const el of [painel, painelAero, $('mapas'), $('filtros'), $('prefs'), $('status'), $('radar-controle'), document.querySelector('.legenda')]) {
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
})();
