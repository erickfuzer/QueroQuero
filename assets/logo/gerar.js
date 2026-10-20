// Gera as três versões do rosto do quero-quero (colorido, claro e escuro).
// A geometria está em pixels da foto de referência (500×500) e é levada para o viewBox 0 0 512 512.
// Uso: node gerar.js <pasta-de-saída>
const fs = require('fs');
const path = require('path');
const destino = process.argv[2];
const S = 3.6, X0 = 187, Y0 = 86, TX = 32, TY = 22;
const tx = x => S * (x - X0) + TX, ty = y => S * (y - Y0) + TY;

const r1 = n => Math.round(n * 10) / 10;
const pt = p => `${r1(p[0])} ${r1(p[1])}`;
// Leva um path (comandos absolutos M C L A Z) da foto para o ícone
function T(d) {
  const t = d.replace(/([MCLAZ])/g, ' $1 ').trim().split(/[\s,]+/);
  const out = [];
  let cmd = '', i = 0;
  while (i < t.length) {
    if (/^[MCLAZ]$/.test(t[i])) { cmd = t[i++]; out.push(cmd); if (cmd === 'Z') continue; }
    if (cmd === 'A') { out.push(r1(t[i] * S), r1(t[i + 1] * S), t[i + 2], t[i + 3], t[i + 4], r1(tx(+t[i + 5])), r1(ty(+t[i + 6]))); i += 7; }
    else { out.push(r1(tx(+t[i])), r1(ty(+t[i + 1]))); i += 2; }
  }
  return out.join(' ').replace(/ ?([MCLAZ]) ?/g, '$1').replace(/([MCLA])/g, '$1').replace(/Z/g, 'Z').replace(/([0-9])([MCLAZ])/g, '$1 $2').replace(/([MCLA]) /g, '$1');
}
function pena(p0, p1, p2, p3, w0, w1) {
  const norm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
  const n0 = norm(p0, p1), n3 = norm(p2, p3);
  const wa = w0 * 0.7 + w1 * 0.3, wb = w0 * 0.3 + w1 * 0.7;
  const off = (p, n, w, s) => [p[0] + n[0] * w / 2 * s, p[1] + n[1] * w / 2 * s];
  return `M${pt(off(p0, n0, w0, 1))} C${pt(off(p1, n0, wa, 1))} ${pt(off(p2, n3, wb, 1))} ${pt(off(p3, n3, w1, 1))} ` +
    `A${w1 / 2} ${w1 / 2} 0 0 1 ${pt(off(p3, n3, w1, -1))} ` +
    `C${pt(off(p2, n3, wb, -1))} ${pt(off(p1, n0, wa, -1))} ${pt(off(p0, n0, w0, -1))} Z`;
}
function amendoa(cx, cy, rx, ry, graus, frente = 0.8) {
  const k = 0.5523, a = graus * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const P = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
  const F = P(-rx, 0), Tp = P(0, -ry), B = P(rx, 0), U = P(0, ry);
  return `M${pt(F)} C${pt(P(-rx, -k * ry * frente))} ${pt(P(-k * rx * frente, -ry))} ${pt(Tp)} ` +
    `C${pt(P(k * rx, -ry))} ${pt(P(rx, -k * ry))} ${pt(B)} ` +
    `C${pt(P(rx, k * ry))} ${pt(P(k * rx, ry))} ${pt(U)} ` +
    `C${pt(P(-k * rx * frente, ry))} ${pt(P(-rx, k * ry * frente))} ${pt(F)} Z`;
}
const limpa = d => d.replace(/\s+/g, ' ').trim();

