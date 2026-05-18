export function hideLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('out');
}

export function showLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.remove('out');
}
