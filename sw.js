// Alterei o nome para v3 para forçar a atualização nos celulares dos usuários
const CACHE_NAME = 'gh-orcamentos-cache-v3';

const urlsToCache = [
    './',
    './Index.html',
    './style.css',
    './script.js',
    './pdf-generator.js',
    './backup.js',
    './assets/logo.png', // Certifique-se que esta pasta existe
    './assets/icone.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js', // Adicionei o Chart.js ao cache
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Força o novo Service Worker a assumir imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache v3 aberto.');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    // Não cachear requisições do Firebase (Firestore/Auth)
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('auth')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    (response) => {
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Não cachear backups JSON
                                if (!event.request.url.endsWith('.json')) {
                                    cache.put(event.request, responseToCache);
                                }
                            });
                        return response;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});