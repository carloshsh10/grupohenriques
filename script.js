// Variáveis globais
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
    servicos: "",
    faturamentoData: null,
    nfeChaves: []
};
let isEditingItem = false;
let editingItemIndex = -1;

// Firebase variables
let firebaseUser = null;
const firebaseStatusElement = document.getElementById('firebase-status');
const firebaseCloudStatusElement = document.getElementById('firebase-cloud-status');


// Inicialização do aplicativo
document.addEventListener('DOMContentLoaded', function() {
    configurarEventListeners();
    setupFirebaseAuthStateListener();
    showSection('clientes');
    
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
            document.querySelectorAll('nav a').forEach(item => item.classList.remove('active'));
            this.classList.add('active');
        });
    });

    document.getElementById('nav-clientes').classList.add('active');

    // Formulários com Salvamento e Limpeza
    document.getElementById('cliente-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarE䡊ovoCliente();
    });
    document.getElementById('produto-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarE䡊ovoProduto();
    });
    
    // Orçamento
    document.getElementById('orcamento-form').addEventListener('input', salvarDadosOrcamento);
    document.getElementById('adicionar-item-btn').addEventListener('click', () => openItemModal(-1, 'current'));
    document.getElementById('gerar-pdf-btn').addEventListener('click', () => gerarPDF(false));
    document.getElementById('salvar-novo-orcamento-btn').addEventListener('click', salvarE䡊ovoOrcamento);
    
    // Modal de Item do Orçamento
    document.getElementById('item-form').addEventListener('submit', adicionarOuEditarItemOrcamento);
    document.querySelector('#itemModal .close-modal').addEventListener('click', () => closeModal('itemModal'));
    document.getElementById('modal-item-categoria').addEventListener('change', carregarProdutosNoModalPorCategoria);
    
    // CORREÇÃO 1: Adicionar event listener para o novo botão de excluir no modal de item
    document.getElementById('delete-item-btn').addEventListener('click', excluirItemPeloModal);


    const selectModalProduto = document.getElementById('modal-produto');
    selectModalProduto.addEventListener('change', function() {
        const selectedOption = selectModalProduto.options[selectModalProduto.selectedIndex];
        const valorInput = document.getElementById('modal-valor');
        if (selectedOption && selectedOption.dataset.valor) {
            valorInput.value = parseFloat(selectedOption.dataset.valor).toFixed(2);
        } else if (!isEditingItem || (isEditingItem && !modalProdutoSelect.value)) {
            valorInput.value = '';
        }
    });

    // Modal de Produtos por Categoria
    document.getElementById('close-produtos-categoria-modal').addEventListener('click', closeProdutosCategoriaModal);
    
    // Faturamento
    document.getElementById('add-parcela-btn').addEventListener('click', adicionarParcela);
    document.getElementById('salvar-novo-faturamento-btn').addEventListener('click', salvarE䡊ovoFaturamento);
    document.getElementById('faturamento-orcamento-vinculado').addEventListener('change', preencherClienteFaturamento);

    // Nota Fornecedor - Event Listeners atualizados
    document.getElementById('nfe-orcamento-vinculado').addEventListener('change', carregarChavesNFEParaOrcamentoSelecionado);

    document.getElementById('nfe-management-panel').addEventListener('click', (event) => {
        const targetButton = event.target.closest('button');
        if (!targetButton) return;

        if (targetButton.classList.contains('btn-salvar-nfe')) {
            const index = targetButton.dataset.index;
            salvarChaveNFE(index);
        } else if (targetButton.classList.contains('btn-editar-nfe')) {
            const index = targetButton.dataset.index;
            editarChaveNFE(index);
        } else if (targetButton.classList.contains('btn-gerar-nfe')) {
            const index = targetButton.dataset.index;
            gerarNFEFromChave(index);
        } else if (targetButton.classList.contains('btn-excluir-nfe')) {
            const index = targetButton.dataset.index;
            excluirChaveNFE(index);
        }
    });

    // Firebase Login/Logout
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('google-logout-btn').addEventListener('click', signOutGoogle);

    // CORREÇÃO 2: Event Listeners para o novo modal de edição de orçamento
    document.getElementById('close-edit-orcamento-modal').addEventListener('click', () => closeModal('editOrcamentoModal'));
    document.getElementById('save-orcamento-changes-btn').addEventListener('click', salvarAlteracoesOrcamentoPeloModal);
    
    // CORREÇÃO 3: Event Listeners para o modal de confirmação de exclusão (swipe)
    configurarSwipeParaExcluir();
}


// Funções Firebase (sem alterações)
async function signInWithGoogle() {
    try {
        const provider = new window.GoogleAuthProvider();
        await window.signInWithPopup(window.firebaseAuth, provider);
    } catch (error) {
        console.error("Erro no login com Google: ", error);
        updateFirebaseStatus('Erro de Conexão', 'red');
        alert("Erro ao fazer login com Google: " + error.message);
    }
}

async function signOutGoogle() {
    try {
        await window.signOut(window.firebaseAuth);
    } catch (error) {
        console.error("Erro no logout: ", error);
        updateFirebaseStatus('Erro ao Desconectar', 'red');
        alert("Erro ao fazer logout: " + error.message);
    }
}

function setupFirebaseAuthStateListener() {
    window.onAuthStateChanged(window.firebaseAuth, async (user) => {
        const loginBtn = document.getElementById('google-login-btn');
        const logoutBtn = document.getElementById('google-logout-btn');

        if (user) {
            firebaseUser = user;
            updateFirebaseStatus('Conectado', 'green');
            
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            logoutBtn.style.backgroundColor = 'green';
            logoutBtn.style.borderColor = 'darkgreen';
            logoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> LOGADO COM FIREBASE CLOUD';

            await loadDataFromFirestore();
        } else {
            firebaseUser = null;
            updateFirebaseStatus('Desconectado', 'red');

            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
            loginBtn.style.backgroundColor = 'red';
            loginBtn.style.borderColor = 'darkred';
            loginBtn.innerHTML = '<i class="fab fa-google"></i> LOGIN GOOGLE NECESSÁRIO';
            
            loadDataFromLocalStorage();
        }
    });
}

