// =======================================================
// ========= VARIÁVEIS GLOBAIS ===========================
// =======================================================
let clientes = [];
let produtos = [];
let orcamentos = [];
let contratos = []; 
let transacoes = []; 
let proximoOrcamentoId = 1;

let currentOrcamento = {
    id: generateSequentialId(true),
    clienteId: null,
    itens: [],
    maoDeObra: 0,
    relatorio: "",
    formasPagamento: "",
    servicos: "",
};
let isEditingItem = false;
let editingItemIndex = -1;

// Variáveis para o Financeiro
let financeiroChartInstance = null;
let currentFinanceiroDate = new Date();

// Firebase variables
let firebaseUser = null;
const firebaseStatusElement = document.getElementById('firebase-status');
const firebaseCloudStatusElement = document.getElementById('firebase-cloud-status');


// =======================================================
// ========= INICIALIZAÇÃO ===============================
// =======================================================
document.addEventListener('DOMContentLoaded', function() {
    configurarEventListeners();
    setupFirebaseAuthStateListener();
    
    // Inicializar
    showSection('clientes');
    preencherSelectsDataFinanceiro();
    
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
});

function configurarEventListeners() {
    // Navegação Principal
    document.querySelectorAll('nav a[id^="nav-"]').forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.id.replace('nav-', '');
            showSection(sectionId);
            document.querySelectorAll('nav a').forEach(item => item.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Aba Clientes
    document.getElementById('cliente-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarENovoCliente();
    });
    document.querySelector('#cliente-details-modal .close-modal').addEventListener('click', () => closeModal('cliente-details-modal'));

    // Aba Produtos
    document.getElementById('produto-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarENovoProduto();
    });
    document.getElementById('close-produtos-categoria-modal').addEventListener('click', closeProdutosCategoriaModal);

    // Aba Orçamentos
    document.getElementById('orcamento-form').addEventListener('input', salvarDadosOrcamento);
    document.getElementById('adicionar-item-btn').addEventListener('click', () => openItemModal(-1, 'current'));
    
    // Botão Gerar PDF do formulário (Força download = false no preview)
    document.getElementById('gerar-pdf-btn').addEventListener('click', () => gerarPDF(false));
    
    document.getElementById('salvar-novo-orcamento-btn').addEventListener('click', salvarENovoOrcamento);
    
    // Modal Item Orçamento
    document.getElementById('item-form').addEventListener('submit', adicionarOuEditarItemOrcamento);
    document.querySelector('#itemModal .close-modal').addEventListener('click', () => closeModal('itemModal'));
    document.getElementById('modal-item-categoria').addEventListener('change', carregarProdutosNoModalPorCategoria);
    document.getElementById('delete-item-btn').addEventListener('click', excluirItemPeloModal);

    // Lógica de valor automático no modal de item
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

    // Modal Edição Orçamento
    document.getElementById('close-edit-orcamento-modal').addEventListener('click', () => closeModal('editOrcamentoModal'));
    document.getElementById('save-orcamento-changes-btn').addEventListener('click', salvarAlteracoesOrcamentoPeloModal);
    document.getElementById('add-item-to-edited-orcamento-btn').addEventListener('click', () => openItemModal(-1, 'edit'));

    // Aba Contratos
    document.getElementById('novo-contrato-btn').addEventListener('click', () => openNovoContratoModal());
    document.querySelector('#novoContratoModal .close-modal').addEventListener('click', () => closeModal('novoContratoModal'));
    document.getElementById('salvar-contrato-btn').addEventListener('click', salvarContrato);
    document.getElementById('exportar-contratos-pdf-btn').addEventListener('click', exportarContratosPDF);

    // Aba Financeiro
    document.getElementById('nova-receita-btn').addEventListener('click', () => openNovaTransacaoModal('receita'));
    document.getElementById('nova-despesa-btn').addEventListener('click', () => openNovaTransacaoModal('despesa'));
    document.querySelector('#novaTransacaoModal .close-modal').addEventListener('click', () => closeModal('novaTransacaoModal'));
    document.getElementById('salvar-transacao-btn').addEventListener('click', salvarTransacao);
    document.getElementById('filtrar-financeiro-btn').addEventListener('click', atualizarDashboardFinanceiro);
    document.getElementById('exportar-financeiro-btn').addEventListener('click', exportarRelatorioFinanceiroPDF);
    
    // NOVA FUNCIONALIDADE: Transferência
    document.getElementById('nova-transferencia-btn').addEventListener('click', () => openModal('novaTransferenciaModal'));
    document.querySelector('#novaTransferenciaModal .close-modal').addEventListener('click', () => closeModal('novaTransferenciaModal'));
    document.getElementById('salvar-transferencia-btn').addEventListener('click', salvarTransferencia);

    // Listener dinâmico financeiro (Contrato Select)
    document.getElementById('transacao-categoria').addEventListener('change', function() {
        const isContrato = this.value === 'contrato';
        document.getElementById('group-contrato-select').style.display = isContrato ? 'block' : 'none';
    });

    // Firebase Auth
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('google-logout-btn').addEventListener('click', signOutGoogle);

    // Swipe Delete
    configurarSwipeParaExcluir();
}

// =======================================================
// ========= FIREBASE & DATA HANDLING ====================
// =======================================================

async function signInWithGoogle() {
    try {
        const provider = new window.GoogleAuthProvider();
        // MODIFICADO: Usar redirecionamento para funcionar no PWA/Mobile
        await window.signInWithRedirect(window.firebaseAuth, provider);
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
        salvarNoLocalStorage('contratos', contratos);
        salvarNoLocalStorage('transacoes', transacoes);
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
            contratos: contratos,
            transacoes: transacoes,
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
            contratos = data.contratos || [];
            transacoes = data.transacoes || [];
            proximoOrcamentoId = data.proximoOrcamentoId || 1;
            currentOrcamento = data.currentOrcamento || { id: generateSequentialId(true), clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "" };
            updateFirebaseStatus('Conectado', 'green');
        } else {
            updateFirebaseStatus('Nenhum dado na nuvem', 'blue');
            resetData();
        }
        carregarDadosIniciais(); 
    } catch (error) {
        console.error("Erro ao carregar dados do Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão', 'red');
        alert("Erro ao carregar dados do Firebase. Carregando dados locais. " + error.message);
        loadDataFromLocalStorage(); 
    }
}

function salvarNoLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadDataFromLocalStorage() {
    clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    produtos = JSON.parse(localStorage.getItem('produtos')) || [];
    orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || [];
    contratos = JSON.parse(localStorage.getItem('contratos')) || [];
    transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    proximoOrcamentoId = parseInt(localStorage.getItem('proximoOrcamentoId')) || 1;
    currentOrcamento = JSON.parse(localStorage.getItem('currentOrcamento')) || {
        id: generateSequentialId(true),
        clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "",
    };
    
    carregarDadosIniciais();
}

function resetData() {
    clientes = []; produtos = []; orcamentos = []; contratos = []; transacoes = [];
    proximoOrcamentoId = 1;
    currentOrcamento = { id: generateSequentialId(true), clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "" };
}

function saveData() {
    if (firebaseUser) {
        saveDataToFirestore();
    } else {
        salvarNoLocalStorage('clientes', clientes);
        salvarNoLocalStorage('produtos', produtos);
        salvarNoLocalStorage('orcamentos', orcamentos);
        salvarNoLocalStorage('contratos', contratos);
        salvarNoLocalStorage('transacoes', transacoes);
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
    
    renderizarContratos();
    verificarAlertasReajuste();
    gerarDespesasRecorrentesAutomaticas();
    atualizarDashboardFinanceiro();
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

// =======================================================
// ========= LÓGICA DE UI E NAVEGAÇÃO ====================
// =======================================================

function showSection(sectionId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active');
    });
    const section = document.getElementById(sectionId + '-section');
    if(section) section.classList.add('active');

    if (sectionId === 'orcamentos') carregarClientesNoSelect('orcamento-cliente');
    if (sectionId === 'produtos') renderizarProdutosPorCategoria();
    
    // Novas Abas
    if (sectionId === 'contratos') {
        renderizarContratos();
        verificarAlertasReajuste();
    }
    if (sectionId === 'financeiro') {
        atualizarDashboardFinanceiro();
        if(financeiroChartInstance) financeiroChartInstance.resize();
    }
}

// Utils
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

// =======================================================
// ========= CLIENTES ====================================
// =======================================================

function salvarCliente() {
    const id = document.getElementById('cliente-id').value;
    const nome = document.getElementById('cliente-nome').value.trim();
    const cpfCnpj = document.getElementById('cliente-cpf-cnpj').value.trim();
    const telefone = document.getElementById('cliente-telefone').value.trim();
    const endereco = document.getElementById('cliente-endereco').value.trim();

    if (!nome) { alert('O nome do cliente é obrigatório.'); return false; }

    if (id) {
        const index = clientes.findIndex(c => c.id === id);
        if (index !== -1) clientes[index] = { id, nome, cpfCnpj, telefone, endereco };
    } else {
        const novoCliente = { id: generateAlphanumericUniqueId(), nome, cpfCnpj, telefone, endereco };
        clientes.push(novoCliente);
        document.getElementById('cliente-id').value = novoCliente.id;
    }
    saveData();
    renderizarClientes();
    return true;
}

function novoCliente() {
    document.getElementById('cliente-form').reset();
    document.getElementById('cliente-id').value = '';
}

function salvarENovoCliente() {
    if (salvarCliente()) { novoCliente(); alert('Cliente salvo!'); }
}

function renderizarClientes() {
    const container = document.getElementById('clientes-cards-container');
    container.innerHTML = '';
    
    if (clientes.length === 0) {
        container.innerHTML = '<p>Nenhum cliente cadastrado.</p>';
        return;
    }

    clientes.forEach(cliente => {
        const card = document.createElement('div');
        card.className = 'cliente-card';
        card.setAttribute('onclick', `abrirModalDetalhesCliente('${cliente.id}')`);
        
        card.innerHTML = `
            <h4>${cliente.nome}</h4>
            <p><i class="fas fa-phone"></i> ${cliente.telefone || 'Não informado'}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${cliente.endereco || 'Não informado'}</p>
        `;
        container.appendChild(card);
    });
    
    carregarClientesNoSelect('orcamento-cliente');
}

function abrirModalDetalhesCliente(id) {
    const cliente = clientes.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById('cliente-detalhe-nome').textContent = cliente.nome;
    document.getElementById('cliente-detalhe-cpf-cnpj').textContent = cliente.cpfCnpj || 'Não informado';
    document.getElementById('cliente-detalhe-telefone').textContent = cliente.telefone || 'Não informado';
    document.getElementById('cliente-detalhe-endereco').textContent = cliente.endereco || 'Não informado';

    document.getElementById('cliente-modal-edit-btn').onclick = () => {
        closeModal('cliente-details-modal');
        editarCliente(id);
    };

    document.getElementById('cliente-modal-delete-btn').onclick = () => iniciarExclusaoCliente(id);
    openModal('cliente-details-modal');
}

function editarCliente(id) {
    const cliente = clientes.find(c => c.id === id);
    if (cliente) {
        document.getElementById('cliente-id').value = cliente.id;
        document.getElementById('cliente-nome').value = cliente.nome;
        document.getElementById('cliente-cpf-cnpj').value = cliente.cpfCnpj;
        document.getElementById('cliente-telefone').value = cliente.telefone;
        document.getElementById('cliente-endereco').value = cliente.endereco;
        document.getElementById('cliente-nome').focus();
        window.scrollTo(0, 0);
    }
}

function iniciarExclusaoCliente(id) {
    closeModal('cliente-details-modal');
    const modal = document.getElementById('swipe-confirm-modal');
    delete modal.dataset.orcamentoId;
    modal.dataset.clienteId = id;
    modal.classList.add('active');
}