// ── Geometria em pixels da foto ──
const O = { x: 239.5, y: 123.5 };
const F = {
  corpo: limpa(`M214.5 130
    L214.5 120 C214.6 115 217 110.4 221 107.4
    C225 104.6 231 104 238 104
    C246 104 255 104.8 263 106.6
    C269 108 274 110.6 276.4 114.4
    C278.2 117.6 278.8 122 279 128
    C279.5 145 280.5 162 283 174
    C285.5 183 293 190 304 197
    C310 201 315 204.5 319 207.5
    C300 220 266 223.5 234.6 221
    C234.6 205 235 185 235 173
    C235 166 234 162.4 231.6 160
    C226 155.6 216.6 151.6 210.6 146
    L213 138 Z`),
  bico: limpa(`M222.4 131.4
    C219.4 131 216.8 131.2 214 131.6
    C205.6 133 196 139.2 187 148.4
    C185.8 149.6 186.2 151.4 187.8 151.2
    C194.6 150.2 204 146.6 213 143.2
    C216.6 142 219.6 141.4 222.4 141
    C223.4 138.8 223.6 133.4 222.4 131.4 Z`),
  pontaBico: 'M197 120 L205.6 156 L178 156 L178 120 Z',
  comissura: 'M220.6 137.6 C215 138.6 208.6 140.6 201.6 143.6',
  narina: 'M206.6 134.4 C207.8 133.6 209.2 133 210.6 132.6',
  penachos: [
    pena([262, 108.6], [276, 105.4], [295, 100.6], [311.5, 86], 2.9, 0.42),
    pena([264, 108], [275, 104.8], [286, 101.4], [297, 94.4], 2.2, 0.36),
    pena([263.4, 107.8], [266.4, 105], [268.8, 101.8], [271, 97.4], 1.9, 0.34),
  ],
  // Máscara preta: testa, faixa atrás da base do bico, queixo, garganta e peito
  mascara: limpa(`M205 128
    C209 121.6 213 118.6 218.4 118.4
    L223.2 118.4 C224.4 118.4 224.8 119.2 224.8 120.4
    L224.6 128 C224.4 130 223.8 131.6 223.8 133.6
    C223.8 136.6 223.6 139 222.8 141
    C224.6 144.4 227 147.6 229.4 150.6
    C231.6 153.4 234.4 156 236.8 158.4
    C238.4 160.4 238.8 164 238.8 170
    C238.8 182 239.4 194 240.6 202
    C243 209 248 214 254 218
    L258 226 L205 226 Z`),
  // Borda branca: faixa da testa, frente do olho e faixa atrás do bico até o queixo
  branco: limpa(`M217.4 114.6
    C219.4 112.8 222.8 111.8 226.6 111.8
    C230.6 111.8 233.6 113 234.6 115.2
    L233.4 121 C231 124.4 230.6 128.4 231.8 131.6
    C232 135 231.8 139.4 231.4 142.6
    C231 145 230.4 147 230.4 148.4
    C231.4 150.6 233.4 153.6 236 156.6
    L222 150 L214 118.4 Z`),
  // Creme sob o olho
  creme: 'M231.8 131.6 C238 132.6 246 132.4 252.6 129.4 C252 135.4 247 140.4 240 142 C236.4 142.8 233.4 142.6 231.4 142.6 Z',
  // Contorno da máscara para o recorte das silhuetas (começa dentro da cabeça)
  bordaMascara: 'M219 118.4 L223.2 118.4 C224.4 118.4 224.8 119.2 224.8 120.4 L224.6 128 C224.4 130 223.8 131.6 223.8 133.6 C223.8 136.6 223.6 139 222.8 141 C224.6 144.4 227 147.6 229.4 150.6 C231.6 153.4 234.4 156 236.8 158.4 C238.4 160.4 238.8 164 238.8 170 L239 186',
  asa: 'M253 230 C260 212 276 199 297 194.6 C306 193.6 316 197 330 206 L330 230 Z',
  ombro: 'M259 230 C265 216 277 206 292 203 C301 201.6 309 203 315 206.6 C305 208.6 295 214 287.6 222 C285 225 283 228 282 230 Z',
  penasOmbro: ['M267 228 C271 220 277 213 285 209', 'M276 228 C280 221 286 216 293 212.6'],
  sombraNuca: limpa(`M275.6 111 C277.8 115 278.6 121 279 128 C279.5 145 280.5 162 283 174
    C285.5 183 293 190 304 197 C294 195 282 188 277.6 177 C273.6 166 273.4 146 273.4 130
    C273.4 122 274 116 275.6 111 Z`),
  brilhoTopo: 'M227 107 C237 105.4 249 105.6 260 107.6 C250 107.8 238 108.6 230.4 110.6 Z',
  asaLinha: pena([256, 224.6], [263, 210], [278, 199.6], [298.6, 194.4], 2.3, 0.7),
};
const G = {};
for (const k of Object.keys(F)) G[k] = Array.isArray(F[k]) ? F[k].map(T) : T(F[k]);
G.anel = T(amendoa(O.x, O.y, 9.4, 6.7, -3, 0.88));
G.volta = T(amendoa(O.x, O.y, 10.9, 8.2, -3, 0.9));
G.iris = T(amendoa(O.x + 0.2, O.y - 0.2, 6.1, 5.5, -3, 1));
const ox = r1(tx(O.x + 0.2)), oy = r1(ty(O.y - 0.4));
const L = n => r1(n * S); // larguras em pixels da foto

