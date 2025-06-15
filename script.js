// Variáveis globais (agora serão preenchidas pelo Firebase)
let clientes = [];
let produtos = [];
let orcamentos = [];
let proximoOrcamentoId = 1;

let currentOrcamento = {
    id: generateSequentialId(true),
    clienteId: null,
    itens: [],
    maoDeObra: 0,
    relatorio: "",
    formasPagamento: "",
    servicos: "", // Novo campo para descrição de serviços
    faturamentoData: null, // Para armazenar dados de faturamento
    nfeChaves: [] // Agora armazenará objetos { chave: '', fornecedor: '' }
};

let isEditingItem = false;
let editingItemIndex = -1;

// Variáveis globais para Firebase (disponíveis no escopo global após index.html)
// const auth = firebase.auth(); // Já inicializado no index.html
// const db = firebase.firestore(); // Já inicializado no index.html
let currentUser = null; // Para armazenar o usuário logado

// Elementos de UI para status de conexão e autenticação
const connectionStatusSpan = document.getElementById('connection-status');
const googleLoginBtn = document.getElementById('google-login-btn');
const googleLogoutBtn = document.getElementById('google-logout-btn');
const userDisplaySpan = document.getElementById('user-display');

// Função para atualizar o status da conexão na interface
function updateConnectionStatus(status, color = 'grey') {
    connectionStatusSpan.textContent = status;
    connectionStatusSpan.style.color = color;
    window.firebaseConnectionStatus = status; // Atualiza a variável global
}

// Inicialização do aplicativo
document.addEventListener('DOMContentLoaded', function() {
    configurarEventListeners();
    // carregarDadosIniciais() será chamado pelo auth.onAuthStateChanged
    showSection('clientes'); // Mostra a seção de clientes por padrão
    
    // A renderização de orçamentos e faturamentos agora depende do carregamento do Firebase
    // renderizarOrcamentosSalvos();
    // renderizarFaturamentosGerados();

    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
});

function configurarEventListeners() {
    // Navegação
    document.querySelectorAll('nav a[id^="nav-"]').forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.id.replace('nav-', '');
            showSection(sectionId);
            // Re-renderiza as listas relevantes ao navegar para suas seções
            if (sectionId === 'clientes') {
                renderizarClientes();
            } else if (sectionId === 'produtos') {
                renderizarProdutos();
            } else if (sectionId === 'orcamentos') {
                carregarOrcamentoAtual(); // Recarrega o orçamento atual no formulário
                renderizarItensOrcamento(); // Recarrega os itens do orçamento atual
                renderizarOrcamentosSalvos(); // Atualiza a lista de orçamentos salvos
                carregarClientesNoSelect('orcamento-cliente'); // Garante que o select de clientes está atualizado
            } else if (sectionId === 'faturamento') {
                renderizarFaturamentosGerados(); // Atualiza a lista de faturamentos
                carregarOrcamentosNoSelect('faturamento-orcamento-vinculado'); // Atualiza os selects
            } else if (sectionId === 'notas') {
                renderizarNFesAtuais(); // Atualiza a lista de NFes do orçamento atual
                renderizarTodasNFes(); // Atualiza a lista de todas as NFes
                carregarOrcamentosNoSelect('nfe-orcamento-vinculado'); // Atualiza os selects
            }
        });
    });

    // Modals
    document.getElementById('close-cliente-modal').addEventListener('click', closeClienteModal);
    document.getElementById('close-produto-modal').addEventListener('click', closeProdutoModal);
    document.getElementById('close-item-modal').addEventListener('click', closeModal);
    document.getElementById('close-orcamento-salvo-modal').addEventListener('click', closeOrcamentoSalvoModal);
    document.getElementById('close-importar-itens-modal').addEventListener('click', closeImportarItensModal);
    document.getElementById('close-produtos-categoria-modal').addEventListener('click', closeProdutosCategoriaModal);


    // Forms submissions
    document.getElementById('clienteForm').addEventListener('submit', function(e) {
        e.preventDefault();
        salvarCliente();
    });
    document.getElementById('produtoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        salvarProduto();
    });
    document.getElementById('itemForm').addEventListener('submit', function(e) {
        e.preventDefault();
        salvarItemOrcamento();
    });

    // Autenticação Firebase
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        updateConnectionStatus("Conectando...", "orange");
        auth.signInWithPopup(provider)
            .then((result) => {
                currentUser = result.user;
                updateConnectionStatus("Conectado", "green");
                userDisplaySpan.textContent = `Olá, ${currentUser.displayName}!`;
                googleLoginBtn.style.display = 'none';
                googleLogoutBtn.style.display = 'inline-flex';
                carregarDadosDoFirebase(); // Carrega dados após o login
                alert(`Bem-vindo, ${currentUser.displayName}!`);
            })
            .catch((error) => {
                console.error("Erro no login: ", error);
                updateConnectionStatus("Erro de conexão Firebase", "red");
                alert(`Erro ao tentar fazer login: ${error.message}`);
            });
    });

    googleLogoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            currentUser = null;
            updateConnectionStatus("Desconectado", "grey");
            userDisplaySpan.textContent = '';
            googleLoginBtn.style.display = 'inline-flex';
            googleLogoutBtn.style.display = 'none';
            // Limpa dados locais após logout
            clientes = [];
            produtos = [];
            orcamentos = [];
            proximoOrcamentoId = 1;
            currentOrcamento = {
                id: generateSequentialId(true),
                clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: []
            };
            carregarDadosIniciais(); // Renderiza com dados vazios
            alert("Você foi desconectado.");
        }).catch((error) => {
            console.error("Erro no logout: ", error);
            alert(`Erro ao fazer logout: ${error.message}`);
        });
    });

    // Observador de estado de autenticação - Garante que os dados são carregados quando o usuário acessa
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            updateConnectionStatus("Conectado", "green");
            userDisplaySpan.textContent = `Olá, ${currentUser.displayName}!`;
            googleLoginBtn.style.display = 'none';
            googleLogoutBtn.style.display = 'inline-flex';
            carregarDadosDoFirebase(); // Carrega dados quando o usuário já está logado ou faz login
        } else {
            currentUser = null;
            updateConnectionStatus("Desconectado", "grey");
            userDisplaySpan.textContent = '';
            googleLoginBtn.style.display = 'inline-flex';
            googleLogoutBtn.style.display = 'none';
            // Limpa os dados se não houver usuário logado
            clientes = [];
            produtos = [];
            orcamentos = [];
            proximoOrcamentoId = 1;
            currentOrcamento = {
                id: generateSequentialId(true),
                clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: []
            };
            carregarDadosIniciais(); // Renderiza com dados vazios ou placeholders
        }
    });

}

// Funções de Gerenciamento de Dados com Firebase

// Função genérica para salvar um item em uma coleção do Firebase
async function salvarItemNoFirebase(collectionName, itemId, itemData) {
    if (!currentUser) {
        alert("Você precisa estar logado para salvar dados.");
        updateConnectionStatus("Erro: Não logado", "red");
        return;
    }
    updateConnectionStatus(`Salvando ${collectionName}...`, "blue");
    try {
        await db.collection('users').doc(currentUser.uid).collection(collectionName).doc(itemId).set(itemData);
        updateConnectionStatus("Banco de dados salvo com sucesso", "green");
        console.log(`${collectionName} ${itemId} salvo no Firebase!`);
    } catch (e) {
        console.error(`Erro ao salvar ${collectionName} no Firebase: `, e);
        updateConnectionStatus(`Erro ao salvar ${collectionName}`, "red");
        alert(`Erro ao salvar ${collectionName} no Firebase: ${e.message}`);
    }
}

// Função genérica para deletar um item de uma coleção do Firebase
async function deletarItemDoFirebase(collectionName, itemId) {
    if (!currentUser) {
        alert("Você precisa estar logado para deletar dados.");
        updateConnectionStatus("Erro: Não logado", "red");
        return false;
    }
    updateConnectionStatus(`Deletando ${collectionName}...`, "blue");
    try {
        await db.collection('users').doc(currentUser.uid).collection(collectionName).doc(itemId).delete();
        updateConnectionStatus("Item deletado com sucesso", "green");
        console.log(`${collectionName} ${itemId} deletado do Firebase!`);
        return true;
    } catch (e) {
        console.error(`Erro ao deletar ${collectionName} do Firebase: `, e);
        updateConnectionStatus(`Erro ao deletar ${collectionName}`, "red");
        alert(`Erro ao deletar ${collectionName} do Firebase: ${e.message}`);
        return false;
    }
}