async function saveDataToFirestore() {
    if (!firebaseUser) {
        console.warn("Usuário não autenticado. Salvando apenas no Local Storage.");
        salvarNoLocalStorage('clientes', clientes);
        salvarNoLocalStorage('produtos', produtos);
        salvarNoLocalStorage('orcamentos', orcamentos);
        salvarNoLocalStorage('proximoOrcamentoId', proximoOrcamentoId);
        salvarNoLocalStorage('currentOrcamento', currentOrcamento);
        return;
    }

    updateFirebaseStatus('Sincronizando...', 'orange');
    try {
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', firebaseUser.uid);
        await window.firebaseSetDoc(userDocRef, {
            clientes: clientes,
            produtos: produtos,
            orcamentos: orcamentos,
            proximoOrcamentoId: proximoOrcamentoId,
            currentOrcamento: currentOrcamento
        });
        updateFirebaseStatus('Conectado', 'green');
    } catch (error) {
        console.error("Erro ao salvar dados no Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão', 'red');
        alert("Erro ao salvar dados no Firebase. Verifique sua conexão ou tente novamente.");
    }
}

async function loadDataFromFirestore() {
    if (!firebaseUser) {
        console.warn("Usuário não autenticado. Carregando dados do Local Storage.");
        loadDataFromLocalStorage();
        return;
    }

    updateFirebaseStatus('Conectando...', 'orange');
    try {
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', firebaseUser.uid);
        const docSnap = await window.firebaseGetDoc(userDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            clientes = data.clientes || [];
            produtos = data.produtos || [];
            orcamentos = data.orcamentos || [];
            proximoOrcamentoId = data.proximoOrcamentoId || 1;
            currentOrcamento = data.currentOrcamento || {
                id: generateSequentialId(true),
                clienteId: null,
                itens: [],
                maoDeObra: 0,
                relatorio: "",
                formasPagamento: "",
                servicos: "",
                faturamentoData: null,
                nfeChaves: []
            };

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

            orcamentos = orcamentos.map(orc => {
                if (!Array.isArray(orc.nfeChaves)) {
                    orc.nfeChaves = [];
                } else {
                    orc.nfeChaves = orc.nfeChaves.map(entry => {
                        if (typeof entry === 'string') {
                            return { chave: entry, fornecedor: '' };
                        }
                        return entry;
                    }).filter(entry => entry !== null && entry !== undefined);
                }
                return orc;
            });

            updateFirebaseStatus('Conectado', 'green');
        } else {
            updateFirebaseStatus('Nenhum dado na nuvem', 'blue');
            clientes = [];
            produtos = [];
            orcamentos = [];
            proximoOrcamentoId = 1;
            currentOrcamento = {
                id: generateSequentialId(true),
                clienteId: null,
                itens: [],
                maoDeObra: 0,
                relatorio: "",
                formasPagamento: "",
                servicos: "",
                nfeChaves: []
            };
        }
        carregarDadosIniciais(); 
    } catch (error) {
        console.error("Erro ao carregar dados do Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão', 'red');
        alert("Erro ao carregar dados do Firebase. Carregando dados locais. " + error.message);
        loadDataFromLocalStorage(); // Fallback
    }
}

function updateFirebaseStatus(message, color) {
    if(firebaseStatusElement) {
        firebaseStatusElement.textContent = message;
        firebaseStatusElement.style.color = color;
    }
    if(firebaseCloudStatusElement) {
        firebaseCloudStatusElement.textContent = message;
        firebaseCloudStatusElement.style.color = color;
    }
}

function salvarNoLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadDataFromLocalStorage() {
    clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    produtos = JSON.parse(localStorage.getItem('produtos')) || [];
    orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || [];
    proximoOrcamentoId = parseInt(localStorage.getItem('proximoOrcamentoId')) || 1;
    currentOrcamento = JSON.parse(localStorage.getItem('currentOrcamento')) || {
        id: generateSequentialId(true),
        clienteId: null,
        itens: [],
        maoDeObra: 0,
        relatorio: "",
        formasPagamento: "",
        servicos: "",
        faturamentoData: null,
        nfeChaves: []
    };

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

    orcamentos = orcamentos.map(orc => {
        if (!Array.isArray(orc.nfeChaves)) {
            orc.nfeChaves = [];
        } else {
            orc.nfeChaves = orc.nfeChaves.map(entry => {
                if (typeof entry === 'string') {
                    return { chave: entry, fornecedor: '' };
                }
                return entry;
            }).filter(entry => entry !== null && entry !== undefined);
        }
        return orc;
    });

    carregarDadosIniciais();
}

function saveData() {
    if (firebaseUser) {
        saveDataToFirestore();
    } else {
        salvarNoLocalStorage('clientes', clientes);
        salvarNoLocalStorage('produtos', produtos);
        salvarNoLocalStorage('orcamentos', orcamentos);
        salvarNoLocalStorage('proximoOrcamentoId', proximoOrcamentoId);
        salvarNoLocalStorage('currentOrcamento', currentOrcamento);
        updateFirebaseStatus('Salvo Localmente. Conecte-se para salvar na nuvem.', 'blue');
    }
}

function carregarDadosIniciais() {
    renderizarClientes();
    renderizarProdutosPorCategoria();
    carregarOrcamentoAtual();
    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados();
}

function showSection(sectionId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId + '-section').classList.add('active');

    if (sectionId === 'orcamentos') carregarClientesNoSelect('orcamento-cliente');
    if (sectionId === 'faturamento') carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
    if (sectionId === 'nota-fornecedor') {
        carregarOrcamentosNoSelect('nfe-orcamento-vinculado');
        carregarChavesNFEParaOrcamentoSelecionado(); 
    }
    if (sectionId === 'produtos') renderizarProdutosPorCategoria();
}

// Funções Auxiliares
function generateAlphanumericUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateSequentialId(isInitialLoad = false) {
    let id = proximoOrcamentoId;
    if (!isInitialLoad) {
        proximoOrcamentoId++;
        saveData(); 
    }
    return id.toString().padStart(4, '0');
}

function formatarMoeda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return 'R$ 0,00';
    return 'R$ ' + parseFloat(valor).toFixed(2).replace('.', ',');
}

// Clientes (sem alterações)
function salvarCliente() {
    const id = document.getElementById('cliente-id').value;
    const nome = document.getElementById('cliente-nome').value.trim();
    const cpfCnpj = document.getElementById('cliente-cpf-cnpj').value.trim();
    const telefone = document.getElementById('cliente-telefone').value.trim();
    const endereco = document.getElementById('cliente-endereco').value.trim();

    if (!nome) {
        alert('O nome do cliente é obrigatório.');
        return false;
    }

    if (id) {
        const index = clientes.findIndex(c => c.id === id);
        if (index !== -1) {
            clientes[index] = { id, nome, cpfCnpj, telefone, endereco };
            alert('Cliente atualizado com sucesso!');
        }
    } else {
        const novoCliente = { id: generateAlphanumericUniqueId(), nome, cpfCnpj, telefone, endereco };
        clientes.push(novoCliente);
        document.getElementById('cliente-id').value = novoCliente.id;
        alert('Cliente adicionado com sucesso!');
    }
    saveData();
    renderizarClientes();
    return true;
}

