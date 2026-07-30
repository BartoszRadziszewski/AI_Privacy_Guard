// Pomocnicze operacje na DOM: transkrypt, statusy, linki eksportu.

const transcript = document.getElementById('transcript');
const statusBadge = document.getElementById('connection-status');
const contextStatus = document.getElementById('context-status');
const exportLinks = document.getElementById('export-links');

let interimBubble = null;

export function setConnectionState(state, label) {
  statusBadge.dataset.state = state;
  statusBadge.textContent = label;
}

export function addBubble(role, text) {
  clearInterim();
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  transcript.appendChild(bubble);
  transcript.scrollTop = transcript.scrollHeight;
  return bubble;
}

export function showInterim(text) {
  if (!interimBubble) {
    interimBubble = document.createElement('div');
    interimBubble.className = 'bubble user interim';
    transcript.appendChild(interimBubble);
  }
  interimBubble.textContent = text;
  transcript.scrollTop = transcript.scrollHeight;
}

export function clearInterim() {
  if (interimBubble) {
    interimBubble.remove();
    interimBubble = null;
  }
}

export function setContextStatus(chars) {
  contextStatus.textContent = chars > 0 ? `Kontekst: ${chars} znaków` : 'Kontekst: pusty';
}

export function showExportLinks(files) {
  exportLinks.innerHTML = '';
  const labels = { markdown: 'Specyfikacja (.md)', json: 'Specyfikacja (.json)', docx: 'Specyfikacja (.docx)' };
  for (const [kind, url] of Object.entries(files)) {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.textContent = `⬇ ${labels[kind] ?? kind}`;
    exportLinks.appendChild(link);
  }
}