// Função para carregar todos os dados do Firebase para as variáveis globais
async function carregarDadosDoFirebase() {
    if (!currentUser) {
        updateConnectionStatus("Não logado, dados não carregados", "grey");
        return;
    }
    updateConnectionStatus("Carregando dados...", "blue");
    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);

        // Carregar Clientes
        const clientesSnapshot = await userDocRef.collection('clientes').get();
        clientes = clientesSnapshot.docs.map(doc => doc.data());
        renderizarClientes();

        // Carregar Produtos
        const produtosSnapshot = await userDocRef.collection('produtos').get();
        produtos = produtosSnapshot.docs.map(doc => doc.data());
        renderizarProdutos(); // Renderiza a tabela de produtos
        carregarCategoriasNoFiltroProduto(); // Atualiza o filtro de categorias

        // Carregar Orçamentos
        const orcamentosSnapshot = await userDocRef.collection('orcamentos').get();
        orcamentos = orcamentosSnapshot.docs.map(doc => doc.data());
        renderizarOrcamentosSalvos();
        renderizarFaturamentosGerados();
        carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
        carregarOrcamentosNoSelect('nfe-orcamento-vinculado');

        // Carregar Próximo ID de Orçamento (metadados)
        const metaDoc = await userDocRef.collection('metadata').doc('ids').get();
        if (metaDoc.exists) {
            proximoOrcamentoId = metaDoc.data().proximoOrcamentoId || 1;
        } else {
            proximoOrcamentoId = 1;
        }

        // Carregar Orçamento Atual da Sessão
        const currentOrcDoc = await userDocRef.collection('sessionData').doc('currentOrcamento').get();
        if (currentOrcDoc.exists) {
            currentOrcamento = currentOrcDoc.data();
            // Garante que nfeChaves é um array e converte entradas antigas se necessário
            if (!Array.isArray(currentOrcamento.nfeChaves)) {
                currentOrcamento.nfeChaves = [];
            } else {
                currentOrcamento.nfeChaves = currentOrcamento.nfeChaves.map(entry => {
                    if (typeof entry === 'string') {
                        return { chave: entry, fornecedor: '' };
                    }
                    return entry;
                }).filter(entry => entry !== null && entry !== undefined);
            }
        } else {
            // Inicializa um novo orçamento se não houver um salvo no Firebase
            currentOrcamento = {
                id: generateSequentialId(true),
                clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: []
            };
            // Salva o orçamento inicial para que ele exista no Firestore para o usuário
            await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);
        }
        carregarOrcamentoAtual(); // Popula o formulário com o orçamento atual
        renderizarItensOrcamento(); // Renderiza os itens do orçamento atual
        renderizarNFesAtuais(); // Renderiza as NFes do orçamento atual

        // Carregar Configurações da Empresa
        const configDoc = await userDocRef.collection('settings').doc('empresaConfig').get();
        if (configDoc.exists) {
            const config = configDoc.data();
            document.getElementById('empresa-nome').value = config.nome || '';
            document.getElementById('empresa-cnpj').value = config.cnpj || '';
            document.getElementById('empresa-contato1').value = config.contato1 || '';
            document.getElementById('empresa-contato2').value = config.contato2 || '';
            document.getElementById('empresa-endereco').value = config.endereco || '';
        }

        updateConnectionStatus("Dados carregados com sucesso", "green");

    } catch (e) {
        console.error("Erro ao carregar dados do Firebase: ", e);
        updateConnectionStatus("Erro ao carregar do Firebase", "red");
        alert(`Erro ao carregar dados do Firebase: ${e.message}`);
    }
}


// Funções de Geração de ID
function generateAlphanumericUniqueId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateSequentialId(forNewOrcamento = false) {
    if (forNewOrcamento) {
        return proximoOrcamentoId++;
    }
    // Lógica para outros IDs sequenciais se necessário
    return Math.floor(Date.now() / 1000); // Exemplo de ID baseado em timestamp
}


// ***** Funções de Gerenciamento de Clientes *****

function openClienteModal(cliente = null) {
    const modal = document.getElementById('clienteModal');
    const form = document.getElementById('clienteForm');
    const title = modal.querySelector('h3');
    form.reset();

    if (cliente) {
        document.getElementById('cliente-id').value = cliente.id;
        document.getElementById('cliente-nome').value = cliente.nome;
        document.getElementById('cliente-contato').value = cliente.contato;
        document.getElementById('cliente-endereco').value = cliente.endereco;
        document.getElementById('cliente-cnpj-cpf').value = cliente.cnpjCpf;
        document.getElementById('cliente-ie-rg').value = cliente.ieRg;
        title.textContent = 'Editar Cliente';
        form.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-edit"></i> Atualizar Cliente';
    } else {
        document.getElementById('cliente-id').value = '';
        title.textContent = 'Adicionar Cliente';
        form.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-user-plus"></i> Adicionar Cliente';
    }
    modal.classList.add('active');
}

function closeClienteModal() {
    document.getElementById('clienteModal').classList.remove('active');
}

async function salvarCliente() {
    const id = document.getElementById('cliente-id').value || generateAlphanumericUniqueId();
    const nome = document.getElementById('cliente-nome').value.trim();
    const contato = document.getElementById('cliente-contato').value.trim();
    const endereco = document.getElementById('cliente-endereco').value.trim();
    const cnpjCpf = document.getElementById('cliente-cnpj-cpf').value.trim();
    const ieRg = document.getElementById('cliente-ie-rg').value.trim();

    if (!nome || !contato) {
        alert('Nome e Contato do cliente são obrigatórios.');
        return;
    }

    const novoCliente = { id, nome, contato, endereco, cnpjCpf, ieRg };

    const clienteExistenteIndex = clientes.findIndex(c => c.id === id);

    if (clienteExistenteIndex > -1) {
        clientes[clienteExistenteIndex] = novoCliente;
    } else {
        clientes.push(novoCliente);
    }

    // Salva o cliente individualmente no Firebase
    await salvarItemNoFirebase('clientes', id, novoCliente);

    renderizarClientes();
    closeClienteModal();
    carregarClientesNoSelect('orcamento-cliente'); // Atualiza o select de clientes no orçamento
}

async function deletarCliente(id) {
    if (confirm('Tem certeza que deseja deletar este cliente? Isso também removerá os orçamentos vinculados a ele.')) {
        const clienteIndex = clientes.findIndex(c => c.id === id);
        if (clienteIndex > -1) {
            clientes.splice(clienteIndex, 1);
            await deletarItemDoFirebase('clientes', id);

            // Remover orçamentos vinculados ao cliente
            const orcamentosParaRemover = orcamentos.filter(o => o.clienteId === id);
            for (const orc of orcamentosParaRemover) {
                await deletarItemDoFirebase('orcamentos', orc.id.toString()); // IDs de orçamento podem ser números, converter para string
            }
            orcamentos = orcamentos.filter(o => o.clienteId !== id);
            
            renderizarClientes();
            renderizarOrcamentosSalvos();
            renderizarFaturamentosGerados();
            carregarClientesNoSelect('orcamento-cliente');
            carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
            carregarOrcamentosNoSelect('nfe-orcamento-vinculado');
            alert('Cliente e orçamentos vinculados deletados com sucesso.');
        }
    }
}

function renderizarClientes() {
    const tableBody = document.querySelector('#clientes-table tbody');
    tableBody.innerHTML = '';
    const searchTerm = document.getElementById('cliente-search').value.toLowerCase();

    clientes.filter(cliente => 
        cliente.nome.toLowerCase().includes(searchTerm) ||
        cliente.contato.toLowerCase().includes(searchTerm) ||
        cliente.cnpjCpf.toLowerCase().includes(searchTerm)
    ).forEach(cliente => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${cliente.nome}</td>
            <td>${cliente.contato}</td>
            <td>${cliente.endereco || '-'}</td>
            <td>${cliente.cnpjCpf || '-'}</td>
            <td>${cliente.ieRg || '-'}</td>
            <td>
                <button class="btn-edit" onclick="openClienteModal(${JSON.stringify(cliente).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deletarCliente('${cliente.id}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
    });
}