function novoCliente() {
    document.getElementById('cliente-form').reset();
    document.getElementById('cliente-id').value = '';
}

function salvarE䡊ovoCliente() {
    if (salvarCliente()) {
        novoCliente();
    }
}

function renderizarClientes() {
    const tbody = document.querySelector('#clientes-tabela tbody');
    tbody.innerHTML = '';
    clientes.forEach(cliente => {
        const row = tbody.insertRow();
        row.insertCell().textContent = cliente.nome;
        row.insertCell().textContent = cliente.cpfCnpj || 'N/A';
        row.insertCell().textContent = cliente.telefone || 'N/A';
        row.insertCell().textContent = cliente.endereco || 'N/A';
        const acoesCell = row.insertCell();
        acoesCell.innerHTML = `
            <button class="btn-editar" onclick="editarCliente('${cliente.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-excluir" onclick="excluirCliente('${cliente.id}')"><i class="fas fa-trash-alt"></i></button>
        `;
    });
    carregarClientesNoSelect('orcamento-cliente');
}

function editarCliente(id) {
    const cliente = clientes.find(c => c.id === id);
    if (cliente) {
        document.getElementById('cliente-id').value = cliente.id;
        document.getElementById('cliente-nome').value = cliente.nome;
        document.getElementById('cliente-cpf-cnpj').value = cliente.cpfCnpj;
        document.getElementById('cliente-telefone').value = cliente.telefone;
        document.getElementById('cliente-endereco').value = cliente.endereco;
        showSection('clientes');
        document.querySelector('#nav-clientes').click();
        document.getElementById('cliente-nome').focus();
    }
}

function excluirCliente(id) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        clientes = clientes.filter(c => c.id !== id);
        saveData(); 
        renderizarClientes();
        alert('Cliente excluído com sucesso!');
    }
}

// Produtos (sem alterações)
function salvarProduto() {
    const id = document.getElementById('produto-id').value;
    const nomeProposta = document.getElementById('produto-nome-proposta').value.trim();
    const nomeReal = document.getElementById('produto-nome-real').value.trim();
    const categoriaInput = document.getElementById('produto-categoria').value.trim();
    const valorInput = document.getElementById('produto-valor').value;

    if (!nomeProposta) {
        alert('O "Nome para Proposta" é obrigatório.');
        return false;
    }
    const valor = parseFloat(valorInput);
    if (isNaN(valor) || valor < 0) {
        alert('O valor do produto deve ser um número válido.');
        return false;
    }

    const categoria = categoriaInput || 'Geral';
    const produtoData = {
        id: id || generateAlphanumericUniqueId(),
        nomeProposta,
        nomeReal: nomeReal || nomeProposta,
        categoria: categoria,
        valor
    };

    if (id) {
        const index = produtos.findIndex(p => p.id === id);
        if (index !== -1) {
            produtos[index] = produtoData;
            alert('Produto atualizado!');
        }
    } else {
        produtos.push(produtoData);
        document.getElementById('produto-id').value = produtoData.id;
        alert('Produto adicionado!');
    }
    
    saveData(); 
    renderizarProdutosPorCategoria();
    return true;
}

function novoProduto() {
    document.getElementById('produto-form').reset();
    document.getElementById('produto-id').value = '';
}

function salvarE䡊ovoProduto() {
    if (salvarProduto()) {
        novoProduto();
    }
}

function renderizarProdutosPorCategoria() {
    const container = document.getElementById('categorias-container');
    container.innerHTML = '';
    const produtosAgrupados = produtos.reduce((acc, produto) => {
        const categoria = produto.categoria || 'Geral';
        if (!acc[categoria]) acc[categoria] = [];
        acc[categoria].push(produto);
        return acc;
    }, {});

    if (Object.keys(produtosAgrupados).length === 0) {
        container.innerHTML = '<p>Nenhum produto cadastrado.</p>';
        return;
    }
    for (const categoriaNome in produtosAgrupados) {
        const categoriaCard = document.createElement('div');
        categoriaCard.className = 'categoria-card';
        categoriaCard.innerHTML = `<h4>${categoriaNome}</h4><p>${produtosAgrupados[categoriaNome].length} produto(s)</p>`;
        categoriaCard.onclick = () => abrirModalProdutosDaCategoria(categoriaNome, produtosAgrupados[categoriaNome]);
        container.appendChild(categoriaCard);
    }
}

function abrirModalProdutosDaCategoria(categoriaNome, produtosDaCategoria) {
    const modal = document.getElementById('produtosCategoriaModal');
    document.getElementById('produtos-categoria-modal-title').textContent = `Produtos da Categoria: ${categoriaNome}`;
    const modalBody = document.getElementById('produtos-categoria-modal-body');
    if (produtosDaCategoria.length === 0) {
        modalBody.innerHTML = '<p>Nenhum produto nesta categoria.</p>';
        modal.classList.add('active');
        return;
    }
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>ID</th><th>Nome Proposta</th><th>Nome Real</th><th>Valor</th><th>Ações</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    produtosDaCategoria.forEach((p, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${(index + 1).toString().padStart(3, '0')}</td>
                <td>${p.nomeProposta}</td>
                <td>${p.nomeReal || 'N/A'}</td>
                <td>${formatarMoeda(p.valor)}</td>
                <td>
                    <button class="btn-editar btn-sm" onclick="event.stopPropagation(); editarProduto('${p.id}'); closeProdutosCategoriaModal();"><i class="fas fa-edit"></i></button>
                    <button class="btn-excluir btn-sm" onclick="event.stopPropagation(); excluirProduto('${p.id}', '${categoriaNome}');"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
    });
    modalBody.innerHTML = `<div class="table-container"></div>`;
    modalBody.querySelector('.table-container').appendChild(table);
    modal.classList.add('active');
}

function closeProdutosCategoriaModal() {
    document.getElementById('produtosCategoriaModal').classList.remove('active');
}

function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (produto) {
        document.getElementById('produto-id').value = produto.id;
        document.getElementById('produto-nome-proposta').value = produto.nomeProposta;
        document.getElementById('produto-nome-real').value = produto.nomeReal || '';
        document.getElementById('produto-categoria').value = produto.categoria || '';
        document.getElementById('produto-valor').value = produto.valor;
        document.querySelector('#nav-produtos').click();
        document.getElementById('produto-nome-proposta').focus();
    }
}