function excluirCliente(id) {
    clientes = clientes.filter(c => c.id !== id);
    saveData(); 
    renderizarClientes();
    alert('Cliente excluído com sucesso!');
}

// =======================================================
// ========= PRODUTOS ====================================
// =======================================================

function salvarProduto() {
    const id = document.getElementById('produto-id').value;
    const nomeProposta = document.getElementById('produto-nome-proposta').value.trim();
    const nomeReal = document.getElementById('produto-nome-real').value.trim();
    const categoriaInput = document.getElementById('produto-categoria').value.trim();
    const valorInput = document.getElementById('produto-valor').value;

    if (!nomeProposta) { alert('O "Nome para Proposta" é obrigatório.'); return false; }
    const valor = parseFloat(valorInput);
    if (isNaN(valor) || valor < 0) { alert('Valor inválido.'); return false; }

    const categoria = categoriaInput || 'Geral';
    const produtoData = { id: id || generateAlphanumericUniqueId(), nomeProposta, nomeReal: nomeReal || nomeProposta, categoria, valor };

    if (id) {
        const index = produtos.findIndex(p => p.id === id);
        if (index !== -1) produtos[index] = produtoData;
    } else {
        produtos.push(produtoData);
        document.getElementById('produto-id').value = produtoData.id;
    }
    
    saveData(); 
    renderizarProdutosPorCategoria();
    return true;
}

function novoProduto() {
    document.getElementById('produto-form').reset();
    document.getElementById('produto-id').value = '';
}

function salvarENovoProduto() {
    if (salvarProduto()) { novoProduto(); alert('Produto salvo!'); }
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
                    <button class="btn-editar btn-sm" onclick="event.stopPropagation(); closeProdutosCategoriaModal(); editarProduto('${p.id}');"><i class="fas fa-edit"></i></button>
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

// =======================================================
// ========= ORÇAMENTOS ==================================
// =======================================================

function carregarClientesNoSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const clienteSelecionado = select.value;
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    clientes.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
    if (clientes.find(c => c.id === clienteSelecionado)) {
        select.value = clienteSelecionado;
    }
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
    const modal = document.getElementById('itemModal');
    const source = modal.dataset.source;

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

function excluirItemPeloModal() {
    const modal = document.getElementById('itemModal');
    const source = modal.dataset.source;
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
    return true;
}

function novoOrcamento() {
    currentOrcamento = {
        id: generateSequentialId(),
        clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "",
    };
    saveData();
    carregarOrcamentoAtual();
}

function salvarENovoOrcamento() {
    if (salvarOrcamentoAtual()) {
        if (confirm('Orçamento salvo! Deseja iniciar um novo?')) {
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
        ul.innerHTML += `
            <li>
                <span>${cliente ? cliente.nome : 'Cliente Desconhecido'} - ${dataFmt} (Nº: ${orc.id})</span>
                <div>
                    <button class="btn-editar" onclick="abrirModalEdicaoOrcamento('${orc.id}')" title="Abrir/Editar"><i class="fas fa-folder-open"></i></button>
                    <button class="btn-excluir" onclick="iniciarExclusaoOrcamento('${orc.id}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                    <button class="btn-preview" onclick="baixarPdfOrcamento('${orc.id}')" title="Baixar PDF"><i class="fas fa-file-pdf"></i></button>
                </div>
            </li>
        `;
    });
}

function baixarPdfOrcamento(id) {
    const orc = orcamentos.find(o => o.id === id);
    if(orc) {
        gerarPDF(false, orc); 
    }
}

function abrirModalEdicaoOrcamento(id) {
    const orc = orcamentos.find(o => o.id === id);
    if (!orc) return;

    document.getElementById('edit-orcamento-id').value = orc.id;
    document.getElementById('edit-orcamento-modal-title').textContent = `Editar Orçamento Nº ${orc.id}`;
    
    carregarClientesNoSelect('edit-orcamento-cliente');
    document.getElementById('edit-orcamento-cliente').value = orc.clienteId;
    document.getElementById('edit-orcamento-servicos').value = orc.servicos || '';
    document.getElementById('edit-orcamento-mao-de-obra').value = orc.maoDeObra > 0 ? orc.maoDeObra.toFixed(2) : '';
    document.getElementById('edit-orcamento-relatorio').value = orc.relatorio || '';
    document.getElementById('edit-orcamento-formas-pagamento').value = orc.formasPagamento || '';

    renderizarItensOrcamentoModalEdicao(orc);
    document.getElementById('editOrcamentoModal').classList.add('active');
}

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

function calcularTotaisOrcamentoModalEdicao(orc) {
    const maoDeObra = parseFloat(document.getElementById('edit-orcamento-mao-de-obra').value) || 0;
    const totalProdutos = orc.itens.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
    const totalGeral = totalProdutos + maoDeObra;
    document.getElementById('edit-total-produtos').textContent = formatarMoeda(totalProdutos);
    document.getElementById('edit-total-geral').textContent = formatarMoeda(totalGeral);
}

function salvarAlteracoesOrcamentoPeloModal() {
    const orcamentoId = document.getElementById('edit-orcamento-id').value;
    const orcIndex = orcamentos.findIndex(o => o.id === orcamentoId);

    if (orcIndex === -1) return;

    orcamentos[orcIndex].clienteId = document.getElementById('edit-orcamento-cliente').value;
    orcamentos[orcIndex].servicos = document.getElementById('edit-orcamento-servicos').value;
    orcamentos[orcIndex].maoDeObra = parseFloat(document.getElementById('edit-orcamento-mao-de-obra').value) || 0;
    orcamentos[orcIndex].relatorio = document.getElementById('edit-orcamento-relatorio').value;
    orcamentos[orcIndex].formasPagamento = document.getElementById('edit-orcamento-formas-pagamento').value;
    
    if(confirm("Gostaria de atualizar a data de emissão para hoje?")) {
        orcamentos[orcIndex].data = new Date().toISOString();
    }
    
    saveData();
    renderizarOrcamentosSalvos();
    closeModal('editOrcamentoModal');
    alert('Orçamento atualizado!');
}

function iniciarExclusaoOrcamento(id) {
    const modal = document.getElementById('swipe-confirm-modal');
    delete modal.dataset.clienteId;
    modal.dataset.orcamentoId = id;
    modal.classList.add('active');
}

function excluirOrcamentoSalvo(id) {
    orcamentos = orcamentos.filter(o => o.id !== id);
    saveData();
    renderizarOrcamentosSalvos();
    if (currentOrcamento.id === id) { novoOrcamento(); }
    alert('Orçamento excluído!');
}

// =======================================================
// ========= SWIPE, MODAIS e DIVERSOS ====================
// =======================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function openItemModal(itemIndex = -1, source = 'current') {
    const modal = document.getElementById('itemModal');
    modal.dataset.source = source;
    document.getElementById('item-form').reset();
    isEditingItem = itemIndex > -1;
    editingItemIndex = itemIndex;

    const deleteBtn = document.getElementById('delete-item-btn');
    carregarCategoriasNoModalItem();

    let orcamentoDeOrigem = source === 'current' ? currentOrcamento : orcamentos.find(o => o.id === document.getElementById('edit-orcamento-id').value);

    if (isEditingItem && orcamentoDeOrigem && orcamentoDeOrigem.itens[itemIndex]) {
        const item = orcamentoDeOrigem.itens[itemIndex];
        const produto = produtos.find(p => p.id === item.produtoId);
        document.getElementById('modal-item-categoria').value = produto ? (produto.categoria || 'Geral') : '';
        carregarProdutosNoModalPorCategoria();
        document.getElementById('modal-produto').value = item.produtoId;
        document.getElementById('modal-quantidade').value = item.quantidade;
        document.getElementById('modal-valor').value = item.valor.toFixed(2);
        deleteBtn.style.display = 'inline-block';
    } else {
        carregarProdutosNoModalPorCategoria();
        deleteBtn.style.display = 'none';
    }
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.remove('active');
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
        select.innerHTML += `<option value="${p.id}" data-valor="${p.valor}">${p.nomeProposta} (R$ ${p.valor.toFixed(2)})</option>`;
    });
}

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

    const onDragStart = (e) => {
        e.preventDefault();
        isDragging = true;
        handle.style.transition = 'none';
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const rect = container.getBoundingClientRect();
        let newLeft = clientX - rect.left - (handle.offsetWidth / 2);
        if (newLeft < 0) newLeft = 0;
        const maxLeft = container.offsetWidth - handle.offsetWidth;
        if (newLeft > maxLeft) newLeft = maxLeft;
        handle.style.left = `${newLeft}px`;
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        const maxLeft = container.offsetWidth - handle.offsetWidth;
        const currentLeft = parseInt(handle.style.left, 10);

        if (currentLeft >= maxLeft * 0.9) {
            handle.style.left = `${maxLeft}px`;
            container.classList.add('confirmed');
            setTimeout(() => {
                if (modal.dataset.orcamentoId) excluirOrcamentoSalvo(modal.dataset.orcamentoId);
                else if (modal.dataset.clienteId) excluirCliente(modal.dataset.clienteId);
                closeModal('swipe-confirm-modal');
                resetSwipe();
            }, 300);
        } else {
            resetSwipe();
        }
    };

    handle.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    handle.addEventListener('touchstart', onDragStart);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
    cancelBtn.addEventListener('click', () => { closeModal('swipe-confirm-modal'); resetSwipe(); });
}