function filterClientes() {
    renderizarClientes();
}

function carregarClientesNoSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    clientes.forEach(cliente => {
        select.innerHTML += `<option value="${cliente.id}">${cliente.nome} (${cliente.contato})</option>`;
    });
    // Se estiver no formulário de orçamento, tenta pré-selecionar
    if (selectId === 'orcamento-cliente' && currentOrcamento.clienteId) {
        select.value = currentOrcamento.clienteId;
        const clienteInfoSpan = document.getElementById('cliente-info');
        const selectedClient = clientes.find(c => c.id === currentOrcamento.clienteId);
        if (selectedClient) {
            clienteInfoSpan.textContent = `CNPJ/CPF: ${selectedClient.cnpjCpf || 'N/A'}, Endereço: ${selectedClient.endereco || 'N/A'}`;
        } else {
            clienteInfoSpan.textContent = '';
        }
    }
}


// ***** Funções de Gerenciamento de Produtos *****

function openProdutoModal(produto = null) {
    const modal = document.getElementById('produtoModal');
    const form = document.getElementById('produtoForm');
    const title = modal.querySelector('h3');
    form.reset();

    if (produto) {
        document.getElementById('produto-id').value = produto.id;
        document.getElementById('produto-nome-proposta').value = produto.nomeProposta;
        document.getElementById('produto-nome-completo').value = produto.nomeCompleto;
        document.getElementById('produto-valor').value = produto.valor;
        document.getElementById('produto-categoria').value = produto.categoria;
        title.textContent = 'Editar Produto/Serviço';
        form.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-edit"></i> Atualizar Produto/Serviço';
    } else {
        document.getElementById('produto-id').value = '';
        title.textContent = 'Adicionar Produto/Serviço';
        form.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Produto/Serviço';
    }
    modal.classList.add('active');
}

function closeProdutoModal() {
    document.getElementById('produtoModal').classList.remove('active');
}

async function salvarProduto() {
    const id = document.getElementById('produto-id').value || generateAlphanumericUniqueId();
    const nomeProposta = document.getElementById('produto-nome-proposta').value.trim();
    const nomeCompleto = document.getElementById('produto-nome-completo').value.trim();
    const valor = parseFloat(document.getElementById('produto-valor').value);
    const categoria = document.getElementById('produto-categoria').value.trim() || 'Geral';

    if (!nomeProposta || isNaN(valor) || valor <= 0) {
        alert('Nome para Proposta e Valor devem ser preenchidos e válidos.');
        return;
    }

    const novoProduto = { id, nomeProposta, nomeCompleto, valor, categoria };

    const produtoExistenteIndex = produtos.findIndex(p => p.id === id);

    if (produtoExistenteIndex > -1) {
        produtos[produtoExistenteIndex] = novoProduto;
    } else {
        produtos.push(novoProduto);
    }

    await salvarItemNoFirebase('produtos', id, novoProduto);

    renderizarProdutos();
    carregarCategoriasNoFiltroProduto();
    closeProdutoModal();
}

async function deletarProduto(id) {
    if (confirm('Tem certeza que deseja deletar este produto/serviço?')) {
        const produtoIndex = produtos.findIndex(p => p.id === id);
        if (produtoIndex > -1) {
            produtos.splice(produtoIndex, 1);
            await deletarItemDoFirebase('produtos', id);
            renderizarProdutos();
            carregarCategoriasNoFiltroProduto();
            alert('Produto/Serviço deletado com sucesso.');
        }
    }
}

function renderizarProdutos() {
    const tableBody = document.querySelector('#produtos-table tbody');
    tableBody.innerHTML = '';
    const searchTerm = document.getElementById('produto-search').value.toLowerCase();
    const categoriaFilter = document.getElementById('produto-categoria-filter').value;

    produtos.filter(produto => 
        (produto.nomeProposta.toLowerCase().includes(searchTerm) || 
         produto.nomeCompleto.toLowerCase().includes(searchTerm)) &&
        (categoriaFilter === '' || (produto.categoria || 'Geral') === categoriaFilter)
    ).forEach(produto => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${produto.id.substring(0, 5)}...</td>
            <td>${produto.nomeProposta}</td>
            <td>${produto.nomeCompleto}</td>
            <td>R$ ${produto.valor.toFixed(2).replace('.', ',')}</td>
            <td>${produto.categoria || 'Geral'}</td>
            <td>
                <button class="btn-edit" onclick="openProdutoModal(${JSON.stringify(produto).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deletarProduto('${produto.id}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
    });
}

function filterProdutos() {
    renderizarProdutos();
}