const cabecalho = (v, desc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="qq-titulo-${v} qq-desc-${v}">
  <title id="qq-titulo-${v}">Quero-quero</title>
  <desc id="qq-desc-${v}">${desc}</desc>`;

function colorido() {
  return `${cabecalho('colorido', 'Rosto do quero-quero de perfil, colorido: cabeça cinza-areia, penacho preto, máscara preta na testa e na garganta contornada de branco, bico rosado de ponta preta, olho vermelho e o ombro bronzeado da asa.')}
  <defs>
    <clipPath id="qq-corpo-colorido"><path d="${G.corpo}"/></clipPath>
    <clipPath id="qq-bico-colorido"><path d="${G.bico}"/></clipPath>
    <linearGradient id="qq-pele-colorido" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#c9c2b6"/>
      <stop offset=".42" stop-color="#cbb698"/>
      <stop offset="1" stop-color="#b59a76"/>
    </linearGradient>
    <radialGradient id="qq-iris-colorido" cx=".42" cy=".62" r=".62">
      <stop offset="0" stop-color="#f26b4e"/>
      <stop offset="1" stop-color="#b81d29"/>
    </radialGradient>
    <linearGradient id="qq-ombro-colorido" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e08a35"/>
      <stop offset="1" stop-color="#b5601f"/>
    </linearGradient>
  </defs>
  <!-- Penacho da nuca -->
  <g fill="#1d1b19">${G.penachos.map(p => `<path d="${p}"/>`).join('')}</g>
  <!-- Cabeça, pescoço e peito -->
  <path d="${G.corpo}" fill="url(#qq-pele-colorido)"/>
  <g clip-path="url(#qq-corpo-colorido)">
    <!-- Sombra da nuca e brilho do alto da cabeça -->
    <path d="${G.sombraNuca}" fill="#9c845f" opacity=".45"/>
    <path d="${G.brilhoTopo}" fill="#ddd8cf" opacity=".8"/>
    <!-- Asa com o ombro bronzeado -->
    <path d="${G.asa}" fill="#85735b"/>
    <path d="${G.ombro}" fill="url(#qq-ombro-colorido)"/>
    <g fill="none" stroke="#9a4f1a" stroke-width="2.4" stroke-linecap="round" opacity=".6">${G.penasOmbro.map(p => `<path d="${p}"/>`).join('')}</g>
    <!-- Face clara, borda branca e máscara preta da testa ao peito -->
    <path d="${G.creme}" fill="#e3d7c3"/>
    <path d="${G.branco}" fill="#f7f3ec"/>
    <path d="${G.mascara}" fill="#1d1b19"/>
  </g>
  <!-- Bico curto, rosado e de ponta preta, com a base entrando no preto do rosto -->
  <path d="${G.bico}" fill="#df6f80"/>
  <g clip-path="url(#qq-bico-colorido)">
    <path d="${G.comissura}" fill="none" stroke="#a8404f" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${G.pontaBico}" fill="#1d1b19"/>
  </g>
  <path d="${G.narina}" fill="none" stroke="#a8404f" stroke-width="2.6" stroke-linecap="round"/>
  <!-- Olho: anel vermelho oval, íris, pupila e brilhos -->
  <path d="${G.anel}" fill="#d8404a" stroke="#9e1f2a" stroke-width="2"/>
  <path d="${G.iris}" fill="url(#qq-iris-colorido)"/>
  <circle cx="${ox}" cy="${oy}" r="${L(2.7)}" fill="#141210"/>
  <circle cx="${r1(ox - L(1.3))}" cy="${r1(oy - L(1.5))}" r="${L(1.1)}" fill="#fff"/>
  <circle cx="${r1(ox + L(2))}" cy="${r1(oy + L(1.9))}" r="${L(0.45)}" fill="#fff" opacity=".7"/>
</svg>
`;
}

function silhueta(tema) {
  const c = tema === 'claro'
    ? { corpo: '#1c1f23', anel: '#c8382f', iris: '#a52a23', pupila: '#1c1f23', brilho: '#ffffff', nome: 'claro', fundo: 'claros' }
    : { corpo: '#e8e6e1', anel: '#e0574d', iris: '#c2443b', pupila: '#15181c', brilho: '#ffffff', nome: 'escuro', fundo: 'escuros' };
  return `${cabecalho(c.nome, `Silhueta do rosto do quero-quero de perfil com o olho vermelho, para o tema ${c.nome} (fundos ${c.fundo}).`)}
  <defs>
    <clipPath id="qq-corpo-${c.nome}"><path d="${G.corpo}"/></clipPath>
    <!-- Recortes: borda da máscara, encaixe do bico, linha da asa e volta do olho -->
    <mask id="qq-recorte-${c.nome}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect width="512" height="512" fill="#fff"/>
      <g clip-path="url(#qq-corpo-${c.nome})">
        <path d="${G.bordaMascara}" fill="none" stroke="#000" stroke-width="${L(4)}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${G.mascara}" fill="#fff"/>
      </g>
      <path d="${G.bico}" fill="#000" stroke="#000" stroke-width="${L(1.8)}"/>
      <path d="${G.asaLinha}" fill="#000"/>
      <path d="${G.volta}" fill="#000"/>
    </mask>
  </defs>
  <!-- Silhueta: penacho, cabeça, pescoço e bico -->
  <g fill="${c.corpo}">
    <g mask="url(#qq-recorte-${c.nome})">
      ${G.penachos.map(p => `<path d="${p}"/>`).join('')}
      <path d="${G.corpo}"/>
    </g>
    <path d="${G.bico}"/>
  </g>
  <!-- Olho -->
  <path d="${G.anel}" fill="${c.anel}"/>
  <path d="${G.iris}" fill="${c.iris}"/>
  <circle cx="${ox}" cy="${oy}" r="${L(2.9)}" fill="${c.pupila}"/>
  <circle cx="${r1(ox - L(1.3))}" cy="${r1(oy - L(1.5))}" r="${L(1.15)}" fill="${c.brilho}"/>
</svg>
`;
}

fs.mkdirSync(destino, { recursive: true });
fs.writeFileSync(path.join(destino, 'quero-quero-colorido.svg'), colorido());
fs.writeFileSync(path.join(destino, 'quero-quero-claro.svg'), silhueta('claro'));
fs.writeFileSync(path.join(destino, 'quero-quero-escuro.svg'), silhueta('escuro'));
