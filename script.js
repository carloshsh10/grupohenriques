// =======================================================
// ========= VARIÁVEIS GLOBAIS ===========================
// =======================================================
let clientes = [];
let produtos = [];
let orcamentos = [];
let contratos = [];
let manutencoes = [];
// Banco de dados de serviços aprendidos
let bancoServicos = [
    "Teste de Bateria 12V",
    "Limpeza de Lentes e Câmeras",
    "Ajuste de Foco",
    "Verificação de Gravação (HD)",
    "Teste de Sensores de Alarme",
    "Verificação de Conectividade de Rede",
    "Reaperto de Conexões",
    "Teste de Sirene",
    "Troca de Conectores",
    "Configuração de Acesso Remoto"
];

let proximoOrcamentoId = 1;

// Objeto temporário para Orçamento
let currentOrcamento = {
    id: generateSequentialId(true),
    clienteId: null,
    itens: [],
    maoDeObra: 0,
    relatorio: "",
    formasPagamento: "",
    servicos: "",
};

// Objeto temporário para Relatório de Manutenção
let currentManutencao = {
    id: null,
    clienteId: "",
    data: "",
    hora: "",
    tipo: "Preventiva",
    itens: [] 
};

// Controles de Edição
let isEditingItem = false;
let editingItemIndex = -1;

// Variáveis de Controle do Firebase
let firebaseUser = null;
const firebaseStatusElement = document.getElementById('firebase-status');
const firebaseCloudStatusElement = document.getElementById('firebase-cloud-status');


// =======================================================
// ========= INICIALIZAÇÃO ===============================
// =======================================================
document.addEventListener('DOMContentLoaded', function() {
    configurarEventListeners();
    setupFirebaseAuthStateListener(); // Agora usa a versão compatível robusta
    solicitarPermissaoNotificacao(); 
    
    // Inicializar na aba Clientes
    showSection('clientes');
    
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

    // --- CLIENTES ---
    document.getElementById('cliente-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarENovoCliente();
    });
    document.querySelector('#cliente-details-modal .close-modal').addEventListener('click', () => closeModal('cliente-details-modal'));

    // --- PRODUTOS ---
    document.getElementById('produto-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarENovoProduto();
    });
    document.getElementById('close-produtos-categoria-modal').addEventListener('click', closeProdutosCategoriaModal);

    // --- ORÇAMENTOS ---
    document.getElementById('orcamento-form').addEventListener('input', salvarDadosOrcamento);
    document.getElementById('adicionar-item-btn').addEventListener('click', () => openItemModal(-1, 'current'));
    document.getElementById('gerar-pdf-btn').addEventListener('click', () => gerarPDF(false)); // PDF Orçamento
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
        } else if (!isEditingItem || (isEditingItem && !selectModalProduto.value)) {
            valorInput.value = '';
        }
    });

    // Modal Edição Orçamento
    document.getElementById('close-edit-orcamento-modal').addEventListener('click', () => closeModal('editOrcamentoModal'));
    document.getElementById('save-orcamento-changes-btn').addEventListener('click', salvarAlteracoesOrcamentoPeloModal);
    document.getElementById('add-item-to-edited-orcamento-btn').addEventListener('click', () => openItemModal(-1, 'edit'));

    // --- CONTRATOS ---
    document.getElementById('novo-contrato-btn').addEventListener('click', () => openNovoContratoModal());
    document.querySelector('#novoContratoModal .close-modal').addEventListener('click', () => closeModal('novoContratoModal'));
    document.getElementById('salvar-contrato-btn').addEventListener('click', salvarContrato);
    document.getElementById('exportar-contratos-pdf-btn').addEventListener('click', exportarContratosPDF);
    document.getElementById('ativar-notificacoes-btn').addEventListener('click', solicitarPermissaoNotificacao);

    // --- MANUTENÇÃO ---
    document.getElementById('adicionar-item-manutencao-btn').addEventListener('click', openItemManutencaoModal);
    document.querySelector('#itemManutencaoModal .close-modal').addEventListener('click', () => closeModal('itemManutencaoModal'));
    document.getElementById('salvar-item-manutencao-btn').addEventListener('click', adicionarItemManutencao);
    document.getElementById('salvar-novo-relatorio-btn').addEventListener('click', salvarRelatorioManutencao);
    document.getElementById('gerar-relatorio-pdf-btn').addEventListener('click', () => gerarRelatorioPDF(false));

    // Firebase Auth
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('google-logout-btn').addEventListener('click', signOutGoogle);

    // Swipe Delete
    configurarSwipeParaExcluir();
}