function carregarCategoriasNoFiltroProduto() {
    const select = document.getElementById('produto-categoria-filter');
    select.innerHTML = '<option value="">Todas as Categorias</option>';
    const categorias = [...new Set(produtos.map(p => p.categoria || 'Geral'))].sort();
    categorias.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function openProdutosCategoriaModal() {
    const modal = document.getElementById('produtosCategoriaModal');
    const modalBody = document.getElementById('produtos-categoria-modal-body');
    modalBody.innerHTML = ''; // Limpa o conteúdo anterior

    const categorias = [...new Set(produtos.map(p => p.categoria || 'Geral'))].sort();

    if (categorias.length === 0) {
        modalBody.innerHTML = '<p>Nenhuma categoria de produto encontrada.</p>';
        modal.classList.add('active');
        return;
    }

    categorias.forEach(categoria => {
        const categoriaDiv = document.createElement('div');
        categoriaDiv.classList.add('categoria-list-item');
        categoriaDiv.innerHTML = `<h4>${categoria}</h4>`;
        const ul = document.createElement('ul');
        
        const produtosDaCategoria = produtos.filter(p => (p.categoria || 'Geral') === categoria);
        produtosDaCategoria.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.nomeProposta} (R$ ${p.valor.toFixed(2).replace('.', ',')})`;
            ul.appendChild(li);
        });
        categoriaDiv.appendChild(ul);
        modalBody.appendChild(categoriaDiv);
    });

    modal.classList.add('active');
}

function closeProdutosCategoriaModal() {
    document.getElementById('produtosCategoriaModal').classList.remove('active');
}


// ***** Funções de Gerenciamento de Orçamentos (Criação) *****

function openItemModal(item = null, index = -1) {
    const modal = document.getElementById('itemModal');
    const form = document.getElementById('itemForm');
    form.reset();
    isEditingItem = false;
    editingItemIndex = -1;

    carregarCategoriasNoModalItem(); // Carrega categorias sempre
    
    if (item) {
        isEditingItem = true;
        editingItemIndex = index;
        document.getElementById('modal-item-nome').value = item.nome;
        document.getElementById('modal-item-quantidade').value = item.quantidade;
        document.getElementById('modal-item-valor-unitario').value = item.valorUnitario;
        // Pre-selecionar categoria e produto no modal se o item tiver um produto associado
        const produtoOriginal = produtos.find(p => p.nomeProposta === item.nome && p.valor === item.valorUnitario);
        if (produtoOriginal) {
            document.getElementById('modal-item-categoria').value = produtoOriginal.categoria || '';
            carregarProdutosNoModalPorCategoria(); // Recarrega os produtos daquela categoria
            document.getElementById('modal-produto').value = produtoOriginal.id;
        }

        modal.querySelector('h3').textContent = 'Editar Item';
        modal.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-edit"></i> Atualizar Item';
    } else {
        carregarProdutosNoModalPorCategoria(); // Carrega produtos iniciais
        modal.querySelector('h3').textContent = 'Adicionar Item';
        modal.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Item';
    }
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('itemModal').classList.remove('active');
}

function carregarCategoriasNoModalItem() {
    const select = document.getElementById('modal-item-categoria');
    select.innerHTML = '<option value="">Todas as Categorias</option>';
    const categorias = [...new Set(produtos.map(p => p.categoria || 'Geral'))].sort();
    categorias.forEach(cat => select.innerHTML += `<option value="${cat}">${cat}</option>`);
}

function carregarProdutosNoModalPorCategoria() {
    const categoria = document.getElementById('modal-item-categoria').value;
    const select = document.getElementById('modal-produto');
    select.innerHTML = '<option value="">Selecione um produto...</option>';
    const produtosFiltrados = categoria ? produtos.filter(p => (p.categoria || 'Geral') === categoria) : produtos;
    produtosFiltrados.forEach(p => {
        const valorDisplay = `(R$ ${p.valor.toFixed(2).replace('.', ',')})`;
        select.innerHTML += `<option value="${p.id}" data-valor="${p.valor}" data-nome="${p.nomeProposta}" data-nome-completo="${p.nomeCompleto}">${p.nomeProposta} ${valorDisplay}</option>`;
    });
}

function atualizarModalItemValor() {
    const selectedProductId = document.getElementById('modal-produto').value;
    if (selectedProductId) {
        const selectedProduct = produtos.find(p => p.id === selectedProductId);
        if (selectedProduct) {
            document.getElementById('modal-item-nome').value = selectedProduct.nomeProposta;
            document.getElementById('modal-item-valor-unitario').value = selectedProduct.valor.toFixed(2);
        }
    } else {
        document.getElementById('modal-item-nome').value = '';
        document.getElementById('modal-item-valor-unitario').value = '';
    }
}

async function salvarItemOrcamento() {
    const nome = document.getElementById('modal-item-nome').value.trim();
    const quantidade = parseInt(document.getElementById('modal-item-quantidade').value);
    const valorUnitario = parseFloat(document.getElementById('modal-item-valor-unitario').value);

    if (!nome || isNaN(quantidade) || quantidade <= 0 || isNaN(valorUnitario) || valorUnitario < 0) {
        alert('Preencha todos os campos do item corretamente.');
        return;
    }

    const novoItem = {
        id: generateAlphanumericUniqueId(),
        nome,
        quantidade,
        valorUnitario
    };

    if (isEditingItem && editingItemIndex !== -1) {
        currentOrcamento.itens[editingItemIndex] = novoItem;
    } else {
        currentOrcamento.itens.push(novoItem);
    }
    
    // Salvar o currentOrcamento no Firebase após adicionar/editar item
    await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);

    renderizarItensOrcamento();
    atualizarTotalOrcamento();
    closeModal();
}

function editarItemOrcamento(index) {
    const item = currentOrcamento.itens[index];
    openItemModal(item, index);
}

async function deletarItemOrcamento(index) {
    if (confirm('Tem certeza que deseja remover este item do orçamento?')) {
        currentOrcamento.itens.splice(index, 1);
        // Salvar o currentOrcamento no Firebase após deletar item
        await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);
        renderizarItensOrcamento();
        atualizarTotalOrcamento();
    }
}

function renderizarItensOrcamento() {
    const tableBody = document.querySelector('#orcamento-itens-table tbody');
    tableBody.innerHTML = '';
    currentOrcamento.itens.forEach((item, index) => {
        const row = tableBody.insertRow();
        const totalItem = item.quantidade * item.valorUnitario;
        row.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>R$ ${item.valorUnitario.toFixed(2).replace('.', ',')}</td>
            <td>R$ ${totalItem.toFixed(2).replace('.', ',')}</td>
            <td>
                <button class="btn-edit" onclick="editarItemOrcamento(${index})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deletarItemOrcamento(${index})"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
    });
}

function atualizarTotalOrcamento() {
    const totalItens = currentOrcamento.itens.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);
    currentOrcamento.maoDeObra = parseFloat(document.getElementById('orcamento-mao-de-obra').value) || 0;
    const totalGeral = totalItens + currentOrcamento.maoDeObra;
    document.getElementById('total-orcamento').textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
    
    // Salva a mão de obra no currentOrcamento
    if (currentUser) { // Só tenta salvar se estiver logado
        currentOrcamento.maoDeObra = parseFloat(document.getElementById('orcamento-mao-de-obra').value) || 0;
        salvarItemNoFirebase('sessionData', 'currentOrcamento', { maoDeObra: currentOrcamento.maoDeObra }, { merge: true }); // Salva apenas o campo modificado
    }
}


function selecionarClienteOrcamento() {
    currentOrcamento.clienteId = document.getElementById('orcamento-cliente').value;
    const clienteInfoSpan = document.getElementById('cliente-info');
    const selectedClient = clientes.find(c => c.id === currentOrcamento.clienteId);
    if (selectedClient) {
        clienteInfoSpan.textContent = `CNPJ/CPF: ${selectedClient.cnpjCpf || 'N/A'}, Endereço: ${selectedClient.endereco || 'N/A'}`;
    } else {
        clienteInfoSpan.textContent = '';
    }
    // Salva o currentOrcamento no Firebase após mudar o cliente
    if (currentUser) {
        salvarItemNoFirebase('sessionData', 'currentOrcamento', { clienteId: currentOrcamento.clienteId }, { merge: true });
    }
}

async function salvarOrcamento() {
    if (!currentUser) {
        alert("Você precisa estar logado para salvar orçamentos.");
        return;
    }

    currentOrcamento.clienteId = document.getElementById('orcamento-cliente').value;
    currentOrcamento.maoDeObra = parseFloat(document.getElementById('orcamento-mao-de-obra').value) || 0;
    currentOrcamento.relatorio = document.getElementById('orcamento-relatorio').value.trim();
    currentOrcamento.formasPagamento = document.getElementById('orcamento-formas-pagamento').value.trim();
    currentOrcamento.servicos = document.getElementById('orcamento-servicos').value.trim();
    currentOrcamento.data = new Date().toISOString().split('T')[0]; // Data atual
    currentOrcamento.valorTotal = parseFloat(document.getElementById('total-orcamento').textContent.replace('R$ ', '').replace(',', '.'));

    if (!currentOrcamento.clienteId) {
        alert('Selecione um cliente para o orçamento.');
        return;
    }
    if (currentOrcamento.itens.length === 0 && currentOrcamento.maoDeObra === 0) {
        alert('Adicione pelo menos um item ou um valor de mão de obra ao orçamento.');
        return;
    }

    // Se é um orçamento novo, atribui um novo ID sequencial
    if (!orcamentos.find(o => o.id === currentOrcamento.id)) {
        currentOrcamento.id = proximoOrcamentoId++; // Usa o ID e incrementa para o próximo
        // Salva o novo proximoOrcamentoId no Firebase
        await salvarItemNoFirebase('metadata', 'ids', { proximoOrcamentoId: proximoOrcamentoId });
    }
    
    // Encontra e atualiza o orçamento na lista ou adiciona um novo
    const orcamentoIndex = orcamentos.findIndex(o => o.id === currentOrcamento.id);
    if (orcamentoIndex > -1) {
        orcamentos[orcamentoIndex] = { ...currentOrcamento }; // Cria uma cópia para evitar referência
    } else {
        orcamentos.push({ ...currentOrcamento });
    }
    
    // Salva o orçamento no Firebase
    await salvarItemNoFirebase('orcamentos', currentOrcamento.id.toString(), currentOrcamento); // IDs numéricos devem ser string no Firestore

    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados();
    carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
    carregarOrcamentosNoSelect('nfe-orcamento-vinculado');
    alert('Orçamento salvo com sucesso!');
    limparOrcamentoAtual(); // Inicia um novo orçamento
}


async function limparOrcamentoAtual() {
    currentOrcamento = {
        id: proximoOrcamentoId, // Usa o próximo ID disponível para um novo orçamento
        clienteId: null,
        itens: [],
        maoDeObra: 0,
        relatorio: "",
        formasPagamento: "",
        servicos: "",
        faturamentoData: null,
        nfeChaves: []
    };
    // Salva o orçamento limpo no Firebase para a sessão
    await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);

    document.getElementById('orcamento-id').value = currentOrcamento.id;
    document.getElementById('orcamento-cliente').value = '';
    document.getElementById('cliente-info').textContent = '';
    document.getElementById('orcamento-mao-de-obra').value = '0.00';
    document.getElementById('orcamento-relatorio').value = '';
    document.getElementById('orcamento-formas-pagamento').value = '';
    document.getElementById('orcamento-servicos').value = '';
    document.getElementById('total-orcamento').textContent = 'R$ 0,00';
    renderizarItensOrcamento();
    renderizarNFesAtuais(); // Limpa a tabela de NFes vinculadas ao orçamento atual
    alert('Novo orçamento iniciado.');
}

function carregarOrcamentoAtual() {
    document.getElementById('orcamento-id').value = currentOrcamento.id;
    document.getElementById('orcamento-cliente').value = currentOrcamento.clienteId || '';
    selecionarClienteOrcamento(); // Para preencher as info do cliente
    document.getElementById('orcamento-mao-de-obra').value = currentOrcamento.maoDeObra.toFixed(2);
    document.getElementById('orcamento-relatorio').value = currentOrcamento.relatorio;
    document.getElementById('orcamento-formas-pagamento').value = currentOrcamento.formasPagamento;
    document.getElementById('orcamento-servicos').value = currentOrcamento.servicos;
    renderizarItensOrcamento();
    atualizarTotalOrcamento();
    renderizarNFesAtuais(); // As NFes também devem ser carregadas com o orçamento atual
}

// ***** Funções de Gerenciamento de Orçamentos (Salvos) *****

function openOrcamentoSalvoModal() {
    const modal = document.getElementById('orcamentoSalvoModal');
    const lista = document.getElementById('lista-orcamentos-carregar');
    lista.innerHTML = '';
    
    // Filtra e ordena orçamentos para exibir no modal
    const orcamentosOrdenados = [...orcamentos].sort((a, b) => b.id - a.id); // Mais recente primeiro

    orcamentosOrdenados.forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome : 'Cliente Desconhecido';
        const li = document.createElement('li');
        li.innerHTML = `
            <span>ID: ${orc.id} | Cliente: ${clienteNome} | Data: ${orc.data || 'N/A'} | Total: R$ ${orc.valorTotal ? orc.valorTotal.toFixed(2).replace('.', ',') : '0,00'}</span>
            <button class="btn-primary" onclick="carregarOrcamento(${orc.id})"><i class="fas fa-folder-open"></i> Carregar</button>
            <button class="btn-danger" onclick="deletarOrcamento(${orc.id})"><i class="fas fa-trash-alt"></i> Deletar</button>
        `;
        lista.appendChild(li);
    });
    modal.classList.add('active');
}

function closeOrcamentoSalvoModal() {
    document.getElementById('orcamentoSalvoModal').classList.remove('active');
}

async function carregarOrcamento(id) {
    const orcamentoSelecionado = orcamentos.find(orc => orc.id === id);
    if (orcamentoSelecionado) {
        currentOrcamento = { ...orcamentoSelecionado }; // Carrega uma cópia
        // Garante que nfeChaves é um array e converte entradas antigas se necessário
        if (!Array.isArray(currentOrcamento.nfeChaves)) {
            currentOrcamento.nfeChaves = [];
        } else {
            currentOrcamento.nfeChaves = currentOrcamento.nfeChaves.map(entry => {
                if (typeof entry === 'string') {
                    return { chave: entry, fornecedor: '' };
                }
                return entry;
            }).filter(entry => entry !== null && entry !== undefined);
        }

        // Salva o orçamento carregado como o orçamento atual da sessão no Firebase
        await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);
        
        carregarOrcamentoAtual();
        closeOrcamentoSalvoModal();
        alert(`Orçamento ID ${id} carregado para edição.`);
    } else {
        alert('Orçamento não encontrado.');
    }
}

async function deletarOrcamento(id) {
    if (confirm(`Tem certeza que deseja deletar o orçamento ID ${id}?`)) {
        const orcamentoIndex = orcamentos.findIndex(o => o.id === id);
        if (orcamentoIndex > -1) {
            // Se o orçamento a ser deletado for o atual, limpa o atual também
            if (currentOrcamento.id === id) {
                await limparOrcamentoAtual();
            }
            
            orcamentos.splice(orcamentoIndex, 1);
            await deletarItemDoFirebase('orcamentos', id.toString()); // ID é numérico, Firestore espera string
            renderizarOrcamentosSalvos();
            renderizarFaturamentosGerados(); // Pode ter afetado um faturamento
            carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
            carregarOrcamentosNoSelect('nfe-orcamento-vinculado');
            alert('Orçamento deletado com sucesso.');
            closeOrcamentoSalvoModal(); // Fecha e reabre para atualizar a lista
            openOrcamentoSalvoModal();
        }
    }
}

function renderizarOrcamentosSalvos() {
    const tableBody = document.querySelector('#orcamentos-salvos-table tbody');
    tableBody.innerHTML = '';
    const searchTerm = document.getElementById('orcamento-salvos-search').value.toLowerCase();

    // Ordena os orçamentos do mais recente para o mais antigo
    const orcamentosExibicao = [...orcamentos].sort((a, b) => {
        const dateA = new Date(a.data);
        const dateB = new Date(b.data);
        return dateB - dateA;
    });

    orcamentosExibicao.filter(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome.toLowerCase() : '';
        return String(orc.id).includes(searchTerm) ||
               clienteNome.includes(searchTerm) ||
               (orc.data && orc.data.includes(searchTerm));
    }).forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome : 'Cliente Desconhecido';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${orc.id}</td>
            <td>${clienteNome}</td>
            <td>${orc.data || 'N/A'}</td>
            <td>R$ ${orc.valorTotal ? orc.valorTotal.toFixed(2).replace('.', ',') : '0,00'}</td>
            <td>
                <button class="btn-primary" onclick="carregarOrcamento(${orc.id})"><i class="fas fa-folder-open"></i> Carregar</button>
                <button class="btn-tertiary" onclick="gerarPdfOrcamento(${orc.id})"><i class="fas fa-file-pdf"></i> PDF</button>
                <button class="btn-delete" onclick="deletarOrcamento(${orc.id})"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
    });
}

function filterOrcamentosSalvos() {
    renderizarOrcamentosSalvos();
}

function filterOrcamentosParaCarregar() {
    const searchTerm = document.getElementById('orcamento-carregar-search').value.toLowerCase();
    const lista = document.getElementById('lista-orcamentos-carregar');
    lista.innerHTML = '';

    const orcamentosFiltrados = [...orcamentos].filter(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome.toLowerCase() : '';
        return String(orc.id).includes(searchTerm) ||
               clienteNome.includes(searchTerm) ||
               (orc.data && orc.data.includes(searchTerm));
    }).sort((a, b) => b.id - a.id); // Ordena do mais recente para o mais antigo

    orcamentosFiltrados.forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome : 'Cliente Desconhecido';
        const li = document.createElement('li');
        li.innerHTML = `
            <span>ID: ${orc.id} | Cliente: ${clienteNome} | Data: ${orc.data || 'N/A'} | Total: R$ ${orc.valorTotal ? orc.valorTotal.toFixed(2).replace('.', ',') : '0,00'}</span>
            <button class="btn-primary" onclick="carregarOrcamento(${orc.id})"><i class="fas fa-folder-open"></i> Carregar</button>
            <button class="btn-danger" onclick="deletarOrcamento(${orc.id})"><i class="fas fa-trash-alt"></i> Deletar</button>
        `;
        lista.appendChild(li);
    });
}


// ***** Funções de Faturamento *****

function carregarOrcamentosNoSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione um orçamento...</option>';
    // Exibe apenas orçamentos que ainda não têm data de faturamento (para não duplicar)
    // Ou exibe todos e deixa o usuário decidir
    const orcamentosDisponiveis = orcamentos.sort((a, b) => b.id - a.id); // Mais recente primeiro
    orcamentosDisponiveis.forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome : 'Desconhecido';
        select.innerHTML += `<option value="${orc.id}">ID: ${orc.id} - ${clienteNome} (R$ ${orc.valorTotal ? orc.valorTotal.toFixed(2).replace('.', ',') : '0,00'})</option>`;
    });
    // Se o currentOrcamento tiver um ID, pré-seleciona
    if (currentOrcamento.id && selectId === 'faturamento-orcamento-vinculado' || selectId === 'nfe-orcamento-vinculado') {
        select.value = currentOrcamento.id;
        if (selectId === 'faturamento-orcamento-vinculado') {
             vincularOrcamentoParaFaturamento();
        } else if (selectId === 'nfe-orcamento-vinculado') {
            vincularOrcamentoParaNfe();
        }
    }
}


function vincularOrcamentoParaFaturamento() {
    const orcamentoId = document.getElementById('faturamento-orcamento-vinculado').value;
    const clienteInfoInput = document.getElementById('faturamento-cliente-info');
    const valorTotalInput = document.getElementById('faturamento-valor-total');
    const dataFaturamentoInput = document.getElementById('faturamento-data');
    const observacoesInput = document.getElementById('faturamento-observacoes');

    if (orcamentoId) {
        const orc = orcamentos.find(o => o.id == orcamentoId);
        if (orc) {
            const cliente = clientes.find(c => c.id === orc.clienteId);
            clienteInfoInput.value = cliente ? `${cliente.nome} (${cliente.cnpjCpf || 'N/A'})` : 'Cliente Desconhecido';
            valorTotalInput.value = orc.valorTotal ? orc.valorTotal.toFixed(2) : '0.00';
            dataFaturamentoInput.value = orc.faturamentoData || new Date().toISOString().split('T')[0];
            observacoesInput.value = orc.faturamentoObservacoes || '';
        }
    } else {
        clienteInfoInput.value = '';
        valorTotalInput.value = '0.00';
        dataFaturamentoInput.value = new Date().toISOString().split('T')[0];
        observacoesInput.value = '';
    }
}

async function registrarFaturamento() {
    const orcamentoId = document.getElementById('faturamento-orcamento-vinculado').value;
    const dataFaturamento = document.getElementById('faturamento-data').value;
    const valorFaturado = parseFloat(document.getElementById('faturamento-valor-total').value);
    const observacoes = document.getElementById('faturamento-observacoes').value.trim();

    if (!orcamentoId || !dataFaturamento || isNaN(valorFaturado) || valorFaturado <= 0) {
        alert('Selecione um orçamento, preencha a data e o valor faturado corretamente.');
        return;
    }

    const orc = orcamentos.find(o => o.id == orcamentoId);
    if (orc) {
        orc.faturamentoData = dataFaturamento;
        orc.valorFaturado = valorFaturado; // Adiciona um campo específico para o valor faturado
        orc.faturamentoObservacoes = observacoes;

        // Atualiza o orçamento no Firebase com os dados de faturamento
        await salvarItemNoFirebase('orcamentos', orc.id.toString(), orc);

        renderizarFaturamentosGerados();
        carregarOrcamentosNoSelect('faturamento-orcamento-vinculado'); // Atualiza o select
        alert('Faturamento registrado com sucesso!');
        // Limpa o formulário de faturamento
        document.getElementById('faturamento-orcamento-vinculado').value = '';
        document.getElementById('faturamento-cliente-info').value = '';
        document.getElementById('faturamento-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('faturamento-valor-total').value = '0.00';
        document.getElementById('faturamento-observacoes').value = '';
    } else {
        alert('Orçamento não encontrado para registro de faturamento.');
    }
}

function renderizarFaturamentosGerados() {
    const tableBody = document.querySelector('#faturamento-table tbody');
    tableBody.innerHTML = '';
    const searchTerm = document.getElementById('faturamento-search').value.toLowerCase();

    const faturamentosFiltrados = orcamentos.filter(orc => orc.faturamentoData).filter(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome.toLowerCase() : '';
        return String(orc.id).includes(searchTerm) ||
               clienteNome.includes(searchTerm) ||
               (orc.faturamentoData && orc.faturamentoData.includes(searchTerm));
    }).sort((a, b) => new Date(b.faturamentoData) - new Date(a.faturamentoData)); // Mais recente primeiro

    faturamentosFiltrados.forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const clienteNome = cliente ? cliente.nome : 'Cliente Desconhecido';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${orc.id}</td>
            <td>${clienteNome}</td>
            <td>${orc.faturamentoData || 'N/A'}</td>
            <td>R$ ${orc.valorFaturado ? orc.valorFaturado.toFixed(2).replace('.', ',') : '0,00'}</td>
            <td>
                <button class="btn-tertiary" onclick="gerarPdfOrcamento(${orc.id})"><i class="fas fa-file-pdf"></i> PDF Original</button>
                <button class="btn-delete" onclick="desvincularFaturamento(${orc.id})"><i class="fas fa-undo"></i> Desvincular</button>
            </td>
        `;
    });
}