function excluirProduto(id, categoriaAberta = null) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        produtos = produtos.filter(p => p.id !== id);
        saveData();
        renderizarProdutosPorCategoria();
        alert('Produto excluído!');
        if (categoriaAberta) {
            const produtosRestantes = produtos.filter(p => (p.categoria || 'Geral') === categoriaAberta);
            if (produtosRestantes.length > 0) {
                abrirModalProdutosDaCategoria(categoriaAberta, produtosRestantes);
            } else {
                closeProdutosCategoriaModal();
            }
        }
    }
}

// Orçamentos
function carregarClientesNoSelect(selectId) {
    const select = document.getElementById(selectId);
    const clienteSelecionado = select.value;
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    clientes.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
    if (clientes.find(c => c.id === clienteSelecionado)) {
        select.value = clienteSelecionado;
    }
}

function carregarOrcamentosNoSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione um orçamento...</option>';
    orcamentos.forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        select.innerHTML += `<option value="${orc.id}">Nº ${orc.id} - ${cliente ? cliente.nome : 'Cliente desconhecido'}</option>`;
    });
}

function salvarDadosOrcamento() {
    currentOrcamento.clienteId = document.getElementById('orcamento-cliente').value;
    currentOrcamento.servicos = document.getElementById('orcamento-servicos').value;
    const maoDeObraVal = parseFloat(document.getElementById('orcamento-mao-de-obra').value);
    currentOrcamento.maoDeObra = isNaN(maoDeObraVal) ? 0 : maoDeObraVal;
    currentOrcamento.relatorio = document.getElementById('orcamento-relatorio').value;
    currentOrcamento.formasPagamento = document.getElementById('orcamento-formas-pagamento').value;
    saveData();
}

function adicionarOuEditarItemOrcamento(event) {
    event.preventDefault();
    const produtoId = document.getElementById('modal-produto').value;
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) { alert('Selecione um produto válido.'); return; }

    const quantidade = parseInt(document.getElementById('modal-quantidade').value);
    const valor = parseFloat(document.getElementById('modal-valor').value);
    if (isNaN(quantidade) || quantidade <= 0) { alert('Quantidade inválida.'); return; }
    if (isNaN(valor) || valor < 0) { alert('Valor inválido.'); return; }

    const newItem = { produtoId, produtoNome: produto.nomeProposta, quantidade, valor };
    
    // CORREÇÃO 1: Identificar se a edição é no orçamento atual ou no modal de edição
    const modal = document.getElementById('itemModal');
    const source = modal.dataset.source; // 'current' or 'edit'

    if (source === 'current') {
        if (isEditingItem && editingItemIndex > -1) {
            currentOrcamento.itens[editingItemIndex] = newItem;
        } else {
            currentOrcamento.itens.push(newItem);
        }
        renderizarItensOrcamento();
        calcularTotaisOrcamento();
    } else if (source === 'edit') {
        const orcamentoId = document.getElementById('edit-orcamento-id').value;
        const orcIndex = orcamentos.findIndex(o => o.id === orcamentoId);
        if (orcIndex === -1) return;
        
        if (isEditingItem && editingItemIndex > -1) {
            orcamentos[orcIndex].itens[editingItemIndex] = newItem;
        } else {
            orcamentos[orcIndex].itens.push(newItem);
        }
        renderizarItensOrcamentoModalEdicao(orcamentos[orcIndex]);
    }

    saveData();
    closeModal('itemModal');
}

// CORREÇÃO 1: Função para excluir item, chamada pelo botão no modal de edição
function excluirItemPeloModal() {
    const modal = document.getElementById('itemModal');
    const source = modal.dataset.source; // 'current' ou 'edit'
    const itemIndex = editingItemIndex;

    if (itemIndex > -1 && confirm('Tem certeza que deseja remover este item do orçamento?')) {
        if (source === 'current') {
            currentOrcamento.itens.splice(itemIndex, 1);
            renderizarItensOrcamento();
            calcularTotaisOrcamento();
        } else if (source === 'edit') {
            const orcamentoId = document.getElementById('edit-orcamento-id').value;
            const orc = orcamentos.find(o => o.id === orcamentoId);
            if (orc) {
                orc.itens.splice(itemIndex, 1);
                renderizarItensOrcamentoModalEdicao(orc);
            }
        }
        saveData();
        closeModal('itemModal');
    }
}


function renderizarItensOrcamento() {
    const tbody = document.querySelector('#orcamento-itens-tabela tbody');
    tbody.innerHTML = '';
    if (!currentOrcamento.itens) currentOrcamento.itens = [];
    currentOrcamento.itens.forEach((item, index) => {
        // CORREÇÃO 1: Removido o botão de excluir da linha da tabela. Ação agora é centralizada no botão editar.
        tbody.innerHTML += `
            <tr>
                <td>${item.produtoNome}</td>
                <td>${item.quantidade}</td>
                <td>${formatarMoeda(item.valor)}</td>
                <td style="text-align: right;">${formatarMoeda(item.quantidade * item.valor)}</td>
                <td style="text-align: center;">
                    <button class="btn-editar" onclick="openItemModal(${index}, 'current')"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `;
    });
}

function calcularTotaisOrcamento() {
    const totalProdutos = currentOrcamento.itens.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
    const totalGeral = totalProdutos + currentOrcamento.maoDeObra;
    document.getElementById('total-produtos').textContent = formatarMoeda(totalProdutos);
    document.getElementById('total-geral').textContent = formatarMoeda(totalGeral);
}

function carregarOrcamentoAtual() {
    if (!currentOrcamento.id) currentOrcamento.id = generateSequentialId(true);
    
    document.getElementById('orcamento-cliente').value = currentOrcamento.clienteId || '';
    document.getElementById('orcamento-servicos').value = currentOrcamento.servicos || '';
    document.getElementById('orcamento-mao-de-obra').value = currentOrcamento.maoDeObra > 0 ? currentOrcamento.maoDeObra.toFixed(2) : '';
    document.getElementById('orcamento-relatorio').value = currentOrcamento.relatorio || '';
    document.getElementById('orcamento-formas-pagamento').value = currentOrcamento.formasPagamento || '';

    carregarClientesNoSelect('orcamento-cliente');
    if (currentOrcamento.clienteId) document.getElementById('orcamento-cliente').value = currentOrcamento.clienteId;

    renderizarItensOrcamento();
    calcularTotaisOrcamento();
}

