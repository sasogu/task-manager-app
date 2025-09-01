(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(err => {
        console.log('ServiceWorker registro fallido:', err);
      });
    });
  }
})();