function filterFaturamentos() {
    renderizarFaturamentosGerados();
}

async function desvincularFaturamento(id) {
    if (confirm(`Tem certeza que deseja desvincular o faturamento do orçamento ID ${id}? Isso removerá a data e valor faturado.`)) {
        const orc = orcamentos.find(o => o.id === id);
        if (orc) {
            orc.faturamentoData = null;
            delete orc.valorFaturado; // Remove o campo de valor faturado
            delete orc.faturamentoObservacoes; // Remove observações de faturamento

            // Atualiza o orçamento no Firebase, removendo os campos de faturamento
            await salvarItemNoFirebase('orcamentos', orc.id.toString(), orc);

            renderizarFaturamentosGerados();
            carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
            alert('Faturamento desvinculado com sucesso.');
        } else {
            alert('Orçamento não encontrado.');
        }
    }
}


// ***** Funções de NFe *****

function vincularOrcamentoParaNfe() {
    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    const clienteInfoInput = document.getElementById('nfe-cliente-info');
    
    if (orcamentoId) {
        const orc = orcamentos.find(o => o.id == orcamentoId);
        if (orc) {
            const cliente = clientes.find(c => c.id === orc.clienteId);
            clienteInfoInput.value = cliente ? `${cliente.nome} (${cliente.cnpjCpf || 'N/A'})` : 'Cliente Desconhecido';
            currentOrcamento = { ...orc }; // Carrega o orçamento selecionado para manipulação de NFe
            // Garante que nfeChaves é um array e converte entradas antigas se necessário
            if (!Array.isArray(currentOrcamento.nfeChaves)) {
                currentOrcamento.nfeChaves = [];
            } else {
                currentOrcamento.nfeChaves = currentOrcamento.nfeChaves.map(entry => {
                    if (typeof entry === 'string') {
                        return { chave: entry, fornecedor: '' };
                    }
                    return entry;
                }).filter(entry => entry !== null && entry !== undefined);
            }
            renderizarNFesAtuais();
        }
    } else {
        clienteInfoInput.value = '';
        currentOrcamento = { // Reseta o currentOrcamento se nada for selecionado
            id: generateSequentialId(true),
            clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: []
        };
        renderizarNFesAtuais(); // Limpa a tabela
    }
    // Salva o currentOrcamento (vazio ou carregado) no Firebase
    if (currentUser) {
        salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);
    }
}

