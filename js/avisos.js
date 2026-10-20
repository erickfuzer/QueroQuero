// Avisos no topo da tela
import { $ } from './util.js';

let avisoTimer = null;
export function mostrarAviso(mensagem, tipo = '', duracao = 0) {
  const el = $('aviso');
  el.textContent = mensagem;
  el.className = 'aviso ' + tipo;
  el.hidden = false;
  clearTimeout(avisoTimer);
  if (duracao) avisoTimer = setTimeout(esconderAviso, duracao);
}
export function esconderAviso() { $('aviso').hidden = true; }
