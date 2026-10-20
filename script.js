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

  const PROXY = (new URLSearchParams(location.search).get('proxy') || CONFIG.proxy).replace(/\/+$/, '');
  const ALT_SEM_LIMITE = 45000;
  const celular = window.matchMedia('(max-width: 640px)');

  // ───────────────────────────── Mapa ─────────────────────────────
  const mapa = L.map('mapa', {
    center: CONFIG.centroPadrao,
    zoom: CONFIG.zoomPadrao,
    minZoom: 3,
    maxZoom: 14,
    zoomControl: false,
    worldCopyJump: true,
  });
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

  // Mapa base escuro da Esri (cinza escuro, sem chave) e, por cima, a camada de nomes
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const creditoEsri = 'Mapa: <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin, ' +
                      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: creditoEsri }).addTo(mapa);
  L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(mapa);

  L.control.zoom({ position: 'topright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);

  // Botão "minha localização"
  const ControleLocal = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      const botao = L.DomUtil.create('button', 'botao-local', div);
      botao.type = 'button';
      botao.title = 'Ir para minha localização';
      botao.setAttribute('aria-label', 'Ir para minha localização');
      botao.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2v2.06A8 8 0 0 0 4.06 11H2v2h2.06A8 8 0 0 0 11 19.94V22h2v-2.06A8 8 0 0 0 19.94 13H22v-2h-2.06A8 8 0 0 0 13 4.06V2h-2Zm1 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>';
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
      mapa.setView(ll, Math.max(mapa.getZoom(), CONFIG.zoomPadrao));
    }, () => {
      if (pedidoDoUsuario) mostrarAviso('Não foi possível obter sua localização. Verifique a permissão do navegador.', 'erro', 5000);
    }, { timeout: 10000, maximumAge: 600000 });
  }

  // ───────────────────────────── Utilitários ─────────────────────────────
  const $ = id => document.getElementById(id);
  const num = (n, casas = 0) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const RAD = Math.PI / 180;

  function distanciaKm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  const PONTOS_CARDEAIS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const cardeal = graus => PONTOS_CARDEAIS[Math.round(((graus % 360) + 360) % 360 / 22.5) % 16];

  // Escala de cores por altitude (pés). A mesma escala está no gradiente da legenda.
  const ESCALA = [
    [0, [255, 107, 74]], [5000, [255, 162, 58]], [10000, [255, 216, 74]], [20000, [126, 224, 108]],
    [30000, [63, 208, 224]], [40000, [138, 125, 255]], [45000, [199, 125, 255]],
  ];
  function corAltitude(alt, solo) {
    if (solo) return 'rgb(125, 133, 144)';
    if (alt == null) return 'rgb(200, 200, 200)';
    for (let i = 1; i < ESCALA.length; i++) {
      const [a1, c1] = ESCALA[i - 1], [a2, c2] = ESCALA[i];
      if (alt <= a2) {
        const k = limitar((alt - a1) / (a2 - a1), 0, 1);
        return `rgb(${c1.map((c, j) => Math.round(c + (c2[j] - c) * k)).join(', ')})`;
      }
    }
    return `rgb(${ESCALA[ESCALA.length - 1][1].join(', ')})`;
  }

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

  // ───────────────────────────── Estado dos aviões ─────────────────────────────
  // hex → { hex, indicativo, matricula, tipo, alt, solo, gs, rumo, vertical, lat, lon, t, visto, rastro, transicao }
  const avioes = new Map();
  let selecionado = null;
  let altMin = 0, altMax = ALT_SEM_LIMITE;

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
      Object.assign(av, {
        indicativo: (a.flight || '').trim(),
        matricula: (a.r || '').trim(),
        tipo: a.t || '',
        descricao: a.desc || '',
        categoria: a.category || '',
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
    const alt = av.solo ? 0 : av.alt;
    if (alt == null) return altMin === 0;
    return alt >= altMin && (altMax >= ALT_SEM_LIMITE || alt <= altMax);
  }

  // ───────────────────────────── Busca de dados ─────────────────────────────
  let timer = null;
  let buscando = false;
  let ultimaBusca = 0;
  let pausaAte = 0;
  let falhas = 0;
  let raioLimitado = false;
  let fonteAtual = '';

  function agendar(ms) {
    clearTimeout(timer);
    timer = setTimeout(atualizar, Math.max(ms, pausaAte - Date.now(), 0));
  }

  // Círculo que cobre a área visível do mapa (as APIs consultam por raio)
  function areaDeBusca() {
    const c = mapa.getCenter().wrap();
    const canto = mapa.getBounds().getNorthEast();
    const nm = c.distanceTo(canto) / 1852;
    raioLimitado = nm > CONFIG.raioMaximo;
    return { lat: c.lat.toFixed(2), lon: c.lng.toFixed(2), raio: Math.ceil(Math.min(nm * 1.05, CONFIG.raioMaximo)) };
  }

  async function atualizar() {
    clearTimeout(timer);
    if (document.hidden || buscando) return;
    if (!PROXY) {
      mostrarAviso('O proxy de dados não está configurado. Veja no README como publicar o seu.', 'erro');
      $('contagem').textContent = 'Sem fonte de dados';
      return;
    }
    buscando = true;
    ultimaBusca = Date.now();
    const area = areaDeBusca();
    try {
      const resp = await fetch(`${PROXY}/voos?lat=${area.lat}&lon=${area.lon}&raio=${area.raio}`);
      if (resp.status === 429) {
        const s = Number(resp.headers.get('Retry-After')) || 30;
        pausaAte = Date.now() + s * 1000;
        mostrarAviso(`Limite de consultas gratuitas atingido. Tentando de novo em ${s} s.`);
        agendar(s * 1000);
        return;
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const dados = await resp.json();
      receber(dados.ac || []);
      definirFonte(dados.fonte);
      falhas = 0;
      esconderAviso();
      atualizarContagem();
      if (selecionado) preencherPainel();
      agendar(CONFIG.intervalo);
    } catch (e) {
      falhas++;
      const s = Math.min(60, 10 * 2 ** (falhas - 1));
      mostrarAviso(`Não foi possível buscar os voos agora. Nova tentativa em ${s} s.`, 'erro');
      agendar(s * 1000);
    } finally {
      buscando = false;
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

  function atualizarContagem() {
    const agora = Date.now();
    let total = 0, visiveis = 0;
    for (const av of avioes.values()) {
      if (!ativo(av, agora)) continue;
      total++;
      if (passaFiltro(av)) visiveis++;
    }
    const filtrando = altMin > 0 || altMax < ALT_SEM_LIMITE;
    let texto = filtrando ? `${num(visiveis)} de ${num(total)} aviões` : `${num(total)} ${total === 1 ? 'avião' : 'aviões'}`;
    if (raioLimitado) texto += ' · raio de 250 NM';
    $('contagem').textContent = texto;
  }

  // Recarrega ao mexer no mapa, sem passar de uma consulta a cada 3 s
  mapa.on('moveend', () => {
    if (!buscando) agendar(Math.max(600, ultimaBusca + 3000 - Date.now()));
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

  // Silhueta de avião vista de cima, apontando para o norte
  const SILHUETA = new Path2D('M0 -15C1.6 -15 2.2 -13 2.2 -11L2.2 -4.5L14 2.5L14 5.5L2.2 2L2.2 8.5L6 11.5L6 13.8L0 12.4L-6 13.8L-6 11.5L-2.2 8.5L-2.2 2L-14 5.5L-14 2.5L-2.2 -4.5L-2.2 -11C-2.2 -13 -1.6 -15 0 -15Z');
  const ESCALA_CATEGORIA = { A1: 0.62, A2: 0.72, A3: 0.85, A4: 0.9, A5: 1, A7: 0.7, B1: 0.55, B6: 0.55 };

  let naTela = [];

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, tam.x, tam.y);
    naTela = [];

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

    const rotulos = zoom >= 9;
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    for (const av of avioes.values()) {
      if (av === sel) continue;
      if (!ativo(av, agora) || !passaFiltro(av)) continue;
      desenharAviao(av, posicaoExibida(av, agora), agora, centroLon, tam, false, rotulos);
    }
    if (sel && ativo(sel, agora)) desenharAviao(sel, pSel, agora, centroLon, tam, true, true);
  }

  function desenharAviao(av, pos, agora, centroLon, tam, destaque, rotulo) {
    const p = paraTela(pos.lat, ajustarLon(pos.lon, centroLon));
    if (p.x < -30 || p.y < -30 || p.x > tam.x + 30 || p.y > tam.y + 30) return;
    naTela.push({ hex: av.hex, x: p.x, y: p.y });

    // Some aos poucos quando o sinal está se perdendo
    const idade = agora - av.visto;
    ctx.globalAlpha = idade > 15000 ? limitar(1 - (idade - 15000) / 15000, 0.15, 1) : 1;

    const escala = (ESCALA_CATEGORIA[av.categoria] || 0.85) * (destaque ? 1.25 : 1);
    if (destaque) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(pos.ang * RAD);
    ctx.scale(escala, escala);
    ctx.fillStyle = corAltitude(av.alt, av.solo);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1.4 / escala;
    ctx.fill(SILHUETA);
    ctx.stroke(SILHUETA);
    ctx.restore();

    if (rotulo) {
      const texto = av.indicativo || av.matricula || av.hex.toUpperCase();
      const x = p.x + (destaque ? 26 : 16);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(11, 15, 20, 0.9)';
      ctx.strokeText(texto, x, p.y);
      ctx.fillStyle = destaque ? '#ffffff' : 'rgba(230, 237, 243, 0.85)';
      ctx.fillText(texto, x, p.y);
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(desenhar);

  // Clique: o avião mais próximo do ponto tocado
  function avioesPerto(ponto, raio) {
    let melhor = null, menor = raio * raio;
    for (const a of naTela) {
      const d = (a.x - ponto.x) ** 2 + (a.y - ponto.y) ** 2;
      if (d <= menor) { menor = d; melhor = a.hex; }
    }
    return melhor;
  }

  mapa.on('click', e => {
    const toque = e.originalEvent && e.originalEvent.pointerType === 'touch';
    const hex = avioesPerto(e.containerPoint, toque ? 26 : 18);
    if (hex) selecionar(hex);
    else if (selecionado) fecharPainel();
  });

  mapa.on('mousemove', e => {
    mapa.getContainer().style.cursor = avioesPerto(e.containerPoint, 18) ? 'pointer' : '';
  });

  // ───────────────────────────── Painel do voo ─────────────────────────────
  const painel = $('painel');
  const rotas = new Map(); // indicativo → rota | null | Promise

  function selecionar(hex, centralizar = false) {
    const av = avioes.get(hex);
    if (!av) return;
    selecionado = hex;
    painel.hidden = false;
    document.body.classList.add('com-painel');
    preencherPainel();
    medirFolha();
    const pos = posicaoExibida(av, Date.now());
    if (centralizar) {
      mapa.setView([pos.lat, pos.lon], Math.max(mapa.getZoom(), 9), { animate: false });
    }
    manterVisivel(pos);
  }

  function fecharPainel() {
    selecionado = null;
    painel.hidden = true;
    document.body.classList.remove('com-painel');
    medirFolha();
  }
  $('fechar').addEventListener('click', fecharPainel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && selecionado && document.activeElement !== $('busca')) fecharPainel();
  });

  // No celular o painel é uma folha inferior: os controles do rodapé sobem junto
  function medirFolha() {
    const altura = !painel.hidden && celular.matches ? painel.offsetHeight : 0;
    document.documentElement.style.setProperty('--folga', altura + 'px');
  }
  new ResizeObserver(medirFolha).observe(painel);
  celular.addEventListener('change', medirFolha);

  // Se o avião ficou atrás do painel, move o mapa para ele aparecer
  function manterVisivel(pos) {
    const tam = mapa.getSize();
    const p = mapa.latLngToContainerPoint([pos.lat, pos.lon]);
    const area = celular.matches
      ? { x1: 0, y1: 70, x2: tam.x, y2: tam.y - painel.offsetHeight }
      : { x1: painel.offsetWidth + 24, y1: 80, x2: tam.x - 60, y2: tam.y };
    const m = 40;
    if (p.x < area.x1 + m || p.x > area.x2 - m || p.y < area.y1 + m || p.y > area.y2 - m) {
      mapa.panBy([p.x - (area.x1 + area.x2) / 2, p.y - (area.y1 + area.y2) / 2]);
    }
  }

  function preencherPainel() {
    const av = avioes.get(selecionado);
    if (!av) return;
    const agora = Date.now();

    $('p-indicativo').textContent = av.indicativo || av.matricula || av.hex.toUpperCase();
    $('p-aeronave').textContent = [av.matricula, av.descricao || av.tipo].filter(Boolean).join(' · ');

    $('p-altitude').innerHTML = av.solo ? 'Em solo'
      : av.alt == null ? '–'
      : `${num(av.alt)} ft <small>${num(av.alt * 0.3048)} m</small>`;
    $('p-velocidade').innerHTML = `${num(av.gs)} kt <small>${num(av.gs * 1.852)} km/h</small>`;
    $('p-rumo').innerHTML = `${num(av.rumo)}° <small>${cardeal(av.rumo)}</small>`;
    const v = av.vertical;
    $('p-vertical').innerHTML = v == null || av.solo ? '–'
      : v > 64 ? `↑ ${num(v)} <small>ft/min</small>`
      : v < -64 ? `↓ ${num(-v)} <small>ft/min</small>`
      : 'Nivelado';
    $('p-pais').textContent = paisDoHex(av.hex) || 'Não identificado';
    $('p-squawk').textContent = av.squawk || '–';
    $('p-hex').textContent = 'ICAO ' + av.hex.toUpperCase();
    const s = Math.max(0, Math.round((agora - av.t) / 1000));
    $('p-visto').textContent = s < 2 ? 'agora' : `há ${s} s`;
    painel.classList.toggle('perdido', !ativo(av, agora));

    mostrarRota(av);
  }
  setInterval(() => { if (selecionado && !document.hidden) preencherPainel(); }, 1000);

  // Rota pelo adsbdb (via proxy). Só para indicativos de companhia (ex.: GLO1234).
  function mostrarRota(av) {
    const el = $('p-rota');
    const cs = av.indicativo.toUpperCase();
    const semRota = texto => {
      el.className = 'rota sem-rota';
      el.textContent = texto;
      $('p-companhia').textContent = '';
    };
    if (!/^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test(cs)) return semRota('Rota não disponível para este voo.');

    const rota = rotas.get(cs);
    if (rota === undefined) {
      el.className = 'rota sem-rota';
      el.textContent = 'Buscando rota…';
      rotas.set(cs, fetch(`${PROXY}/rota?indicativo=${encodeURIComponent(cs)}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { rotas.set(cs, d.rota); })
        .catch(() => { rotas.delete(cs); })
        .finally(() => { if (selecionado === av.hex) mostrarRota(av); }));
      return;
    }
    if (rota instanceof Promise) return;
    if (!rota || !rota.origem || !rota.destino) return semRota('Rota não disponível para este voo.');

    $('p-companhia').textContent = rota.companhia || '';

    // A base de rotas é colaborativa e às vezes está velha: só mostra se a posição confere
    const { origem: o, destino: d } = rota;
    const total = distanciaKm(o.lat, o.lon, d.lat, d.lon);
    const desvio = distanciaKm(o.lat, o.lon, av.lat, av.lon) + distanciaKm(av.lat, av.lon, d.lat, d.lon);
    if (desvio > total * 1.3 + 100) {
      return semRota('Rota não disponível: a cadastrada para este indicativo não confere com a posição do avião.');
    }

    el.className = 'rota';
    el.replaceChildren(
      ponto(o), Object.assign(document.createElement('span'), { className: 'seta', textContent: '✈' }), ponto(d),
      Object.assign(document.createElement('p'), { className: 'nota', textContent: 'Rota cadastrada no adsbdb' }),
    );
    $('p-companhia').textContent = rota.companhia || '';
  }

  function ponto(a) {
    const div = document.createElement('div');
    div.className = 'ponto';
    const b = document.createElement('b');
    b.textContent = a.iata || a.icao || '?';
    const span = document.createElement('span');
    span.textContent = a.cidade || a.nome || '';
    div.append(b, span);
    return div;
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
    resultados = [];
    for (const av of avioes.values()) {
      if (!ativo(av, agora)) continue;
      const campos = [normalizar(av.indicativo), normalizar(av.matricula), av.hex.toUpperCase()];
      const pos = Math.min(...campos.map(c => { const i = c.indexOf(termo); return i < 0 ? 99 : i; }));
      if (pos < 99) resultados.push({ av, pos });
    }
    resultados.sort((a, b) => a.pos - b.pos || (a.av.indicativo || 'zz').localeCompare(b.av.indicativo || 'zz'));
    resultados = resultados.slice(0, 6).map(r => r.av);

    sugestoes.replaceChildren();
    if (!resultados.length) {
      const li = document.createElement('li');
      li.className = 'vazio';
      li.textContent = 'Nenhum voo encontrado na área do mapa';
      sugestoes.append(li);
    }
    resultados.forEach((av, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'sugestao-' + i;
      const b = document.createElement('b');
      b.textContent = av.indicativo || av.matricula || av.hex.toUpperCase();
      const span = document.createElement('span');
      span.textContent = [av.matricula, av.solo ? 'em solo' : av.alt != null ? `${num(av.alt)} ft` : ''].filter(Boolean).join(' · ');
      li.append(b, span);
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
    const av = resultados[i];
    if (!av) return;
    // Se o avião estiver fora do filtro de altitude, o filtro é liberado para ele aparecer
    if (!passaFiltro(av)) definirFiltro(0, ALT_SEM_LIMITE);
    busca.value = av.indicativo || av.matricula || av.hex.toUpperCase();
    sugestoes.hidden = true;
    busca.blur();
    selecionar(av.hex, true);
  }

  busca.addEventListener('input', procurar);
  busca.addEventListener('focus', () => { if (busca.value) procurar(); });
  busca.addEventListener('blur', () => { sugestoes.hidden = true; });
  busca.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar(Math.min(indice + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(Math.max(indice - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(Math.max(indice, 0)); }
    else if (e.key === 'Escape') { busca.value = ''; sugestoes.hidden = true; }
  });

  // ───────────────────────────── Filtro por altitude ─────────────────────────────
  const entradaMin = $('alt-min');
  const entradaMax = $('alt-max');

  function definirFiltro(min, max) {
    altMin = min;
    altMax = max;
    entradaMin.value = min;
    entradaMax.value = max;
    $('min-saida').textContent = min === 0 ? 'solo' : `${num(min)} ft`;
    $('max-saida').textContent = max >= ALT_SEM_LIMITE ? 'sem limite' : `${num(max)} ft`;
    atualizarContagem();
  }

  entradaMin.addEventListener('input', () => {
    const min = Number(entradaMin.value);
    definirFiltro(min, Math.max(min, altMax));
  });
  entradaMax.addEventListener('input', () => {
    const max = Number(entradaMax.value);
    definirFiltro(Math.min(altMin, max), max);
  });

  // Legenda recolhível (começa recolhida no celular para liberar o mapa)
  const alternar = $('legenda-alternar');
  function abrirFiltro(aberto) {
    alternar.setAttribute('aria-expanded', String(aberto));
    $('filtro').hidden = !aberto;
  }
  alternar.addEventListener('click', () => abrirFiltro(alternar.getAttribute('aria-expanded') !== 'true'));
  abrirFiltro(!celular.matches);

  // ───────────────────────────── Início ─────────────────────────────
  L.DomEvent.disableClickPropagation($('legenda'));
  L.DomEvent.disableScrollPropagation($('legenda'));
  L.DomEvent.disableClickPropagation(painel);
  L.DomEvent.disableScrollPropagation(painel);

  localizar(false);
  atualizar();
})();