async function adicionarNfeAoOrcamento() {
    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    const nfeChave = document.getElementById('nfe-chave').value.trim();
    const nfeFornecedor = document.getElementById('nfe-fornecedor').value.trim();

    if (!orcamentoId) {
        alert('Selecione um orçamento para vincular a NFe.');
        return;
    }
    if (!nfeChave) {
        alert('A chave da NFe é obrigatória.');
        return;
    }

    const orc = orcamentos.find(o => o.id == orcamentoId);
    if (orc) {
        if (!Array.isArray(orc.nfeChaves)) {
            orc.nfeChaves = []; // Garante que é um array
        }
        // Verifica se a chave já existe para evitar duplicatas
        if (orc.nfeChaves.some(n => n.chave === nfeChave)) {
            alert('Esta chave de NFe já está vinculada a este orçamento.');
            return;
        }

        orc.nfeChaves.push({ chave: nfeChave, fornecedor: nfeFornecedor });

        // Atualiza o orçamento no Firebase com a nova NFe
        await salvarItemNoFirebase('orcamentos', orc.id.toString(), orc);
        
        // Atualiza o currentOrcamento se for o que está sendo editado
        if (currentOrcamento.id == orcamentoId) {
            currentOrcamento.nfeChaves = orc.nfeChaves;
            // Salva o currentOrcamento atualizado na sessão Firebase
            await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);
            renderizarNFesAtuais();
        }
        renderizarTodasNFes(); // Atualiza a tabela geral de NFes
        alert('NFe adicionada ao orçamento com sucesso!');
        document.getElementById('nfe-chave').value = '';
        document.getElementById('nfe-fornecedor').value = '';
    } else {
        alert('Orçamento não encontrado para vincular NFe.');
    }
}

async function removerNfeDoOrcamento(orcamentoId, nfeChave) {
    if (confirm(`Tem certeza que deseja remover a NFe ${nfeChave} do orçamento ID ${orcamentoId}?`)) {
        const orc = orcamentos.find(o => o.id == orcamentoId);
        if (orc) {
            orc.nfeChaves = orc.nfeChaves.filter(n => n.chave !== nfeChave);

            // Atualiza o orçamento no Firebase
            await salvarItemNoFirebase('orcamentos', orc.id.toString(), orc);
            
            // Atualiza o currentOrcamento se for o que está sendo editado
            if (currentOrcamento.id == orcamentoId) {
                currentOrcamento.nfeChaves = orc.nfeChaves;
                // Salva o currentOrcamento atualizado na sessão Firebase
                await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);
                renderizarNFesAtuais();
            }
            renderizarTodasNFes();
            alert('NFe removida com sucesso.');
        } else {
            alert('Orçamento não encontrado.');
        }
    }
}