function salvarOrcamentoAtual() {
    if (!currentOrcamento.clienteId) { alert('Selecione um cliente.'); return false; }
    if (currentOrcamento.itens.length === 0) { alert('Adicione pelo menos um item.'); return false; }

    currentOrcamento.data = new Date().toISOString();
    salvarDadosOrcamento(); 

    const existingIndex = orcamentos.findIndex(o => o.id === currentOrcamento.id);
    if (existingIndex !== -1) {
        orcamentos[existingIndex] = { ...currentOrcamento };
    } else {
        orcamentos.push({ ...currentOrcamento });
    }
    saveData();
    renderizarOrcamentosSalvos();
    alert(`Orçamento ${currentOrcamento.id} salvo com sucesso!`);
    return true;
}

function novoOrcamento() {
    currentOrcamento = {
        id: generateSequentialId(),
        clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: []
    };
    saveData();
    carregarOrcamentoAtual();
    alert('Novo orçamento iniciado com ID: ' + currentOrcamento.id);
}

function salvarE䡊ovoOrcamento() {
    if (salvarOrcamentoAtual()) {
        if (confirm('Deseja iniciar um novo orçamento?')) {
            novoOrcamento();
        }
    }
}


function renderizarOrcamentosSalvos() {
    const ul = document.getElementById('lista-orcamentos');
    ul.innerHTML = '';
    orcamentos.sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const dataFmt = new Date(orc.data || Date.now()).toLocaleDateString('pt-BR');
        const hasNFE = orc.nfeChaves && orc.nfeChaves.filter(n => n).length > 0;
        ul.innerHTML += `
            <li>
                <span>${cliente ? cliente.nome : 'Cliente Desconhecido'} - ${dataFmt} (Nº: ${orc.id})</span>
                <div>
                    <button class="btn-editar" onclick="abrirModalEdicaoOrcamento('${orc.id}')" title="Abrir/Editar"><i class="fas fa-folder-open"></i></button>
                    <button class="btn-excluir" onclick="iniciarExclusaoOrcamento('${orc.id}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                    <button class="btn-preview" onclick="previewOrcamento('${orc.id}')" title="Preview Proposta"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-faturamento ${orc.faturamentoData ? 'active' : ''}" onclick="visualizarFaturamento('${orc.id}')" title="Ver Faturamento"><i class="fas fa-file-invoice"></i></button>
                    <button class="btn-nfe ${hasNFE ? 'active' : ''}" onclick="visualizarNFE('${orc.id}')" title="Ver NFE"><i class="fas fa-receipt"></i></button>
                </div>
            </li>
        `;
    });
}

// CORREÇÃO 2: Função que ABRE O MODAL de edição, substituindo a antiga `carregarOrcamentoSalvo`
function abrirModalEdicaoOrcamento(id) {
    const orc = orcamentos.find(o => o.id === id);
    if (!orc) {
        alert('Orçamento não encontrado!');
        return;
    }

    // Preencher os campos do modal de edição
    document.getElementById('edit-orcamento-id').value = orc.id;
    document.getElementById('edit-orcamento-modal-title').textContent = `Editar Orçamento Nº ${orc.id}`;
    
    // Carregar clientes no select do modal e selecionar o correto
    carregarClientesNoSelect('edit-orcamento-cliente');
    document.getElementById('edit-orcamento-cliente').value = orc.clienteId;

    document.getElementById('edit-orcamento-servicos').value = orc.servicos || '';
    document.getElementById('edit-orcamento-mao-de-obra').value = orc.maoDeObra > 0 ? orc.maoDeObra.toFixed(2) : '';
    document.getElementById('edit-orcamento-relatorio').value = orc.relatorio || '';
    document.getElementById('edit-orcamento-formas-pagamento').value = orc.formasPagamento || '';

    // Renderizar itens e totais no modal
    renderizarItensOrcamentoModalEdicao(orc);
    
    // Abrir o modal
    document.getElementById('editOrcamentoModal').classList.add('active');
}