// =======================================================
// ========= GESTÃO DE CONTRATOS =========================
// =======================================================

function openNovoContratoModal(contratoId = null) {
    const form = document.getElementById('novo-contrato-form');
    form.reset();
    document.getElementById('contrato-id').value = '';
    
    // Carrega clientes
    const select = document.getElementById('contrato-cliente');
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    clientes.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });

    if (contratoId) {
        const contrato = contratos.find(c => c.id === contratoId);
        if (contrato) {
            document.getElementById('contrato-id').value = contrato.id;
            select.value = contrato.clienteId;
            document.getElementById('contrato-descricao').value = contrato.descricao;
            document.getElementById('contrato-valor').value = contrato.valor;
            document.getElementById('contrato-dia-vencimento').value = contrato.diaVencimento;
            document.getElementById('contrato-mes-reajuste').value = contrato.mesReajuste;
            document.getElementById('contrato-ativo').checked = contrato.ativo;
            document.querySelector('#novoContratoModal h3').textContent = 'Editar Contrato';
        }
    } else {
        document.querySelector('#novoContratoModal h3').textContent = 'Novo Contrato';
    }
    openModal('novoContratoModal');
}

function salvarContrato() {
    const id = document.getElementById('contrato-id').value;
    const clienteId = document.getElementById('contrato-cliente').value;
    const descricao = document.getElementById('contrato-descricao').value;
    const valor = parseFloat(document.getElementById('contrato-valor').value);
    const diaVencimento = parseInt(document.getElementById('contrato-dia-vencimento').value);
    const mesReajuste = parseInt(document.getElementById('contrato-mes-reajuste').value);
    const ativo = document.getElementById('contrato-ativo').checked;

    if (!clienteId || !descricao || isNaN(valor) || isNaN(diaVencimento)) {
        alert('Preencha todos os campos obrigatórios.');
        return;
    }

    const contratoData = {
        id: id || generateAlphanumericUniqueId(),
        clienteId,
        descricao,
        valor,
        diaVencimento,
        mesReajuste,
        ativo,
        dataCriacao: id ? (contratos.find(c => c.id === id).dataCriacao) : new Date().toISOString()
    };

    if (id) {
        const index = contratos.findIndex(c => c.id === id);
        if (index !== -1) contratos[index] = contratoData;
    } else {
        contratos.push(contratoData);
    }

    saveData();
    renderizarContratos();
    verificarAlertasReajuste();
    closeModal('novoContratoModal');
    alert('Contrato salvo com sucesso!');
}