function renderizarNFesAtuais() {
    const tableBody = document.querySelector('#nfe-current-table tbody');
    tableBody.innerHTML = '';

    if (currentOrcamento && currentOrcamento.nfeChaves && currentOrcamento.nfeChaves.length > 0) {
        currentOrcamento.nfeChaves.forEach(nfe => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${nfe.chave}</td>
                <td>${nfe.fornecedor || 'N/A'}</td>
                <td>
                    <button class="btn-delete" onclick="removerNfeDoOrcamento(${currentOrcamento.id}, '${nfe.chave}')"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
    } else {
        const row = tableBody.insertRow();
        row.innerHTML = `<td colspan="3" style="text-align: center;">Nenhuma NFe vinculada a este orçamento.</td>`;
    }
}

function renderizarTodasNFes() {
    const tableBody = document.querySelector('#nfe-table tbody');
    tableBody.innerHTML = '';
    const searchTerm = document.getElementById('nfe-search').value.toLowerCase();

    // Cria uma lista plana de todas as NFes de todos os orçamentos
    let todasNFes = [];
    orcamentos.forEach(orc => {
        if (orc.nfeChaves && Array.isArray(orc.nfeChaves)) {
            orc.nfeChaves.forEach(nfe => {
                const cliente = clientes.find(c => c.id === orc.clienteId);
                todasNFes.push({
                    orcamentoId: orc.id,
                    clienteNome: cliente ? cliente.nome : 'Cliente Desconhecido',
                    chave: nfe.chave,
                    fornecedor: nfe.fornecedor || 'N/A'
                });
            });
        }
    });

    todasNFes.filter(nfe => 
        String(nfe.orcamentoId).includes(searchTerm) ||
        nfe.clienteNome.toLowerCase().includes(searchTerm) ||
        nfe.chave.toLowerCase().includes(searchTerm) ||
        nfe.fornecedor.toLowerCase().includes(searchTerm)
    ).forEach(nfe => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${nfe.orcamentoId}</td>
            <td>${nfe.clienteNome}</td>
            <td>${nfe.chave}</td>
            <td>${nfe.fornecedor}</td>
            <td>
                <button class="btn-delete" onclick="removerNfeDoOrcamento(${nfe.orcamentoId}, '${nfe.chave}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
    });
}

function filterNfes() {
    renderizarTodasNFes();
}


// ***** Funções de Configurações *****

async function salvarConfiguracoesEmpresa() {
    if (!currentUser) {
        alert("Você precisa estar logado para salvar configurações.");
        return;
    }

    const empresaConfig = {
        nome: document.getElementById('empresa-nome').value.trim(),
        cnpj: document.getElementById('empresa-cnpj').value.trim(),
        contato1: document.getElementById('empresa-contato1').value.trim(),
        contato2: document.getElementById('empresa-contato2').value.trim(),
        endereco: document.getElementById('empresa-endereco').value.trim(),
    };

    await salvarItemNoFirebase('settings', 'empresaConfig', empresaConfig);
    alert('Configurações da empresa salvas com sucesso!');
}

// ***** Funções de Backup/Restore (Agora mais complexas com Firebase) *****
// Estas funções ainda precisariam de mais lógica se você quiser exportar/importar
// todo o banco de dados do usuário do Firebase para um JSON local.
// Para exportar, você teria que ler todas as coleções (clientes, produtos, orcamentos, metadata, sessionData, settings)
// e agrupar em um único objeto JSON. Para importar, você teria que iterar sobre esse JSON e enviar cada item para a coleção correta no Firebase.
// A lógica atual de backup/restore será adaptada para exportar os dados ATUAIS do aplicativo (que já deveriam estar sincronizados com o Firebase se o usuário estiver logado)
// e para importar dados PARA o Firebase (sobrescrevendo o que está lá).

async function exportarDadosBackup() {
    if (!currentUser) {
        alert("Você precisa estar logado para exportar um backup completo do Firebase.");
        return;
    }

    updateConnectionStatus("Preparando backup...", "blue");

    try {
        const backupData = {
            clientes: clientes,
            produtos: produtos,
            orcamentos: orcamentos,
            proximoOrcamentoId: proximoOrcamentoId,
            currentOrcamento: currentOrcamento,
            empresaConfig: {
                nome: document.getElementById('empresa-nome').value.trim(),
                cnpj: document.getElementById('empresa-cnpj').value.trim(),
                contato1: document.getElementById('empresa-contato1').value.trim(),
                contato2: document.getElementById('empresa-contato2').value.trim(),
                endereco: document.getElementById('empresa-endereco').value.trim(),
            }
        };

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_app_henriques_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        updateConnectionStatus("Backup salvo com sucesso!", "green");
        alert('Backup completo exportado com sucesso!');
    } catch (error) {
        console.error("Erro ao exportar dados:", error);
        updateConnectionStatus("Erro ao exportar backup", "red");
        alert('Erro ao exportar dados de backup: ' + error.message);
    }
}

async function importarDadosBackup(event) {
    if (!currentUser) {
        alert("Você precisa estar logado para importar um backup para o Firebase.");
        return;
    }

    if (!confirm('ATENÇÃO: Importar um backup irá SOBRESCREVER todos os seus dados atuais no Firebase para este usuário. Tem certeza que deseja continuar?')) {
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return;
    }

    updateConnectionStatus("Importando backup...", "orange");

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // Limpar dados existentes do usuário no Firebase antes de importar
            await deletarTodaColecao('clientes');
            await deletarTodaColecao('produtos');
            await deletarTodaColecao('orcamentos');
            await deletarTodaColecao('metadata');
            await deletarTodaColecao('sessionData');
            await deletarTodaColecao('settings');

            // Importar clientes
            if (importedData.clientes && Array.isArray(importedData.clientes)) {
                for (const cliente of importedData.clientes) {
                    await salvarItemNoFirebase('clientes', cliente.id, cliente);
                }
            }

            // Importar produtos
            if (importedData.produtos && Array.isArray(importedData.produtos)) {
                for (const produto of importedData.produtos) {
                    await salvarItemNoFirebase('produtos', produto.id, produto);
                }
            }

            // Importar orçamentos
            if (importedData.orcamentos && Array.isArray(importedData.orcamentos)) {
                for (const orcamento of importedData.orcamentos) {
                    await salvarItemNoFirebase('orcamentos', orcamento.id.toString(), orcamento);
                }
            }

            // Importar proximoOrcamentoId
            if (importedData.proximoOrcamentoId) {
                await salvarItemNoFirebase('metadata', 'ids', { proximoOrcamentoId: importedData.proximoOrcamentoId });
            }

            // Importar currentOrcamento
            if (importedData.currentOrcamento) {
                await salvarItemNoFirebase('sessionData', 'currentOrcamento', importedData.currentOrcamento);
            }

            // Importar configurações da empresa
            if (importedData.empresaConfig) {
                await salvarItemNoFirebase('settings', 'empresaConfig', importedData.empresaConfig);
            }

            updateConnectionStatus("Backup importado e salvo com sucesso!", "green");
            alert('Dados restaurados com sucesso! O aplicativo será recarregado.');
            location.reload(); // Recarrega a página para garantir que todos os dados sejam atualizados
        } catch (error) {
            console.error("Erro ao importar dados:", error);
            updateConnectionStatus("Erro ao importar backup", "red");
            alert('Erro ao importar dados de backup. Verifique o formato do arquivo: ' + error.message);
        } finally {
            event.target.value = ''; // Limpa o input file
        }
    };
    reader.readAsText(file);
}