// CORREÇÃO 2: Função para renderizar os itens DENTRO do modal de edição
function renderizarItensOrcamentoModalEdicao(orc) {
    const tbody = document.querySelector('#edit-orcamento-itens-tabela tbody');
    tbody.innerHTML = '';
    if (!orc.itens) orc.itens = [];

    orc.itens.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.produtoNome}</td>
                <td>${item.quantidade}</td>
                <td>${formatarMoeda(item.valor)}</td>
                <td style="text-align: right;">${formatarMoeda(item.quantidade * item.valor)}</td>
                <td style="text-align: center;">
                    <button class="btn-editar" onclick="openItemModal(${index}, 'edit')"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `;
    });
    calcularTotaisOrcamentoModalEdicao(orc);
}

// CORREÇÃO 2: Função para calcular os totais DENTRO do modal de edição
function calcularTotaisOrcamentoModalEdicao(orc) {
    const maoDeObra = parseFloat(document.getElementById('edit-orcamento-mao-de-obra').value) || 0;
    const totalProdutos = orc.itens.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
    const totalGeral = totalProdutos + maoDeObra;
    document.getElementById('edit-total-produtos').textContent = formatarMoeda(totalProdutos);
    document.getElementById('edit-total-geral').textContent = formatarMoeda(totalGeral);
}


// CORREÇÃO 2: Função para salvar as alterações feitas no modal de edição
function salvarAlteracoesOrcamentoPeloModal() {
    const orcamentoId = document.getElementById('edit-orcamento-id').value;
    const orcIndex = orcamentos.findIndex(o => o.id === orcamentoId);

    if (orcIndex === -1) {
        alert('Erro: Orçamento não encontrado para salvar.');
        return;
    }

    // Atualizar os dados do orçamento com os valores do modal
    orcamentos[orcIndex].clienteId = document.getElementById('edit-orcamento-cliente').value;
    orcamentos[orcIndex].servicos = document.getElementById('edit-orcamento-servicos').value;
    orcamentos[orcIndex].maoDeObra = parseFloat(document.getElementById('edit-orcamento-mao-de-obra').value) || 0;
    orcamentos[orcIndex].relatorio = document.getElementById('edit-orcamento-relatorio').value;
    orcamentos[orcIndex].formasPagamento = document.getElementById('edit-orcamento-formas-pagamento').value;
    
    saveData();
    renderizarOrcamentosSalvos();
    closeModal('editOrcamentoModal');
    alert('Orçamento atualizado com sucesso!');
}


// CORREÇÃO 3: Função que inicia o processo de exclusão, abrindo o modal de swipe
function iniciarExclusaoOrcamento(id) {
    const modal = document.getElementById('swipe-confirm-modal');
    modal.dataset.orcamentoId = id; // Armazena o ID do orçamento a ser excluído
    modal.classList.add('active');
}

// CORREÇÃO 3: Função que configura toda a lógica do "arrastar para excluir"
function configurarSwipeParaExcluir() {
    const modal = document.getElementById('swipe-confirm-modal');
    const container = document.getElementById('swipe-container');
    const handle = document.getElementById('swipe-handle');
    const cancelBtn = document.getElementById('swipe-cancel-btn');
    let isDragging = false;
    
    const resetSwipe = () => {
        handle.style.transition = 'left 0.3s ease';
        handle.style.left = '0px';
        container.classList.remove('confirmed');
    };

    const onDragStart = () => {
        isDragging = true;
        handle.style.transition = 'none'; // Remove transição durante o arrasto
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const rect = container.getBoundingClientRect();
        let newLeft = clientX - rect.left - (handle.offsetWidth / 2);

        // Limites
        if (newLeft < 0) newLeft = 0;
        const maxLeft = container.offsetWidth - handle.offsetWidth;
        if (newLeft > maxLeft) {
            newLeft = maxLeft;
        }
        handle.style.left = `${newLeft}px`;
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        const maxLeft = container.offsetWidth - handle.offsetWidth;
        const currentLeft = parseInt(handle.style.left, 10);

        if (currentLeft >= maxLeft * 0.9) { // Se arrastou 90% do caminho
            handle.style.left = `${maxLeft}px`;
            container.classList.add('confirmed');
            setTimeout(() => {
                excluirOrcamentoSalvo(modal.dataset.orcamentoId);
                closeModal('swipe-confirm-modal');
                resetSwipe();
            }, 300);
        } else {
            resetSwipe();
        }
    };

    // Eventos de Mouse
    handle.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    // Eventos de Toque
    handle.addEventListener('touchstart', onDragStart);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);

    cancelBtn.addEventListener('click', () => {
        closeModal('swipe-confirm-modal');
        resetSwipe();
    });
}

// CORREÇÃO 3: Lógica de exclusão refatorada. Agora é chamada APÓS a confirmação no modal.
function excluirOrcamentoSalvo(id) {
    orcamentos = orcamentos.filter(o => o.id !== id);
    saveData();
    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados(); // Atualiza a lista de faturamentos caso o orçamento excluído tivesse um.
    if (currentOrcamento.id === id) {
        novoOrcamento();
    }
    alert('Orçamento excluído permanentemente!');
}

function previewOrcamento(id) {
    const orc = orcamentos.find(o => o.id === id);
    if(orc) gerarPDF(true, orc); else alert('Orçamento não encontrado.');
}

// Faturamento (sem alterações)
function preencherClienteFaturamento() {
    const orcamentoId = document.getElementById('faturamento-orcamento-vinculado').value;
    const nomeClienteInput = document.getElementById('faturamento-cliente-nome');
    const orc = orcamentos.find(o => o.id === orcamentoId);
    if(orc) {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        nomeClienteInput.value = cliente ? cliente.nome : 'Cliente não encontrado';
    } else {
        nomeClienteInput.value = '';
    }
}

function adicionarParcela() {
    const container = document.getElementById('faturamento-parcelas-container');
    container.innerHTML += `
        <div class="parcela-row">
            <div class="form-group"><label>Vencimento:</label><input type="date" class="parcela-data" required></div>
            <div class="form-group"><label>Valor (R$):</label><input type="number" step="0.01" min="0" class="parcela-valor" required></div>
            <button type="button" class="btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
}

function gerarEAnexarFaturamento() {
    const orcamentoId = document.getElementById('faturamento-orcamento-vinculado').value;
    if (!orcamentoId) { alert('Selecione um orçamento para vincular o faturamento.'); return false; }

    const orcIndex = orcamentos.findIndex(o => o.id === orcamentoId);
    if (orcIndex === -1) { alert('Orçamento não encontrado.'); return false; }

    const faturamentoData = {
        clienteId: orcamentos[orcIndex].clienteId,
        localServico: document.getElementById('faturamento-local').value,
        tipoServico: document.getElementById('faturamento-tipo-servico').value,
        valorEntrada: parseFloat(document.getElementById('faturamento-entrada').value) || 0,
        parcelas: Array.from(document.querySelectorAll('#faturamento-parcelas-container .parcela-row')).map(row => ({
            data: row.querySelector('.parcela-data').value,
            valor: parseFloat(row.querySelector('.parcela-valor').value)
        })).filter(p => p.data && !isNaN(p.valor))
    };

    if (!faturamentoData.localServico || !faturamentoData.tipoServico) {
        alert('Preencha o Local e o Tipo de Serviço.'); return false;
    }

    orcamentos[orcIndex].faturamentoData = faturamentoData;
    saveData();
    gerarFaturamentoPDF(faturamentoData);
    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados();
    alert('Faturamento gerado e anexado ao orçamento com sucesso!');
    return true;
}

function novoFaturamento() {
    document.getElementById('faturamento-form').reset();
    document.getElementById('faturamento-parcelas-container').innerHTML = '';
    document.getElementById('faturamento-cliente-nome').value = '';
}

function salvarE䡊ovoFaturamento() {
    if (gerarEAnexarFaturamento()) {
        novoFaturamento();
    }
}

function visualizarFaturamento(orcamentoId) {
    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (orc && orc.faturamentoData) {
        gerarFaturamentoPDF(orc.faturamentoData, true);
    } else {
        alert('Nenhum faturamento encontrado para este orçamento. Gere um na aba "Faturamento".');
    }
}

