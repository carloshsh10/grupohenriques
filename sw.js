// =======================================================
// ========= SERVICE WORKER - VERSÃO 6.0 (CORRIGIDO) =====
// =======================================================

// Define o nome do cache - Atualizado para v6 para forçar atualização
const CACHE_NAME = 'gh-orcamentos-cache-v6';

// Lista de arquivos para salvar no celular (Offline)
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

// 1. INSTALAÇÃO: Baixa os arquivos essenciais
self.addEventListener('install', event => {
    self.skipWaiting(); // Força o SW a ativar imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache v6 aberto e arquivos cacheados.');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. INTERCEPTAÇÃO DE REDE (FETCH): O Coração do problema
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // --- BLOQUEIO DE CACHE PARA AUTH E BANCO DE DADOS ---
    // Se a URL for do Google, Firebase ou Autenticação, NÃO cacheia.
    // Deixa passar direto para a rede. Isso corrige o erro de conexão no mobile.
    if (url.includes('firestore.googleapis.com') || 
        url.includes('googleapis.com') || 
        url.includes('firebaseapp.com') || 
        url.includes('accounts.google.com') ||
        url.includes('/auth') ||
        url.includes('google.com/js')) {
        
        return; // Sai da função, permitindo conexão direta
    }

    // --- ESTRATÉGIA DE CACHE PADRÃO ---
    // Tenta pegar do cache primeiro; se não tiver, busca na rede e salva.
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se encontrou no cache, retorna ele
                if (response) { return response; }

                // Se não, busca na rede
                return fetch(event.request).then(
                    response => {
                        // Verifica se a resposta é válida
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clona a resposta para salvar no cache
                        const responseToCache = response.clone();

                        // Abre o cache e salva o novo arquivo (exceto arquivos .json de backup)
                        caches.open(CACHE_NAME)
                            .then((cache) => {
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

// 3. ATIVAÇÃO: Limpa caches antigos (v1, v2, v5...) para liberar espaço
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});