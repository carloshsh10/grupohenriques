// =======================================================
// ========= SERVICE WORKER - VERSÃO FINAL 8.0 ===========
// =======================================================

const CACHE_NAME = 'gh-orcamentos-v8-final';

// Arquivos que serão salvos para funcionar Offline
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './pdf-generator.js',
    './backup.js',
    './assets/logo.png',
    './assets/icone.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
];

// 1. Instalação do Service Worker
self.addEventListener('install', event => {
    self.skipWaiting(); // Força ativação imediata
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache v8 instalado.');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. Interceptação de Rede (A CORREÇÃO DO LOGIN ESTÁ AQUI)
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // --- LÓGICA DE BYPASS (IGNORAR CACHE) ---
    // Se a URL tiver parâmetros de busca (como ?code= do Google Auth),
    // ou for relacionada ao Firebase/Google, ou for uma navegação HTML principal:
    // NUNCA use o cache. Vá direto para a rede.
    if (requestUrl.search !== '' || 
        requestUrl.hostname.includes('firebase') || 
        requestUrl.hostname.includes('google') ||
        requestUrl.hostname.includes('gstatic') ||
        event.request.mode === 'navigate') {
        
        // Network Only (Sem Cache)
        event.respondWith(fetch(event.request));
        return;
    }

    // --- LÓGICA PADRÃO (Cache First, Network Fallback) ---
    // Para arquivos estáticos (CSS, JS, Imagens)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se achou no cache, retorna
                if (response) {
                    return response;
                }
                
                // Se não, busca na rede
                return fetch(event.request).then(networkResponse => {
                    // Verifica se a resposta é válida antes de cachear
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Clona e salva no cache para a próxima vez
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    // Se falhar (ex: sem internet e sem cache), não faz nada (ou poderia retornar uma página de offline)
                });
            })
    );
});

// 3. Ativação e Limpeza de Caches Antigos
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