// Função auxiliar para deletar toda uma coleção de um usuário (usado no restore)
async function deletarTodaColecao(collectionName) {
    if (!currentUser) return;
    const collectionRef = db.collection('users').doc(currentUser.uid).collection(collectionName);
    const snapshot = await collectionRef.get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Coleção '${collectionName}' limpa para o usuário ${currentUser.uid}.`);
}


// ***** Funções Auxiliares de Navegação e Carregamento Inicial *****

function showSection(sectionId) {
    document.querySelectorAll('main section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    document.querySelectorAll('nav a').forEach(navItem => {
        navItem.classList.remove('active');
    });
    document.getElementById(`nav-${sectionId}`).classList.add('active');
}

function carregarDadosIniciais() {
    // Esta função agora é mais um "ponto de partida" para renderizar a UI
    // Os dados principais são carregados via `carregarDadosDoFirebase()` após o login.
    carregarClientesNoSelect('orcamento-cliente');
    carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
    carregarOrcamentosNoSelect('nfe-orcamento-vinculado');
    carregarCategoriasNoFiltroProduto();
    renderizarClientes();
    renderizarProdutos();
    renderizarItensOrcamento();
    atualizarTotalOrcamento();
    carregarOrcamentoAtual(); // Tenta carregar o orçamento atual da sessão
    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados();
    renderizarNFesAtuais();
    renderizarTodasNFes();
}


// ***** Funções de Importação de Itens para Orçamento (TXT) *****

function openImportarItensModal() {
    document.getElementById('importarItensModal').classList.add('active');
    document.getElementById('import-itens-file').value = ''; // Limpa o input file
    document.getElementById('import-itens-conteudo').value = ''; // Limpa o textarea
}

function closeImportarItensModal() {
    document.getElementById('importarItensModal').classList.remove('active');
}

function visualizarConteudoArquivo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('import-itens-conteudo').value = e.target.result;
        };
        reader.readAsText(file);
    }
}

async function processarImportacaoItens() {
    const conteudo = document.getElementById('import-itens-conteudo').value.trim();
    if (!conteudo) {
        alert('Nenhum conteúdo para importar. Cole os itens ou selecione um arquivo.');
        return;
    }

    const linhas = conteudo.split('\n').filter(line => line.trim() !== '');
    const itensImportados = [];
    let erros = [];

    linhas.forEach((linha, index) => {
        const partes = linha.split(',');
        if (partes.length >= 3) {
            const nome = partes[0].trim();
            const quantidade = parseInt(partes[1].trim());
            const valorUnitario = parseFloat(partes[2].trim());

            if (nome && !isNaN(quantidade) && quantidade > 0 && !isNaN(valorUnitario) && valorUnitario >= 0) {
                itensImportados.push({
                    id: generateAlphanumericUniqueId(),
                    nome,
                    quantidade,
                    valorUnitario
                });
            } else {
                erros.push(`Linha ${index + 1}: Formato inválido ou valores numéricos incorretos - "${linha}"`);
            }
        } else {
            erros.push(`Linha ${index + 1}: Formato incorreto (esperado "Nome,Quantidade,ValorUnitario") - "${linha}"`);
        }
    });

    if (erros.length > 0) {
        alert('Erros encontrados durante a importação:\n' + erros.join('\n') + '\nNenhum item foi importado devido aos erros.');
        return;
    }

    if (itensImportados.length > 0) {
        currentOrcamento.itens = currentOrcamento.itens.concat(itensImportados);
        // Salva o currentOrcamento no Firebase após importar itens
        await salvarItemNoFirebase('sessionData', 'currentOrcamento', currentOrcamento);

        renderizarItensOrcamento();
        atualizarTotalOrcamento();
        closeImportarItensModal();
        alert(`${itensImportados.length} itens importados com sucesso para o orçamento atual!`);
    } else {
        alert('Nenhum item válido encontrado para importação.');
    }
}


// ***** Funções de Exportação de Produtos para Excel *****
function exportarProdutosExcel() {
    // Cria uma cópia dos produtos para não alterar o array original
    const produtosParaExportar = produtos.map(p => ({
        ID: p.id,
        'Nome para Proposta': p.nomeProposta,
        'Nome Completo': p.nomeCompleto,
        'Valor (R$)': p.valor,
        Categoria: p.categoria
    }));

    if (produtosParaExportar.length === 0) {
        alert('Não há produtos para exportar.');
        return;
    }

    // Cria uma planilha de trabalho (workbook)
    const ws = XLSX.utils.json_to_sheet(produtosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");

    // Gera o arquivo Excel e faz o download
    XLSX.writeFile(wb, "produtos_grupo_henriques.xlsx");
    alert('Produtos exportados para Excel com sucesso!');
}


// ***** Funções de Importação de Produtos do Excel *****
// Esta função precisa da biblioteca SheetJS (js-xlsx)
// Adicione `<script src="https://unpkg.com/xlsx/dist/xlsx.full.min.js"></script>`
// no seu index.html ANTES do script.js
async function importarProdutosExcel(event) {
    if (!currentUser) {
        alert("Você precisa estar logado para importar produtos.");
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (!confirm('ATENÇÃO: A importação de produtos irá ADICIONAR novos produtos e ATUALIZAR produtos existentes com base nos IDs. Tem certeza que deseja continuar?')) {
        return;
    }

    updateConnectionStatus("Importando produtos...", "orange");

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length < 2) {
                alert('O arquivo Excel parece estar vazio ou sem cabeçalhos.');
                return;
            }

            const headers = json[0].map(h => h.trim()); // Assume a primeira linha como cabeçalho
            const expectedHeaders = ['ID', 'Nome para Proposta', 'Nome Completo', 'Valor (R$)', 'Categoria'];

            // Verifica se os cabeçalhos esperados estão presentes
            const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
            if (missingHeaders.length > 0) {
                alert(`Cabeçalhos ausentes no arquivo Excel: ${missingHeaders.join(', ')}. Certifique-se de que o arquivo está no formato correto.`);
                return;
            }

            const produtosImportados = [];
            for (let i = 1; i < json.length; i++) {
                const row = json[i];
                const newProduct = {};
                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j];
                    const value = row[j];

                    switch (header) {
                        case 'ID':
                            newProduct.id = String(value || generateAlphanumericUniqueId());
                            break;
                        case 'Nome para Proposta':
                            newProduct.nomeProposta = String(value || '').trim();
                            break;
                        case 'Nome Completo':
                            newProduct.nomeCompleto = String(value || '').trim();
                            break;
                        case 'Valor (R$)':
                            newProduct.valor = parseFloat(String(value).replace(',', '.')) || 0;
                            break;
                        case 'Categoria':
                            newProduct.categoria = String(value || 'Geral').trim();
                            break;
                        default:
                            break;
                    }
                }

                if (newProduct.nomeProposta && newProduct.valor > 0) {
                    produtosImportados.push(newProduct);
                } else {
                    console.warn(`Linha ${i + 1} ignorada devido a dados inválidos: `, row);
                }
            }

            let produtosAdicionados = 0;
            let produtosAtualizados = 0;

            for (const importedProd of produtosImportados) {
                const existingIndex = produtos.findIndex(p => p.id === importedProd.id);
                if (existingIndex > -1) {
                    // Atualiza produto existente
                    produtos[existingIndex] = importedProd;
                    produtosAtualizados++;
                } else {
                    // Adiciona novo produto
                    produtos.push(importedProd);
                    produtosAdicionados++;
                }
                await salvarItemNoFirebase('produtos', importedProd.id, importedProd);
            }

            renderizarProdutos();
            carregarCategoriasNoFiltroProduto();
            updateConnectionStatus("Produtos importados com sucesso!", "green");
            alert(`Importação de produtos concluída: ${produtosAdicionados} adicionados, ${produtosAtualizados} atualizados.`);
        } catch (error) {
            console.error("Erro ao importar produtos do Excel:", error);
            updateConnectionStatus("Erro ao importar produtos", "red");
            alert('Erro ao importar produtos do Excel. Verifique o formato do arquivo e se a biblioteca SheetJS está incluída. Erro: ' + error.message);
        } finally {
            event.target.value = ''; // Limpa o input file
        }
    };
    reader.readAsArrayBuffer(file);
}


// No final do seu script.js, chamar a função de carregamento inicial
// `carregarDadosIniciais()` é chamada em `DOMContentLoaded` e agora dependerá do `onAuthStateChanged` para carregar dados do Firebase.

// Adicione esta linha no final do seu script.js para que as funções PDF e Backup sejam carregadas após todo o resto
// O original já faz isso com <script src="pdf-generator.js"></script> e <script src="backup.js"></script>
// Não remova as tags script no index.html.
