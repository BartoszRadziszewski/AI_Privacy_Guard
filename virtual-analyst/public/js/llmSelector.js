// Przełącznik modeli AI — zasila <select> danymi z /api/config i zgłasza zmiany.

export async function initLlmSelector(selectElement, onChange) {
  const response = await fetch('/api/config');
  const config = await response.json();

  selectElement.innerHTML = '';
  for (const [key, provider] of Object.entries(config.providers)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = provider.available
      ? `${provider.label} (${provider.model})`
      : `${provider.label} — brak klucza API`;
    option.disabled = !provider.available;
    selectElement.appendChild(option);
  }

  const defaultProvider = config.providers[config.defaultProvider]?.available
    ? config.defaultProvider
    : Object.entries(config.providers).find(([, p]) => p.available)?.[0];

  if (defaultProvider) selectElement.value = defaultProvider;

  selectElement.addEventListener('change', () => onChange(selectElement.value));

  return { config, provider: selectElement.value };
}
