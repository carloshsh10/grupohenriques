// Define o nome do cache e os arquivos que serão armazenados
// Atualizei a versão para v3 para forçar a atualização imediata no celular
const CACHE_NAME = 'gh-orcamentos-cache-v3';

const urlsToCache = [
    './',                // Mudado de '/' para './' (Pasta atual)
    './index.html',      // Mudado de 'Index.html' para './index.html' (Minúsculo e relativo)
    './style.css',
    './script.js',
    './pdf-generator.js',
    './backup.js',
    './assets/logo.png',
    './assets/icone.png', 
    // Certifique-se que o favicon existe ou remova a linha abaixo se der erro 404 nele
    // './assets/favicon.ico', 
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
];

// Evento 'install': Salva os arquivos essenciais no cache
self.addEventListener('install', event => {
    // Força o SW a ativar imediatamente
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache v3 aberto. Adicionando arquivos.');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento 'fetch': Intercepta as requisições
self.addEventListener('fetch', event => {
    // Ignora requisições do Firebase/Google para não quebrar a autenticação
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('auth')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(
                    networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Não cachear arquivos JSON de backup
                                if (!event.request.url.endsWith('.json')) {
                                     cache.put(event.request, responseToCache);
                                }
                            });
                        return networkResponse;
                    }
                ).catch(error => {
                    console.log('Fetch falhou (Offline):', error);
                });
            })
    );
});

// Evento 'activate': Limpa caches antigos
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
