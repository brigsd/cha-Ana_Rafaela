const API_URL = window.CHA_API;
const apiConfigured = /^https:/.test(API_URL || '');
const rsvpKey = 'cha-ana-rafaela-rsvp-token';
const cacheKey = 'cha-ana-rafaela-cache-v1';
let currentEvent = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text = '') => String(text).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

function celebrate() {
  const layer = $('#celebration');
  const width = window.innerWidth;
  const height = window.innerHeight;
  const symbols = ['♥', '♡', '✦', '✧', '★'];
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index / 18) + (Math.random() - .5) * .28;
    const dx = Math.cos(angle) || .01;
    const dy = Math.sin(angle) || .01;
    const distance = Math.min((width / 2 - 12) / Math.abs(dx), (height / 2 - 12) / Math.abs(dy));
    const particle = document.createElement('span');
    const x = dx * distance;
    const y = dy * distance;
    particle.className = 'celebration-particle';
    particle.textContent = symbols[index % symbols.length];
    particle.style.color = index % 2 ? '#e97d98' : '#f6b263';
    particle.style.animationDelay = `${(Math.random() * .5).toFixed(2)}s`;
    particle.style.setProperty('--x', `${x}px`);
    particle.style.setProperty('--y', `${y}px`);
    particle.style.setProperty('--bounce-x', `${x * .86}px`);
    particle.style.setProperty('--bounce-y', `${y * .86}px`);
    particle.style.setProperty('--end-x', `${x * .92}px`);
    particle.style.setProperty('--end-y', `${y * .92}px`);
    particle.style.setProperty('--spin', `${(Math.random() * 340 - 170).toFixed(0)}deg`);
    layer.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
  }
}

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch { return null; }
};

function writeCache(evento, sugestoes) {
  try { localStorage.setItem(cacheKey, JSON.stringify({ evento, sugestoes })); } catch { /* armazenamento indisponivel */ }
}

async function read(action) {
  // Aproveita a busca que o <head> do index.html já disparou, quando houver.
  const prefetch = window.CHA_PREFETCH && window.CHA_PREFETCH[action];
  if (prefetch) {
    window.CHA_PREFETCH[action] = null;
    const cru = await prefetch;
    if (cru) {
      if (!cru.ok) throw new Error(cru.mensagem || 'Não foi possível concluir a solicitação.');
      return cru;
    }
  }
  // O Apps Script falha ou demora demais de vez em quando, então vale uma segunda tentativa.
  let ultimoErro;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    if (tentativa) await new Promise((pronto) => setTimeout(pronto, 1200));
    try {
      const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`);
      if (!response.ok) throw new Error(`A API respondeu ${response.status}.`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.mensagem || 'Não foi possível concluir a solicitação.');
      return result;
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}

async function request(action, data = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.mensagem || 'Não foi possível concluir a solicitação.');
  return result;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
}

function renderEvent(evento) {
  currentEvent = evento;
  $('#event-date').textContent = formatDate(evento.dataIso);
  $('#event-address').textContent = evento.endereco;
  $('#event-note').textContent = evento.observacoes;
  $('#open-map').hidden = !evento.mapa;
  if (evento.mapa) $('#open-map').href = evento.mapa;
}

function suggestionItem(sugestao) {
  const imagem = sugestao.imagem
    ? `<img class="suggestion-image" src="${escapeHtml(sugestao.imagem)}" alt="" loading="lazy" width="72" height="72" />`
    : '<span class="suggestion-image suggestion-placeholder" aria-hidden="true">♡</span>';
  const descricao = sugestao.descricao ? `<p>${escapeHtml(sugestao.descricao)}</p>` : '';
  return `<li class="suggestion">${imagem}<div><h3>${escapeHtml(sugestao.item)}</h3>${descricao}</div></li>`;
}

function renderSuggestions(sugestoes) {
  $('#suggestion-list').innerHTML = sugestoes.map(suggestionItem).join('');
  $('#presentes').hidden = !sugestoes.length;
}

function renderLoadError() {
  ['#event-date', '#event-address', '#event-note'].forEach((selector) => { $(selector).textContent = 'Indisponível no momento'; });
  $('#suggestion-list').innerHTML = '<li class="suggestion-error">Não foi possível carregar as sugestões agora. Tente novamente em alguns instantes.</li>';
}

async function copyText(button, text, copiedLabel) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = copiedLabel;
  } catch {
    button.textContent = 'Não foi possível copiar';
  }
  setTimeout(() => { button.textContent = label; }, 1800);
}

$('#copy-address').addEventListener('click', () => {
  if (currentEvent) copyText($('#copy-address'), currentEvent.endereco, 'Endereço copiado!');
});

async function loadAll({ quiet = false } = {}) {
  if (!apiConfigured) {
    if (!quiet) renderLoadError();
    return;
  }
  try {
    const { evento, sugestoes = [] } = await read('configuracao');
    renderEvent(evento);
    renderSuggestions(sugestoes);
    writeCache(evento, sugestoes);
  } catch (error) {
    // sem rede: o que já estava em cache continua na tela
    if (!quiet) renderLoadError();
  }
}

function toggleAttendance() {
  const vai = document.querySelector('input[name="resposta"]:checked')?.value !== 'nao';
  $('#name-label').hidden = !vai;
  $('#guest-name').disabled = !vai;
}

document.querySelectorAll('input[name="resposta"]').forEach((input) => input.addEventListener('change', toggleAttendance));

$('#rsvp-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const resposta = form.get('resposta');
  const nome = String(form.get('nome') || '').trim();
  const message = $('#rsvp-message');
  const button = $('#rsvp-submit');
  if (resposta === 'sim' && !nome) {
    message.textContent = 'Informe o seu nome.';
    return;
  }
  message.textContent = 'Enviando...';
  button.disabled = true;
  try {
    const saved = localStorage.getItem(rsvpKey);
    const { token, mensagem } = await request('confirmarPresenca', { resposta, nome: resposta === 'sim' ? nome : '', token: saved || undefined });
    localStorage.setItem(rsvpKey, token);
    message.textContent = mensagem;
    if (resposta === 'sim') celebrate();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

const cached = readCache();
if (cached && cached.evento && Array.isArray(cached.sugestoes)) {
  renderEvent(cached.evento);
  renderSuggestions(cached.sugestoes);
  loadAll({ quiet: true });
} else {
  loadAll();
}