// =======================================================
// ========= FIREBASE & DATA HANDLING (CORRIGIDO) ========
// =======================================================

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            console.log("Logado com sucesso:", result.user);
        })
        .catch((error) => {
            console.error("Erro no login com Google: ", error);
            updateFirebaseStatus('Erro de Conexão', 'red');
            alert("Erro ao fazer login com Google: " + error.message);
        });
}

function signOutGoogle() {
    firebase.auth().signOut().then(() => {
        console.log("Desconectado com sucesso");
    }).catch((error) => {
        console.error("Erro no logout: ", error);
        alert("Erro ao fazer logout: " + error.message);
    });
}

function setupFirebaseAuthStateListener() {
    firebase.auth().onAuthStateChanged((user) => {
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
            loadDataFromFirestore();
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

function saveDataToFirestore() {
    if (!firebaseUser) {
        console.warn("Usuário não autenticado. Salvando apenas no Local Storage.");
        salvarLocalmenteTudo();
        return;
    }

    updateFirebaseStatus('Sincronizando...', 'orange');
    
    // Referência ao documento do usuário (versão compat/v8)
    const userDocRef = firebase.firestore().collection('users').doc(firebaseUser.uid);
    
    userDocRef.set({
        clientes: clientes,
        produtos: produtos,
        orcamentos: orcamentos,
        contratos: contratos,
        manutencoes: manutencoes,
        bancoServicos: bancoServicos, 
        proximoOrcamentoId: proximoOrcamentoId,
        currentOrcamento: currentOrcamento
    })
    .then(() => {
        updateFirebaseStatus('Conectado', 'green');
        salvarLocalmenteTudo(); // Backup local
    })
    .catch((error) => {
        console.error("Erro ao salvar dados no Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão', 'red');
        alert("Erro ao salvar dados no Firebase. Verifique sua conexão.");
    });
}

function salvarLocalmenteTudo() {
    salvarNoLocalStorage('clientes', clientes);
    salvarNoLocalStorage('produtos', produtos);
    salvarNoLocalStorage('orcamentos', orcamentos);
    salvarNoLocalStorage('contratos', contratos);
    salvarNoLocalStorage('manutencoes', manutencoes);
    salvarNoLocalStorage('bancoServicos', bancoServicos);
    salvarNoLocalStorage('proximoOrcamentoId', proximoOrcamentoId);
    salvarNoLocalStorage('currentOrcamento', currentOrcamento);
}

function loadDataFromFirestore() {
    if (!firebaseUser) {
        loadDataFromLocalStorage();
        return;
    }

    updateFirebaseStatus('Conectando...', 'orange');
    const userDocRef = firebase.firestore().collection('users').doc(firebaseUser.uid);

    userDocRef.get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            clientes = data.clientes || [];
            produtos = data.produtos || [];
            orcamentos = data.orcamentos || [];
            contratos = data.contratos || [];
            manutencoes = data.manutencoes || [];
            bancoServicos = data.bancoServicos || bancoServicos; 
            proximoOrcamentoId = data.proximoOrcamentoId || 1;
            currentOrcamento = data.currentOrcamento || { id: generateSequentialId(true), clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "" };
            updateFirebaseStatus('Conectado', 'green');
        } else {
            updateFirebaseStatus('Nenhum dado na nuvem', 'blue');
        }
        carregarDadosIniciais(); 
    }).catch((error) => {
        console.error("Erro ao carregar dados do Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão', 'red');
        loadDataFromLocalStorage(); 
    });
}

function salvarNoLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadDataFromLocalStorage() {
    clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    produtos = JSON.parse(localStorage.getItem('produtos')) || [];
    orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || [];
    contratos = JSON.parse(localStorage.getItem('contratos')) || [];
    manutencoes = JSON.parse(localStorage.getItem('manutencoes')) || [];
    
    const savedServicos = JSON.parse(localStorage.getItem('bancoServicos'));
    if (savedServicos && savedServicos.length > 0) {
        bancoServicos = savedServicos;
    }

    proximoOrcamentoId = parseInt(localStorage.getItem('proximoOrcamentoId')) || 1;
    currentOrcamento = JSON.parse(localStorage.getItem('currentOrcamento')) || {
        id: generateSequentialId(true),
        clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "",
    };
    
    carregarDadosIniciais();
}

function saveData() {
    if (firebaseUser) {
        saveDataToFirestore();
    } else {
        salvarLocalmenteTudo();
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
    carregarClientesNoSelect('manutencao-cliente');
    iniciarNovoRelatorioManutencao();
    renderizarRelatoriosSalvos();
    atualizarDatalistServicos(); 
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
    if (sectionId === 'manutencao') {
        carregarClientesNoSelect('manutencao-cliente');
        atualizarDatalistServicos();
    }
    if (sectionId === 'produtos') renderizarProdutosPorCategoria();
    
    if (sectionId === 'contratos') {
        renderizarContratos();
        verificarAlertasReajuste();
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
    carregarClientesNoSelect('manutencao-cliente');
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
    
    // Ordenar clientes alfabeticamente
    const clientesOrdenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome));
    
    clientesOrdenados.forEach(c => {
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
    
    // Carrega clientes (ordenados)
    const select = document.getElementById('contrato-cliente');
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    const clientesOrdenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome));
    clientesOrdenados.forEach(c => {
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

    // 1. Ordenação: Dia de Vencimento (Crescente) -> Nome do Cliente (A-Z)
    contratos.sort((a, b) => {
        if (a.diaVencimento !== b.diaVencimento) {
            return a.diaVencimento - b.diaVencimento;
        }
        const clienteA = clientes.find(c => c.id === a.clienteId);
        const clienteB = clientes.find(c => c.id === b.clienteId);
        const nomeA = clienteA ? clienteA.nome : "";
        const nomeB = clienteB ? clienteB.nome : "";
        return nomeA.localeCompare(nomeB);
    });

    contratos.forEach(c => {
        const cliente = clientes.find(cli => cli.id === c.clienteId);
        const nomeCliente = cliente ? cliente.nome : 'Cliente Removido';
        const nomesMeses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        
        tbody.innerHTML += `
            <tr style="opacity: ${c.ativo ? 1 : 0.6}">
                <td style="font-weight: bold; color: var(--cor-destaque-primaria);">Dia ${c.diaVencimento}</td>
                <td>${nomeCliente}</td>
                <td>${c.descricao}</td>
                <td>${formatarMoeda(c.valor)}</td>
                <td>${nomesMeses[c.mesReajuste]}</td>
                <td>${c.ativo ? '<span class="status-badge status-ativo">Ativo</span>' : '<span class="status-badge status-inativo">Inativo</span>'}</td>
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

// LÓGICA DE NOTIFICAÇÃO E ALERTAS
function solicitarPermissaoNotificacao() {
    if (!("Notification" in window)) {
        console.log("Este navegador não suporta notificações de desktop");
        return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                new Notification("Grupo Henri Sistemas", {
                    body: "Notificações ativadas! Você será avisado sobre reajustes de contratos.",
                    icon: "assets/icone.png"
                });
            }
        });
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
            const nomeCliente = cliente ? cliente.nome : 'Cliente';
            
            // Cria elemento visual
            container.innerHTML += `
                <div class="alert-box">
                    <i class="fas fa-bell"></i>
                    <div>
                        <strong>Atenção Reajuste!</strong><br>
                        O contrato de <strong>${nomeCliente}</strong> deve ser reajustado este mês.
                    </div>
                </div>
            `;
            
            // Envia notificação do sistema (Browser Notification)
            enviarNotificacaoReajuste(nomeCliente);
        });
    } else {
        container.style.display = 'none';
    }
}

function enviarNotificacaoReajuste(nomeCliente) {
    if (Notification.permission === "granted") {
        // Verifica se já notificamos hoje para não fazer spam (usando sessionStorage)
        const key = `notified_${nomeCliente}_${new Date().getMonth()}`;
        if (!sessionStorage.getItem(key)) {
            new Notification("Lembrete de Reajuste", {
                body: `O contrato de ${nomeCliente} precisa de reajuste este mês!`,
                icon: "assets/icone.png"
            });
            sessionStorage.setItem(key, "true");
        }
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

    const tableColumn = ["Dia Venc.", "Cliente", "Descrição", "Valor", "Reajuste", "Status"];
    const tableRows = [];

    // Usa a mesma ordenação da tela
    const contratosExport = [...contratos].sort((a, b) => {
        if (a.diaVencimento !== b.diaVencimento) return a.diaVencimento - b.diaVencimento;
        const cA = clientes.find(c => c.id === a.clienteId);
        const cB = clientes.find(c => c.id === b.clienteId);
        return (cA ? cA.nome : "").localeCompare(cB ? cB.nome : "");
    });

    contratosExport.forEach(c => {
        const cliente = clientes.find(cli => cli.id === c.clienteId);
        const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const rowData = [
            `Dia ${c.diaVencimento}`,
            cliente ? cliente.nome : 'N/A',
            c.descricao,
            formatarMoeda(c.valor),
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
// ========= RELATÓRIOS DE MANUTENÇÃO (COMPLETO) =========
// =======================================================

function iniciarNovoRelatorioManutencao() {
    // Reseta objeto temporário
    currentManutencao = {
        id: generateSequentialId(true) + "-MAN", // ID único com sufixo
        clienteId: "",
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        tipo: "Preventiva",
        itens: [] 
    };
    
    // Reseta formulário
    document.getElementById('manutencao-cliente').value = "";
    document.getElementById('manutencao-data').value = currentManutencao.data;
    document.getElementById('manutencao-hora').value = currentManutencao.hora;
    document.getElementById('manutencao-tipo').value = "Preventiva";
    
    renderizarItensManutencao();
}

function openItemManutencaoModal() {
    document.getElementById('item-manutencao-form').reset();
    openModal('itemManutencaoModal');
}

// --- FUNÇÃO DE AUTOCOMPLETAR ---
function atualizarDatalistServicos() {
    const datalist = document.getElementById('lista-sugestoes-servicos');
    if (!datalist) return;
    
    datalist.innerHTML = ''; // Limpa anterior
    // Ordena alfabeticamente para ficar bonito
    bancoServicos.sort();
    
    bancoServicos.forEach(servico => {
        const option = document.createElement('option');
        option.value = servico;
        datalist.appendChild(option);
    });
}

// --- FUNÇÃO ADICIONAR ITEM ---
function adicionarItemManutencao() {
    const descricaoInput = document.getElementById('manutencao-descricao-servico');
    const descricao = descricaoInput.value.trim(); // Remove espaços extras
    const status = document.getElementById('manutencao-status-servico').value;
    const obs = document.getElementById('manutencao-obs-extra').value;

    if(!descricao) {
        alert("Descreva o serviço ou teste realizado.");
        return;
    }

    // LÓGICA DE APRENDIZADO (BANCO DE DADOS)
    const existe = bancoServicos.some(s => s.toLowerCase() === descricao.toLowerCase());
    
    if (!existe) {
        // Adiciona ao banco de memória
        bancoServicos.push(descricao);
        // Atualiza a lista visual imediatamente
        atualizarDatalistServicos();
        // Salva essa nova memória no banco de dados (nuvem ou local)
        saveData(); 
    }

    const novoItem = {
        descricao: descricao,
        status: status,
        obs: obs
    };

    currentManutencao.itens.push(novoItem);
    renderizarItensManutencao();
    closeModal('itemManutencaoModal');
}

function renderizarItensManutencao() {
    const tbody = document.querySelector('#manutencao-itens-tabela tbody');
    tbody.innerHTML = '';

    if(currentManutencao.itens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum serviço adicionado ainda.</td></tr>';
        return;
    }

    currentManutencao.itens.forEach((item, index) => {
        // Define classe de cor baseada no status
        let statusClass = "";
        if(item.status.includes("OK")) statusClass = "status-ok";
        else if(item.status.includes("Defeito")) statusClass = "status-defeito";
        else if(item.status.includes("Reparado")) statusClass = "status-reparado";
        else if(item.status.includes("Substituído")) statusClass = "status-substituido";
        else statusClass = "status-pendente";

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.descricao}</strong></td>
                <td>
                    <span class="${statusClass}">${item.status}</span>
                    ${item.obs ? `<br><small style="color:#aaa;">${item.obs}</small>` : ''}
                </td>
                <td>
                     <button class="btn-excluir btn-sm" onclick="removerItemManutencao(${index})"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
    });
}

function removerItemManutencao(index) {
    currentManutencao.itens.splice(index, 1);
    renderizarItensManutencao();
}

function salvarDadosManutencaoFormulario() {
    // Captura dados atuais dos inputs para o objeto
    currentManutencao.clienteId = document.getElementById('manutencao-cliente').value;
    currentManutencao.data = document.getElementById('manutencao-data').value;
    currentManutencao.hora = document.getElementById('manutencao-hora').value;
    currentManutencao.tipo = document.getElementById('manutencao-tipo').value;
}

function salvarRelatorioManutencao() {
    salvarDadosManutencaoFormulario();

    if(!currentManutencao.clienteId) { alert("Selecione um cliente."); return; }
    if(currentManutencao.itens.length === 0) { alert("Adicione pelo menos um serviço/teste."); return; }

    // Salva na lista principal
    // Gera ID único se for novo
    if(!currentManutencao.id || currentManutencao.id.includes("undefined")) {
         currentManutencao.id = Date.now().toString(); 
    }

    // Verifica se já existe (edição) ou adiciona novo
    const index = manutencoes.findIndex(m => m.id === currentManutencao.id);
    if(index !== -1) {
        manutencoes[index] = {...currentManutencao};
    } else {
        manutencoes.push({...currentManutencao});
    }

    saveData();
    renderizarRelatoriosSalvos();
    
    if(confirm("Relatório salvo! Deseja iniciar um novo?")) {
        iniciarNovoRelatorioManutencao();
    }
}

function renderizarRelatoriosSalvos() {
    const ul = document.getElementById('lista-manutencoes');
    ul.innerHTML = '';
    
    // Ordena por data (mais recente primeiro)
    manutencoes.sort((a,b) => new Date(b.data) - new Date(a.data));

    manutencoes.forEach(m => {
        const cliente = clientes.find(c => c.id === m.clienteId);
        const dataFmt = new Date(m.data).toLocaleDateString('pt-BR');
        
        ul.innerHTML += `
            <li>
                <span>
                    <i class="fas fa-clipboard-list"></i> ${cliente ? cliente.nome : 'Cliente Desconhecido'} 
                    <small>(${m.tipo} - ${dataFmt})</small>
                </span>
                <div>
                    <button class="btn-editar" onclick="carregarRelatorioParaEdicao('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-preview" onclick="baixarPdfRelatorioSalvo('${m.id}')" title="PDF"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-excluir" onclick="excluirRelatorio('${m.id}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </div>
            </li>
        `;
    });
}

function carregarRelatorioParaEdicao(id) {
    const rel = manutencoes.find(m => m.id === id);
    if(rel) {
        currentManutencao = {...rel};
        // Preenche formulário
        document.getElementById('manutencao-cliente').value = currentManutencao.clienteId;
        document.getElementById('manutencao-data').value = currentManutencao.data;
        document.getElementById('manutencao-hora').value = currentManutencao.hora;
        document.getElementById('manutencao-tipo').value = currentManutencao.tipo;
        renderizarItensManutencao();
        // Rola para o topo
        document.getElementById('manutencao-section').scrollIntoView({behavior: 'smooth'});
    }
}

function baixarPdfRelatorioSalvo(id) {
    const rel = manutencoes.find(m => m.id === id);
    if(rel) {
        gerarRelatorioPDF(false, rel);
    }
}

function excluirRelatorio(id) {
    if(confirm("Excluir este relatório permanentemente?")) {
        manutencoes = manutencoes.filter(m => m.id !== id);
        saveData();
        renderizarRelatoriosSalvos();
    }
}