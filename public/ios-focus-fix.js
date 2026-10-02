(() => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  const viewport = document.querySelector('meta[name="viewport"]');
  const locked = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';

  function lockViewport() {
    if (viewport) viewport.setAttribute('content', locked);
  }

  function normalizeViewport() {
    lockViewport();
    requestAnimationFrame(() => window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' }));
    setTimeout(() => {
      lockViewport();
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
    }, 120);
  }

  document.addEventListener('focusin', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'email') return;
    lockViewport();
    target.style.fontSize = '18px';
  }, true);

  document.addEventListener('focusout', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'email') return;
    normalizeViewport();
  }, true);

  window.visualViewport?.addEventListener('resize', () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.type === 'email') lockViewport();
  });
})();