function carregarFaturamentoSalvo(orcamentoId) {
    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (orc && orc.faturamentoData) {
        document.getElementById('faturamento-orcamento-vinculado').value = orcamentoId;
        preencherClienteFaturamento();
        document.getElementById('faturamento-local').value = orc.faturamentoData.localServico || '';
        document.getElementById('faturamento-tipo-servico').value = orc.faturamentoData.tipoServico || '';
        document.getElementById('faturamento-entrada').value = orc.faturamentoData.valorEntrada > 0 ? orc.faturamentoData.valorEntrada.toFixed(2) : '0';

        const container = document.getElementById('faturamento-parcelas-container');
        container.innerHTML = '';
        orc.faturamentoData.parcelas.forEach(parcela => {
            container.innerHTML += `
                <div class="parcela-row">
                    <div class="form-group"><label>Vencimento:</label><input type="date" class="parcela-data" value="${parcela.data}" required></div>
                    <div class="form-group"><label>Valor (R$):</label><input type="number" step="0.01" min="0" class="parcela-valor" value="${parcela.valor.toFixed(2)}" required></div>
                    <button type="button" class="btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
        });
        showSection('faturamento');
        document.querySelector('#nav-faturamento').click();
        alert(`Faturamento do orçamento ${orcamentoId} carregado para edição.`);
    } else {
        alert('Nenhum faturamento encontrado para este orçamento.');
    }
}

function excluirFaturamentoSalvo(orcamentoId) {
    if (confirm('Tem certeza que deseja excluir este faturamento? Esta ação não pode ser desfeita.')) {
        const orcIndex = orcamentos.findIndex(o => o.id === orcamentoId);
        if (orcIndex !== -1) {
            orcamentos[orcIndex].faturamentoData = null;
            saveData();
            renderizarOrcamentosSalvos();
            renderizarFaturamentosGerados();
            alert('Faturamento excluído com sucesso!');
        } else {
            alert('Orçamento não encontrado.');
        }
    }
}

function renderizarFaturamentosGerados() {
    const container = document.getElementById('lista-faturamentos-gerados');
    container.innerHTML = '<ul></ul>';
    const ul = container.querySelector('ul');
    const faturamentosList = orcamentos.filter(o => o.faturamentoData);

    if (faturamentosList.length === 0) {
        container.innerHTML = '<p>Nenhum faturamento gerado.</p>';
        return;
    }

    faturamentosList.forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        ul.innerHTML += `
            <li class="list-item">
                <span>Faturamento para: ${cliente ? cliente.nome : 'N/A'} (Ref. Orç. Nº ${orc.id})</span>
                <div>
                    <button class="btn-editar" onclick="carregarFaturamentoSalvo('${orc.id}')" title="Abrir"><i class="fas fa-folder-open"></i> Abrir</button>
                    <button class="btn-preview" onclick="visualizarFaturamento('${orc.id}')"><i class="fas fa-eye"></i> Visualizar</button>
                    <button class="btn-excluir" onclick="excluirFaturamentoSalvo('${orc.id}')" title="Excluir"><i class="fas fa-trash-alt"></i> Excluir</button>
                </div>
            </li>
        `;
    });
}

// Nota Fornecedor (sem alterações)
const MAX_NFE_CHAVES = 3; 

function carregarChavesNFEParaOrcamentoSelecionado() {
    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    const nfePanel = document.getElementById('nfe-management-panel');
    nfePanel.innerHTML = ''; 

    if (!orcamentoId) {
        nfePanel.innerHTML = '<div class="nfe-placeholder"><i class="fas fa-arrow-up"></i><p>Selecione um orçamento acima para começar.</p></div>';
        return;
    }

    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (orc && !orc.nfeChaves) {
        orc.nfeChaves = [];
    }

    for (let i = 0; i < MAX_NFE_CHAVES; i++) {
        const entry = (orc && orc.nfeChaves[i]) ? orc.nfeChaves[i] : { chave: '', fornecedor: '' };
        adicionarCampoChaveNFE(entry, i);
    }
}

function adicionarCampoChaveNFE(initialEntry = { chave: '', fornecedor: '' }, index) {
    const nfePanel = document.getElementById('nfe-management-panel');

    const div = document.createElement('div');
    div.classList.add('nfe-input-group');
    div.dataset.index = index;

    const formattedChave = initialEntry.chave ? initialEntry.chave.replace(/(\d{4})(?=\d)/g, '$1-') : '';

    div.innerHTML = `
        <label for="nfe-chave-${index}">CHAVE DE ACESSO DA NF-E ${index + 1}:</label>
        <input type="text" id="nfe-chave-${index}"
               placeholder="Somente números, 44 dígitos"
               value="${formattedChave}"
               maxlength="54">
        
        <label for="nfe-fornecedor-${index}">Fornecedor:</label>
        <input type="text" id="nfe-fornecedor-${index}"
               placeholder="Nome do Fornecedor"
               value="${initialEntry.fornecedor || ''}">
        
        <div class="nfe-actions">
            <button type="button" class="btn-primary btn-salvar-nfe" data-index="${index}" title="Salvar"><i class="fas fa-save"></i></button>
            <button type="button" class="btn-editar btn-editar-nfe" data-index="${index}" title="Editar"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn-secondary btn-gerar-nfe" data-index="${index}" title="Copiar e Abrir Consulta"><i class="fas fa-external-link-alt"></i></button>
            <button type="button" class="btn-danger btn-excluir-nfe" data-index="${index}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
    nfePanel.appendChild(div);

    const inputField = document.getElementById(`nfe-chave-${index}`);
    inputField.addEventListener('input', formatNFEChaveInput);

    const fornecedorField = document.getElementById(`nfe-fornecedor-${index}`);
    const saveButton = div.querySelector('.btn-salvar-nfe');
    const editButton = div.querySelector('.btn-editar-nfe');

    if (initialEntry.chave) {
        inputField.disabled = true;
        fornecedorField.disabled = true;
        saveButton.style.display = 'none';
        editButton.style.display = 'inline-flex';
    } else { 
        inputField.disabled = false;
        fornecedorField.disabled = false;
        saveButton.style.display = 'inline-flex';
        editButton.style.display = 'none';
    }
}

function formatNFEChaveInput(event) {
    let value = event.target.value.replace(/\D/g, ''); 
    let formattedValue = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formattedValue += '-';
        }
        formattedValue += value[i];
    }
    event.target.value = formattedValue.substring(0, 54);
}

function salvarChaveNFE(index) {
    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    if (!orcamentoId) { alert('Erro: Orçamento não selecionado.'); return; }

    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (!orc) { alert('Orçamento não encontrado.'); return; }

    const inputFieldChave = document.getElementById(`nfe-chave-${index}`);
    const inputFieldFornecedor = document.getElementById(`nfe-fornecedor-${index}`);
    
    let chaveLimpa = inputFieldChave.value.replace(/\D/g, '');
    const fornecedor = inputFieldFornecedor.value.trim();

    if (chaveLimpa.length !== 44) {
        alert('A chave de acesso da NF-e deve ter 44 dígitos numéricos.');
        return;
    }
    if (!fornecedor) {
        alert('O nome do fornecedor é obrigatório.');
        return;
    }

    if (!Array.isArray(orc.nfeChaves)) {
        orc.nfeChaves = [];
    }
    while (orc.nfeChaves.length <= index) {
        orc.nfeChaves.push(null); 
    }

    orc.nfeChaves[index] = { chave: chaveLimpa, fornecedor: fornecedor };

    inputFieldChave.value = chaveLimpa.replace(/(\d{4})(?=\d)/g, '$1-');

    saveData();
    renderizarOrcamentosSalvos();

    inputFieldChave.disabled = true;
    inputFieldFornecedor.disabled = true;
    const groupDiv = inputFieldChave.closest('.nfe-input-group');
    groupDiv.querySelector('.btn-salvar-nfe').style.display = 'none';
    groupDiv.querySelector('.btn-editar-nfe').style.display = 'inline-flex';

    alert('Chave de acesso e Fornecedor salvos com sucesso!');
}

function editarChaveNFE(index) {
    const inputFieldChave = document.getElementById(`nfe-chave-${index}`);
    const inputFieldFornecedor = document.getElementById(`nfe-fornecedor-${index}`);
    const groupDiv = inputFieldChave.closest('.nfe-input-group');

    inputFieldChave.disabled = false;
    inputFieldFornecedor.disabled = false;

    groupDiv.querySelector('.btn-salvar-nfe').style.display = 'inline-flex';
    groupDiv.querySelector('.btn-editar-nfe').style.display = 'none';
    inputFieldChave.focus();
}

function excluirChaveNFE(index) {
    if (!confirm('Tem certeza que deseja excluir esta chave de acesso da NF-e e o fornecedor associado?')) {
        return;
    }

    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (!orc) { alert('Orçamento não encontrado.'); return; }

    if (orc.nfeChaves && orc.nfeChaves.length > index) {
        orc.nfeChaves[index] = null;
        while (orc.nfeChaves.length > 0 && orc.nfeChaves[orc.nfeChaves.length - 1] === null) {
            orc.nfeChaves.pop();
        }

        saveData();
        renderizarOrcamentosSalvos();
        carregarChavesNFEParaOrcamentoSelecionado(); 
        alert('Chave de acesso e Fornecedor excluídos com sucesso!');
    }
}

function gerarNFEFromChave(index) {
    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (!orc || !orc.nfeChaves || !orc.nfeChaves[index] || !orc.nfeChaves[index].chave) {
        alert('Chave de acesso não encontrada para este campo.');
        return;
    }
    const chaveAcessoLimpa = orc.nfeChaves[index].chave;

    navigator.clipboard.writeText(chaveAcessoLimpa).then(() => {
        alert(`Chave de acesso copiada para a área de transferência: ${chaveAcessoLimpa}\n\nO site de consulta será aberto para você colar a chave.`);
        window.open('https://consultadanfe.com/', '_blank');
    }).catch(err => {
        console.error('Erro ao copiar chave:', err);
        alert(`Não foi possível copiar a chave automaticamente. Por favor, copie manualmente: ${chaveAcessoLimpa}\n\nO site de consulta será aberto.`);
        window.open('https://consultadanfe.com/', '_blank');
    });
}

function visualizarNFE(orcamentoId) {
    const orc = orcamentos.find(o => o.id === orcamentoId);
    if (orc && orc.nfeChaves && orc.nfeChaves.filter(n => n).length > 0) {
        let content = '<h3>Chaves de Acesso da NF-e vinculadas ao Orçamento Nº ' + orcamentoId + ':</h3><ul>';
        orc.nfeChaves.forEach((entry, index) => {
            if (entry) {
                const chave = entry.chave || 'N/A';
                const fornecedor = entry.fornecedor || 'N/A';
                content += `<li>NF-e ${index + 1}: <strong>${chave}</strong> <br> Fornecedor: ${fornecedor}</li>`;
            }
        });
        content += '</ul><p>Para gerenciar estas notas, vá para a aba "Nota Fornecedor" e selecione este orçamento.</p>';

        const win = window.open("", "_blank", "width=600,height=400");
        win.document.write(`
            <html>
            <head><title>Detalhes da NF-e</title>
            <style>body{font-family:sans-serif;padding:20px;background-color:#f4f4f4;color:#333}h3{color:#005166}ul{list-style-type:none;padding:0}li{margin-bottom:10px;padding:10px;background-color:#e0e0e0;border-radius:5px}strong{color:#007bff}p{font-size:0.9em;color:#666}</style>
            </head>
            <body>${content}</body>
            </html>`);
    } else {
        alert('Nenhuma NF-e anexada a este orçamento.');
    }
}

// Funções de Modal
// CORREÇÃO 1 e 2: `openItemModal` agora aceita um segundo parâmetro `source` para saber de onde foi chamado
function openItemModal(itemIndex = -1, source = 'current') {
    const modal = document.getElementById('itemModal');
    modal.dataset.source = source; // Armazena a origem da chamada
    const form = document.getElementById('item-form');
    form.reset();
    isEditingItem = itemIndex > -1;
    editingItemIndex = itemIndex;

    const deleteBtn = document.getElementById('delete-item-btn');
    carregarCategoriasNoModalItem();

    let orcamentoDeOrigem;
    if (source === 'current') {
        orcamentoDeOrigem = currentOrcamento;
    } else {
        const orcamentoId = document.getElementById('edit-orcamento-id').value;
        orcamentoDeOrigem = orcamentos.find(o => o.id === orcamentoId);
    }

    if (isEditingItem && orcamentoDeOrigem && orcamentoDeOrigem.itens[itemIndex]) {
        const item = orcamentoDeOrigem.itens[itemIndex];
        const produto = produtos.find(p => p.id === item.produtoId);
        document.getElementById('modal-item-categoria').value = produto ? (produto.categoria || 'Geral') : '';
        carregarProdutosNoModalPorCategoria();
        document.getElementById('modal-produto').value = item.produtoId;
        document.getElementById('modal-quantidade').value = item.quantidade;
        document.getElementById('modal-valor').value = item.valor.toFixed(2);
        modal.querySelector('h3').textContent = 'Editar Item';
        modal.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-edit"></i> Atualizar Item';
        deleteBtn.style.display = 'inline-block'; // Mostra o botão de excluir
    } else {
        carregarProdutosNoModalPorCategoria();
        modal.querySelector('h3').textContent = 'Adicionar Item';
        modal.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Item';
        deleteBtn.style.display = 'none'; // Esconde o botão de excluir
    }
    modal.classList.add('active');
}


function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
        select.innerHTML += `<option value="${p.id}" data-valor="${p.valor}">${p.nomeProposta} ${valorDisplay}</option>`;
    });
}
