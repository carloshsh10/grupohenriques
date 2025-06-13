// Define o nome do cache e os arquivos que serão armazenados
const CACHE_NAME = 'gh-orcamentos-cache-v2';
const urlsToCache = [
    '/',
    'Index.html',
    'style.css',
    'script.js',
    'pdf-generator.js',
    'backup.js',
    'assets/logo.png',
    'assets/favicon.ico',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
];

// Evento 'install': Salva os arquivos essenciais no cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto. Adicionando arquivos da aplicação.');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento 'fetch': Intercepta as requisições
// 1. Tenta encontrar o arquivo no cache
// 2. Se não encontrar, busca na rede
// 3. Se a busca na rede for bem-sucedida, retorna o resultado e salva uma cópia no cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Se o arquivo estiver no cache, retorna ele
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Se não, busca na rede
                return fetch(event.request).then(
                    networkResponse => {
                        // Verifica se a resposta da rede é válida
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Clona a resposta para poder ser usada pelo cache e pelo navegador
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Não armazenar em cache as requisições de backup
                                if (!event.request.url.endsWith('.json')) {
                                     cache.put(event.request, responseToCache);
                                }
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.log('Fetch falhou; provavelmente offline.', error);
                    // Aqui você poderia retornar uma página de "offline" genérica se quisesse
                });
            })
    );
});

// Evento 'activate': Limpa caches antigos para manter tudo atualizado
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