function renderizarContratos() {
    const tbody = document.querySelector('#contratos-tabela tbody');
    tbody.innerHTML = '';

    if (contratos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum contrato cadastrado.</td></tr>';
        return;
    }

    contratos.forEach(c => {
        const cliente = clientes.find(cli => cli.id === c.clienteId);
        const nomeCliente = cliente ? cliente.nome : 'Cliente Removido';
        const nomesMeses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        
        tbody.innerHTML += `
            <tr style="opacity: ${c.ativo ? 1 : 0.6}">
                <td>${nomeCliente}</td>
                <td>${c.descricao}</td>
                <td>${formatarMoeda(c.valor)}</td>
                <td>Dia ${c.diaVencimento}</td>
                <td>${nomesMeses[c.mesReajuste]}</td>
                <td>${c.ativo ? '<span class="status-badge status-pago">Ativo</span>' : '<span class="status-badge status-pendente">Inativo</span>'}</td>
                <td>
                    <button class="btn-editar btn-sm" onclick="openNovoContratoModal('${c.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-excluir btn-sm" onclick="excluirContrato('${c.id}')"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
    });
}

function excluirContrato(id) {
    if(confirm("Deseja excluir este contrato?")) {
        contratos = contratos.filter(c => c.id !== id);
        saveData();
        renderizarContratos();
        verificarAlertasReajuste();
    }
}

function verificarAlertasReajuste() {
    const container = document.getElementById('alertas-reajuste-container');
    container.innerHTML = '';
    const mesAtual = new Date().getMonth() + 1; // 1-12

    const contratosReajuste = contratos.filter(c => c.ativo && c.mesReajuste === mesAtual);

    if (contratosReajuste.length > 0) {
        container.style.display = 'block';
        contratosReajuste.forEach(c => {
            const cliente = clientes.find(cli => cli.id === c.clienteId);
            container.innerHTML += `
                <div class="alert-box">
                    <i class="fas fa-exclamation-circle"></i>
                    <div>
                        <strong>Atenção Reajuste!</strong><br>
                        O contrato de <strong>${cliente ? cliente.nome : 'Cliente'}</strong> deve ser reajustado este mês.
                    </div>
                </div>
            `;
        });
    } else {
        container.style.display = 'none';
    }
}

function exportarContratosPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(0, 51, 102);
    doc.text("RELATÓRIO DE CONTRATOS - GRUPO HENRI SISTEMAS", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

    const tableColumn = ["Cliente", "Descrição", "Valor", "Vencimento", "Reajuste", "Status"];
    const tableRows = [];

    contratos.forEach(c => {
        const cliente = clientes.find(cli => cli.id === c.clienteId);
        const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const rowData = [
            cliente ? cliente.nome : 'N/A',
            c.descricao,
            formatarMoeda(c.valor),
            `Dia ${c.diaVencimento}`,
            nomesMeses[c.mesReajuste],
            c.ativo ? 'Ativo' : 'Inativo'
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 51, 102] }
    });

    doc.save('Relatorio_Contratos.pdf');
}

// =======================================================
// ========= GESTÃO FINANCEIRA ===========================
// =======================================================

function preencherSelectsDataFinanceiro() {
    const selectMes = document.getElementById('financeiro-mes');
    const selectAno = document.getElementById('financeiro-ano');
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    meses.forEach((m, index) => {
        selectMes.innerHTML += `<option value="${index}" ${index === currentFinanceiroDate.getMonth() ? 'selected' : ''}>${m}</option>`;
    });

    const anoAtual = new Date().getFullYear();
    for(let i = anoAtual - 2; i <= anoAtual + 2; i++) {
        selectAno.innerHTML += `<option value="${i}" ${i === anoAtual ? 'selected' : ''}>${i}</option>`;
    }
}

function openNovaTransacaoModal(tipo, transacaoId = null) {
    const form = document.getElementById('nova-transacao-form');
    form.reset();
    document.getElementById('transacao-id').value = '';
    document.getElementById('transacao-tipo').value = tipo;
    
    const titulo = document.getElementById('modal-transacao-titulo');
    const selectCategoria = document.getElementById('transacao-categoria');
    const selectContrato = document.getElementById('transacao-contrato-id');
    const groupContrato = document.getElementById('group-contrato-select');
    const groupRecorrente = document.getElementById('group-recorrente');
    const selectConta = document.getElementById('transacao-conta'); // Select de Conta
    
    titulo.textContent = tipo === 'receita' ? 'Nova Receita (Entrada)' : 'Nova Despesa (Saída)';
    
    // Categorias Dinâmicas e Restrição de Caixa
    selectCategoria.innerHTML = '';
    
    // Reseta as opções de conta
    selectConta.innerHTML = `
        <option value="pj">Pessoa Jurídica (PJ)</option>
        <option value="pf">Pessoa Física (PF)</option>
        <option value="caixa">Caixa Empresa</option>
    `;

    if (tipo === 'receita') {
        selectCategoria.innerHTML = `
            <option value="contrato">Contrato (Mensalidade)</option>
            <option value="venda">Venda Avulsa</option>
            <option value="instalacao">Instalação</option>
            <option value="outros">Outros</option>
        `;
        selectContrato.innerHTML = '<option value="">Selecione...</option>';
        contratos.filter(c => c.ativo).forEach(c => {
            const cli = clientes.find(cl => cl.id === c.clienteId);
            selectContrato.innerHTML += `<option value="${c.id}">${cli ? cli.nome : 'N/A'} - ${c.descricao}</option>`;
        });
        groupRecorrente.style.display = 'none';
        
        // REGRA DE NEGÓCIO: Não permite entrada direta no Caixa
        // Remove a opção 'caixa' se for Receita
        const opCaixa = selectConta.querySelector('option[value="caixa"]');
        if (opCaixa) opCaixa.remove();

    } else {
        selectCategoria.innerHTML = `
            <option value="fornecedor">Boleto Fornecedor</option>
            <option value="despesa_empresa">Despesa Empresa (Geral)</option>
            <option value="fixa_pf">Despesa Fixa PF</option>
            <option value="variavel_pf">Despesa Variável PF</option>
        `;
        groupContrato.style.display = 'none';
        groupRecorrente.style.display = 'block';
    }

    document.getElementById('transacao-data').value = new Date().toISOString().split('T')[0];

    // Edição
    if (transacaoId) {
        const t = transacoes.find(x => x.id === transacaoId);
        if (t) {
            document.getElementById('transacao-id').value = t.id;
            document.getElementById('transacao-tipo').value = t.tipo;
            selectCategoria.value = t.categoria;
            document.getElementById('transacao-descricao').value = t.descricao;
            document.getElementById('transacao-valor').value = t.valor;
            document.getElementById('transacao-data').value = t.data;
            
            // Se for edição e tiver caixa (pode ser uma transação antiga), recoloca a opção
            if (t.conta === 'caixa' && tipo === 'receita') {
                 selectConta.innerHTML += '<option value="caixa">Caixa Empresa</option>';
            }
            selectConta.value = t.conta;
            
            document.getElementById('transacao-status').value = t.status;
            if(t.contratoId) {
                selectContrato.value = t.contratoId;
                groupContrato.style.display = 'block';
            }
            if(t.recorrente) document.getElementById('transacao-recorrente').checked = true;
        }
    } else {
        selectCategoria.dispatchEvent(new Event('change'));
    }

    openModal('novaTransacaoModal');
}

function salvarTransacao() {
    const id = document.getElementById('transacao-id').value;
    const tipo = document.getElementById('transacao-tipo').value;
    const categoria = document.getElementById('transacao-categoria').value;
    const contratoId = (tipo === 'receita' && categoria === 'contrato') ? document.getElementById('transacao-contrato-id').value : null;
    const descricao = document.getElementById('transacao-descricao').value;
    const valor = parseFloat(document.getElementById('transacao-valor').value);
    const data = document.getElementById('transacao-data').value;
    const conta = document.getElementById('transacao-conta').value;
    const status = document.getElementById('transacao-status').value;
    const recorrente = (tipo === 'despesa') ? document.getElementById('transacao-recorrente').checked : false;

    if (!descricao || isNaN(valor) || !data) {
        alert('Preencha os campos obrigatórios.');
        return;
    }

    const transacaoData = {
        id: id || generateAlphanumericUniqueId(),
        tipo,
        categoria,
        contratoId,
        descricao,
        valor,
        data,
        conta, // pj, pf, caixa
        status, // pendente, pago
        recorrente,
        originalRecorrenteId: null
    };

    if (id) {
        const index = transacoes.findIndex(t => t.id === id);
        if (index !== -1) transacoes[index] = { ...transacoes[index], ...transacaoData };
    } else {
        transacoes.push(transacaoData);
    }

    saveData();
    atualizarDashboardFinanceiro();
    closeModal('novaTransacaoModal');
}

// NOVA FUNÇÃO: SALVAR TRANSFERÊNCIA
function salvarTransferencia() {
    const origem = document.getElementById('transf-origem').value;
    const destino = document.getElementById('transf-destino').value;
    const valor = parseFloat(document.getElementById('transf-valor').value);
    const data = document.getElementById('transf-data').value;
    const obs = document.getElementById('transf-obs').value.trim();

    if (isNaN(valor) || valor <= 0) {
        alert("O valor da transferência deve ser maior que zero.");
        return;
    }
    if (origem === destino) {
        alert("A conta de origem e destino não podem ser iguais.");
        return;
    }
    if (!data) {
        alert("Selecione uma data.");
        return;
    }

    // Nomes legíveis para descrição
    const nomesContas = {
        'pj': 'PJ',
        'pf': 'PF',
        'caixa': 'Caixa'
    };

    // Cria transação de SAÍDA (Despesa) na Origem
    const saida = {
        id: generateAlphanumericUniqueId(),
        tipo: 'despesa',
        categoria: 'transferencia_saida',
        descricao: `TRF Enviada para ${nomesContas[destino]} ${obs ? '('+obs+')' : ''}`,
        valor: valor,
        data: data,
        conta: origem,
        status: 'pago', // Transferências internas geralmente são imediatas
        recorrente: false
    };

    // Cria transação de ENTRADA (Receita) no Destino
    const entrada = {
        id: generateAlphanumericUniqueId(),
        tipo: 'receita',
        categoria: 'transferencia_entrada',
        descricao: `TRF Recebida de ${nomesContas[origem]} ${obs ? '('+obs+')' : ''}`,
        valor: valor,
        data: data,
        conta: destino,
        status: 'pago',
        recorrente: false
    };

    // Salva ambas
    transacoes.push(saida);
    transacoes.push(entrada);

    saveData();
    atualizarDashboardFinanceiro();
    closeModal('novaTransferenciaModal');
    alert('Transferência realizada com sucesso!');
}

function gerarDespesasRecorrentesAutomaticas() {
    const recorrentes = transacoes.filter(t => t.recorrente && t.tipo === 'despesa');
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    let mudancas = false;

    recorrentes.forEach(origem => {
        const jaExisteEsteMes = transacoes.some(t => {
            if (!t.data) return false;
            const tDate = new Date(t.data);
            return t.descricao === origem.descricao && t.valor === origem.valor && tDate.getMonth() === mesAtual && tDate.getFullYear() === anoAtual;
        });

        if (!jaExisteEsteMes) {
            const diaOriginal = new Date(origem.data).getDate();
            const novaData = new Date(anoAtual, mesAtual, diaOriginal);
            
            const novaTransacao = {
                ...origem,
                id: generateAlphanumericUniqueId(),
                data: novaData.toISOString().split('T')[0],
                status: 'pendente',
                originalRecorrenteId: origem.id
            };
            transacoes.push(novaTransacao);
            mudancas = true;
        }
    });

    if (mudancas) saveData();
}

function atualizarDashboardFinanceiro() {
    const mesSelecionado = parseInt(document.getElementById('financeiro-mes').value);
    const anoSelecionado = parseInt(document.getElementById('financeiro-ano').value);
    
    const transacoesMes = transacoes.filter(t => {
        const d = new Date(t.data + 'T12:00:00');
        return d.getMonth() === mesSelecionado && d.getFullYear() === anoSelecionado;
    });

    const entradasPJ = transacoesMes.filter(t => t.conta === 'pj' && t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
    const saidasPJ = transacoesMes.filter(t => t.conta === 'pj' && t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
    
    const entradasPF = transacoesMes.filter(t => t.conta === 'pf' && t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
    const saidasPF = transacoesMes.filter(t => t.conta === 'pf' && t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);

    const entradasCaixa = transacoesMes.filter(t => t.conta === 'caixa' && t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
    const saidasCaixa = transacoesMes.filter(t => t.conta === 'caixa' && t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);

    const totalReceitas = transacoesMes.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
    const totalDespesas = transacoesMes.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
    const saldoGeral = totalReceitas - totalDespesas;

    document.getElementById('dashboard-total-pj').textContent = formatarMoeda(entradasPJ - saidasPJ);
    document.getElementById('dashboard-total-pf').textContent = formatarMoeda(entradasPF - saidasPF);
    document.getElementById('dashboard-caixa-empresa').textContent = formatarMoeda(entradasCaixa - saidasCaixa);
    
    const elSaldo = document.getElementById('dashboard-saldo-geral');
    elSaldo.textContent = formatarMoeda(saldoGeral);
    elSaldo.style.color = saldoGeral >= 0 ? '#2ecc71' : '#e74c3c';

    renderizarTabelaTransacoes(transacoesMes);
    renderizarGraficoFinanceiro(transacoesMes);
    renderizarCalendarioFinanceiro(transacoesMes, mesSelecionado, anoSelecionado);
}

function renderizarTabelaTransacoes(lista) {
    const tbody = document.querySelector('#transacoes-tabela tbody');
    tbody.innerHTML = '';
    
    lista.sort((a, b) => new Date(a.data) - new Date(b.data));

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma movimentação neste mês.</td></tr>';
        return;
    }

    lista.forEach(t => {
        const dataFmt = new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR');
        const sinal = t.tipo === 'receita' ? '+' : '-';
        
        let acoesHtml = `
            <button class="btn-editar btn-sm" onclick="openNovaTransacaoModal('${t.tipo}', '${t.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-excluir btn-sm" onclick="excluirTransacao('${t.id}')"><i class="fas fa-trash-alt"></i></button>
        `;

        if (t.status === 'pendente') {
            acoesHtml = `<button class="btn-secondary btn-sm" onclick="confirmarTransacao('${t.id}')" title="Confirmar"><i class="fas fa-check"></i></button>` + acoesHtml;
        }

        tbody.innerHTML += `
            <tr style="border-left: 5px solid ${t.tipo === 'receita' ? '#2ecc71' : '#e74c3c'}">
                <td>${dataFmt}</td>
                <td>${t.tipo.toUpperCase()}</td>
                <td>${t.categoria}</td>
                <td>${t.descricao}</td>
                <td style="color: ${t.tipo === 'receita' ? '#2ecc71' : '#e74c3c'}"><strong>${sinal} ${formatarMoeda(t.valor)}</strong></td>
                <td>${t.conta.toUpperCase()}</td>
                <td><span class="status-badge status-${t.status}">${t.status}</span></td>
                <td>${acoesHtml}</td>
            </tr>
        `;
    });
}

function confirmarTransacao(id) {
    const t = transacoes.find(x => x.id === id);
    if(t) {
        t.status = 'pago';
        saveData();
        atualizarDashboardFinanceiro();
    }
}

function excluirTransacao(id) {
    if(confirm('Excluir esta transação?')) {
        transacoes = transacoes.filter(t => t.id !== id);
        saveData();
        atualizarDashboardFinanceiro();
    }
}

function renderizarGraficoFinanceiro(lista) {
    const ctx = document.getElementById('financeiroChart').getContext('2d');
    
    const receitas = lista.filter(t => t.tipo === 'receita');
    const despesas = lista.filter(t => t.tipo === 'despesa');

    const totalReceitas = receitas.reduce((sum, t) => sum + t.valor, 0);
    const totalDespesasEmpresa = despesas.filter(t => t.conta !== 'pf').reduce((sum, t) => sum + t.valor, 0);
    const totalDespesasPF = despesas.filter(t => t.conta === 'pf').reduce((sum, t) => sum + t.valor, 0);

    if (financeiroChartInstance) { financeiroChartInstance.destroy(); }

    financeiroChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Entradas (Receita)', 'Saídas (Empresa)', 'Saídas (Pessoal)'],
            datasets: [{
                label: 'Fluxo Financeiro',
                data: [totalReceitas, totalDespesasEmpresa, totalDespesasPF],
                backgroundColor: ['rgba(46, 204, 113, 0.6)', 'rgba(231, 76, 60, 0.6)', 'rgba(156, 39, 176, 0.6)'],
                borderColor: ['rgba(46, 204, 113, 1)', 'rgba(231, 76, 60, 1)', 'rgba(156, 39, 176, 1)'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#e0e0e0' } },
                x: { grid: { display: false }, ticks: { color: '#e0e0e0' } }
            },
            plugins: { legend: { labels: { color: '#e0e0e0' } } }
        }
    });
}

function renderizarCalendarioFinanceiro(lista, mes, ano) {
    const container = document.getElementById('fin-calendar-days');
    container.innerHTML = '';
    const daysInMonth = new Date(ano, mes + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'fin-day-item';
        div.textContent = day;
        
        const despesasDia = lista.filter(t => {
            const d = new Date(t.data + 'T12:00:00');
            return t.tipo === 'despesa' && d.getDate() === day;
        });

        if (despesasDia.length > 0) {
            div.classList.add('has-event');
            const temEmpresa = despesasDia.some(t => t.conta !== 'pf');
            const temPF = despesasDia.some(t => t.conta === 'pf');
            const dotsDiv = document.createElement('div');
            dotsDiv.style.marginTop = '5px';
            if (temEmpresa) dotsDiv.innerHTML += '<span class="dot red"></span>';
            if (temPF) dotsDiv.innerHTML += '<span class="dot yellow"></span>';
            div.appendChild(dotsDiv);
            div.title = `Total dia: ${formatarMoeda(despesasDia.reduce((s,t)=>s+t.valor,0))}`;
        }
        container.appendChild(div);
    }
}

// =======================================================
// ========= GERAR RELATÓRIO FINANCEIRO (PDF) ============
// =======================================================

async function exportarRelatorioFinanceiroPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const mesIdx = document.getElementById('financeiro-mes').value;
    const mesNome = document.getElementById('financeiro-mes').options[document.getElementById('financeiro-mes').selectedIndex].text;
    const ano = document.getElementById('financeiro-ano').value;

    const transacoesFiltradas = transacoes.filter(t => {
        const d = new Date(t.data + 'T12:00:00');
        return d.getMonth() == mesIdx && d.getFullYear() == ano;
    }).sort((a,b) => new Date(a.data) - new Date(b.data));

    // 1. Calcular Dados para Gráficos
    // Entradas
    const entPJ = transacoesFiltradas.filter(t => t.tipo === 'receita' && t.conta === 'pj').reduce((s, t) => s + t.valor, 0);
    const entPF = transacoesFiltradas.filter(t => t.tipo === 'receita' && t.conta === 'pf').reduce((s, t) => s + t.valor, 0);
    const entCaixa = transacoesFiltradas.filter(t => t.tipo === 'receita' && t.conta === 'caixa').reduce((s, t) => s + t.valor, 0);
    
    // Saídas (Categorias)
    const despCats = {};
    transacoesFiltradas.filter(t => t.tipo === 'despesa').forEach(t => {
        let label = t.categoria;
        if(label === 'fornecedor') label = 'Fornecedor';
        else if(label === 'despesa_empresa') label = 'Desp. Empresa';
        else if(label === 'fixa_pf') label = 'Fixa PF';
        else if(label === 'variavel_pf') label = 'Var. PF';
        else if(label === 'transferencia_saida') label = 'Transf. Env.';
        
        if(!despCats[label]) despCats[label] = 0;
        despCats[label] += t.valor;
    });

    // 2. Gerar Imagens dos Gráficos (Invisíveis)
    const chartImg1 = await generateChartImage(
        [entPJ, entPF, entCaixa], 
        ['PJ', 'PF', 'Caixa Emp.'], 
        ['#0088cc', '#9c27b0', '#ffd700'], 
        'doughnut', 
        'Entradas por Conta'
    );
    
    const chartImg2 = await generateChartImage(
        Object.values(despCats), 
        Object.keys(despCats), 
        ['#e74c3c', '#c0392b', '#d35400', '#e67e22', '#7f8c8d'], 
        'bar', 
        'Saídas por Categoria'
    );

    // 3. Montar PDF
    doc.setFontSize(22);
    doc.setTextColor(0, 51, 102);
    doc.text(`RELATÓRIO FINANCEIRO - ${mesNome}/${ano}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`GRUPO HENRI SISTEMAS - Gerado em ${new Date().toLocaleDateString()}`, 14, 28);

    // Inserir Gráficos
    if(chartImg1) doc.addImage(chartImg1, 'PNG', 15, 35, 80, 80);
    if(chartImg2) doc.addImage(chartImg2, 'PNG', 105, 35, 90, 80);

    // Resumo Numérico
    const pj = document.getElementById('dashboard-total-pj').textContent;
    const pf = document.getElementById('dashboard-total-pf').textContent;
    const caixa = document.getElementById('dashboard-caixa-empresa').textContent;
    const saldo = document.getElementById('dashboard-saldo-geral').textContent;

    doc.autoTable({
        head: [['Resumo do Mês', 'Valor']],
        body: [['Saldo PJ', pj], ['Saldo PF', pf], ['Caixa Empresa', caixa], ['SALDO GERAL', saldo]],
        startY: 120, 
        theme: 'grid',
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        headStyles: { fillColor: [0, 51, 102] }
    });

    // Tabela Detalhada com Cores
    const rows = transacoesFiltradas.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.categoria,
        t.descricao,
        t.conta.toUpperCase(),
        (t.tipo === 'receita' ? '+ ' : '- ') + formatarMoeda(t.valor),
        t.tipo // Coluna oculta para controle de cor
    ]);

    doc.text("Detalhamento das Movimentações:", 14, doc.lastAutoTable.finalY + 10);
    
    doc.autoTable({
        head: [['Data', 'Categoria', 'Descrição', 'Conta', 'Valor']],
        body: rows.map(r => r.slice(0, 5)), // Remove coluna de tipo visualmente
        startY: doc.lastAutoTable.finalY + 15,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 51, 102] },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 4) {
                const tipo = rows[data.row.index][5];
                if (tipo === 'receita') {
                    data.cell.styles.textColor = [46, 204, 113]; // Verde
                } else {
                    data.cell.styles.textColor = [231, 76, 60]; // Vermelho
                }
            }
        }
    });

    doc.save(`Relatorio_Financeiro_${mesNome}_${ano}.pdf`);
}

// Função auxiliar para criar imagem de gráfico off-screen
function generateChartImage(dataArr, labelsArr, colorsArr, type, title) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        canvas.style.visibility = 'hidden';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const tempChart = new Chart(ctx, {
            type: type,
            data: {
                labels: labelsArr,
                datasets: [{
                    label: title,
                    data: dataArr,
                    backgroundColor: colorsArr,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: { display: true, position: 'bottom' },
                    title: { display: true, text: title }
                }
            }
        });

        setTimeout(() => {
            const imgData = canvas.toDataURL('image/png');
            tempChart.destroy();
            canvas.remove();
            resolve(imgData);
        }, 100);
    });
}