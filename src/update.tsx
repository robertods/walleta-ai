import { useEffect, useRef, useState } from 'preact/hooks';

export function UpdateNotice() {
  const [worker, setWorker] = useState<ServiceWorker>();
  const [dismissed, setDismissed] = useState<ServiceWorker>();
  const [updating, setUpdating] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    const serviceWorkers = navigator.serviceWorker;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let disposed = false;

    function checkWaiting() {
      setWorker(serviceWorkers.controller ? registration?.waiting ?? undefined : undefined);
    }

    function watchInstallation() {
      installing?.removeEventListener('statechange', checkWaiting);
      installing = registration?.installing ?? null;
      installing?.addEventListener('statechange', checkWaiting);
      checkWaiting();
    }

    function onControllerChange() {
      if (requested.current) location.reload();
      else checkWaiting();
    }

    function checkForUpdate() {
      if (document.visibilityState === 'visible') {
        checkWaiting();
        void registration?.update().catch(() => {
          // A cached version remains usable if the device is offline.
        });
      }
    }

    serviceWorkers.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('online', checkForUpdate);

    void serviceWorkers.register('./sw.js').then(result => {
      if (disposed) return;
      registration = result;
      registration.addEventListener('updatefound', watchInstallation);
      watchInstallation();
    }).catch(error => console.error('Walleta: caché offline', error));

    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', watchInstallation);
      installing?.removeEventListener('statechange', checkWaiting);
      serviceWorkers.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
    };
  }, []);

  if (!worker || worker === dismissed) return null;

  function applyUpdate() {
    if (!worker || requested.current) return;
    requested.current = true;
    setUpdating(true);
    worker.postMessage('WALLETA_ACTIVATE_UPDATE');
  }

  return <aside class="update-notice panel" aria-label="Actualización de Walleta">
    <div role="status">
      <strong>{updating ? 'Actualizando Walleta…' : 'Nueva versión disponible'}</strong>
      {!updating && <p>Si tenés cambios sin guardar, guardalos antes de actualizar.</p>}
    </div>
    <div class="update-actions">
      <button class="secondary" disabled={updating} onClick={() => setDismissed(worker)}>Más tarde</button>
      <button class="primary" disabled={updating} onClick={applyUpdate}>Actualizar</button>
    </div>
  </aside>;
}
