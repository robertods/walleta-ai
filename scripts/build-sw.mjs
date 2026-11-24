import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : path;
  }));
  return nested.flat();
}

const files = (await listFiles('dist')).filter(path => path !== join('dist', 'sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(file));
const paths = files.map(path => './' + path.slice(5).replaceAll('\\', '/'));
const worker = `
const prefix = 'walleta-' + self.registration.scope + '-';
const cacheName = prefix + ${JSON.stringify(hash.digest('hex').slice(0, 16))};
const files = ${JSON.stringify(paths)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    files.map(file => new Request(new URL(file, self.registration.scope), { cache: 'reload' }))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const key = event.request.mode === 'navigate'
      ? new URL('./index.html', self.registration.scope) : event.request;
    return (await cache.match(key)) ?? fetch(event.request);
  })());
});
`;
await writeFile('dist/sw.js', worker);
