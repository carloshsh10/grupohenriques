// Variáveis globais
let clientes = [];
let produtos = [];
let orcamentos = [];
let boletos = []; // NOVA VARIÁVEL GLOBAL
let proximoOrcamentoId = 1;

let currentOrcamento = {
    id: generateSequentialId(true),
    clienteId: null,
    itens: [],
    maoDeObra: 0,
    relatorio: "",
    formasPagamento: "",
    servicos: "",
    faturamentoData: null
};
let isEditingItem = false;
let editingItemIndex = -1;

// Variáveis para o calendário de boletos
let currentCalendarDate = new Date();


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

    // Firebase Login/Logout
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('google-logout-btn').addEventListener('click', signOutGoogle);

    // Modal de edição de orçamento
    document.getElementById('close-edit-orcamento-modal').addEventListener('click', () => closeModal('editOrcamentoModal'));
    document.getElementById('save-orcamento-changes-btn').addEventListener('click', salvarAlteracoesOrcamentoPeloModal);
    document.getElementById('add-item-to-edited-orcamento-btn').addEventListener('click', () => openItemModal(-1, 'edit'));
    
    // Modal de confirmação de exclusão (swipe)
    configurarSwipeParaExcluir();

    // ========= NOVOS EVENT LISTENERS PARA BOLETOS =========
    document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));
    document.getElementById('boleto-cliente-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarBoleto('cliente');
    });
    document.getElementById('boleto-fornecedor-form').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarBoleto('fornecedor');
    });
    document.getElementById('alert-icon-container').addEventListener('click', openUpcomingBoletosModal);
    document.querySelector('#upcoming-boletos-modal .close-modal').addEventListener('click', () => closeModal('upcoming-boletos-modal'));
    document.querySelector('#day-details-modal .close-modal').addEventListener('click', () => closeModal('day-details-modal'));

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
        salvarNoLocalStorage('boletos', boletos); // SALVAR BOLETOS
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
            boletos: boletos, // SALVAR BOLETOS
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
            boletos = data.boletos || []; // CARREGAR BOLETOS
            proximoOrcamentoId = data.proximoOrcamentoId || 1;
            currentOrcamento = data.currentOrcamento || {
                id: generateSequentialId(true),
                clienteId: null,
                itens: [],
                maoDeObra: 0,
                relatorio: "",
                formasPagamento: "",
                servicos: "",
                faturamentoData: null
            };
            updateFirebaseStatus('Conectado', 'green');
        } else {
            updateFirebaseStatus('Nenhum dado na nuvem', 'blue');
            // Resetar todos os dados se não houver nada na nuvem
            clientes = [];
            produtos = [];
            orcamentos = [];
            boletos = [];
            proximoOrcamentoId = 1;
            currentOrcamento = {
                id: generateSequentialId(true),
                clienteId: null,
                itens: [],
                maoDeObra: 0,
                relatorio: "",
                formasPagamento: "",
                servicos: ""
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
    boletos = JSON.parse(localStorage.getItem('boletos')) || []; // CARREGAR BOLETOS
    proximoOrcamentoId = parseInt(localStorage.getItem('proximoOrcamentoId')) || 1;
    currentOrcamento = JSON.parse(localStorage.getItem('currentOrcamento')) || {
        id: generateSequentialId(true),
        clienteId: null,
        itens: [],
        maoDeObra: 0,
        relatorio: "",
        formasPagamento: "",
        servicos: "",
        faturamentoData: null
    };
    
    carregarDadosIniciais();
}

function saveData() {
    if (firebaseUser) {
        saveDataToFirestore();
    } else {
        salvarNoLocalStorage('clientes', clientes);
        salvarNoLocalStorage('produtos', produtos);
        salvarNoLocalStorage('orcamentos', orcamentos);
        salvarNoLocalStorage('boletos', boletos); // SALVAR BOLETOS
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
    renderCalendar(); // RENDERIZAR CALENDÁRIO
    checkForUpcomingBoletos(); // CHECAR ALERTAS
}

function showSection(sectionId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId + '-section').classList.add('active');

    if (sectionId === 'orcamentos') carregarClientesNoSelect('orcamento-cliente');
    if (sectionId === 'faturamento') carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
    if (sectionId === 'produtos') renderizarProdutosPorCategoria();
    if (sectionId === 'boletos') renderCalendar();
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
    alert(`Orçamento ${currentOrcamento.id} salvo com sucesso!`);
    return true;
}

function novoOrcamento() {
    currentOrcamento = {
        id: generateSequentialId(),
        clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null
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
        ul.innerHTML += `
            <li>
                <span>${cliente ? cliente.nome : 'Cliente Desconhecido'} - ${dataFmt} (Nº: ${orc.id})</span>
                <div>
                    <button class="btn-editar" onclick="abrirModalEdicaoOrcamento('${orc.id}')" title="Abrir/Editar"><i class="fas fa-folder-open"></i></button>
                    <button class="btn-excluir" onclick="iniciarExclusaoOrcamento('${orc.id}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                    <button class="btn-preview" onclick="previewOrcamento('${orc.id}')" title="Preview Proposta"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-faturamento ${orc.faturamentoData ? 'active' : ''}" onclick="visualizarFaturamento('${orc.id}')" title="Ver Faturamento"><i class="fas fa-file-invoice"></i></button>
                </div>
            </li>
        `;
    });
}

function abrirModalEdicaoOrcamento(id) {
    const orc = orcamentos.find(o => o.id === id);
    if (!orc) {
        alert('Orçamento não encontrado!');
        return;
    }

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

    if (orcIndex === -1) {
        alert('Erro: Orçamento não encontrado para salvar.');
        return;
    }

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


function iniciarExclusaoOrcamento(id) {
    const modal = document.getElementById('swipe-confirm-modal');
    modal.dataset.orcamentoId = id;
    modal.classList.add('active');
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

    const onDragStart = () => {
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

        if (currentLeft >= maxLeft * 0.9) {
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

    handle.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    handle.addEventListener('touchstart', onDragStart);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);

    cancelBtn.addEventListener('click', () => {
        closeModal('swipe-confirm-modal');
        resetSwipe();
    });
}

function excluirOrcamentoSalvo(id) {
    orcamentos = orcamentos.filter(o => o.id !== id);
    saveData();
    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados();
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

// =======================================================
// ========= INÍCIO DAS NOVAS FUNÇÕES PARA BOLETOS =========
// =======================================================

function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthYearDisplay = document.getElementById('month-year-display');
    const weekdaysContainer = document.getElementById('calendar-weekdays');

    calendarDays.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    monthYearDisplay.textContent = `${currentCalendarDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;
    
    // Renderiza os dias da semana
    weekdaysContainer.innerHTML = '';
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    weekdays.forEach(day => {
        weekdaysContainer.innerHTML += `<div>${day}</div>`;
    });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Preenche os dias vazios no início do mês
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.innerHTML += `<div class="calendar-day not-current-month"></div>`;
    }

    // Preenche os dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;
        const currentDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayDiv.dataset.date = currentDateString;

        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add('today');
        }

        // Adiciona pontos de evento
        const boletosOnDay = boletos.filter(b => b.vencimento === currentDateString && b.status === 'pendente');
        if (boletosOnDay.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'event-dots';
            if (boletosOnDay.some(b => b.type === 'fornecedor')) {
                dotsContainer.innerHTML += '<div class="event-dot red"></div>';
            }
            if (boletosOnDay.some(b => b.type === 'cliente')) {
                dotsContainer.innerHTML += '<div class="event-dot yellow"></div>';
            }
            dayDiv.appendChild(dotsContainer);
        }
        
        dayDiv.addEventListener('click', () => openDayDetailsModal(currentDateString));
        calendarDays.appendChild(dayDiv);
    }
}

function changeMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderCalendar();
}

function salvarBoleto(type) {
    const form = document.getElementById(`boleto-${type}-form`);
    const nome = form.querySelector(`#boleto-${type}-nome`).value.trim();
    const detalhes = form.querySelector(`#boleto-${type}-${type === 'cliente' ? 'servico' : 'material'}`).value.trim();
    const vencimento = form.querySelector(`#boleto-${type}-vencimento`).value;
    const valor = parseFloat(form.querySelector(`#boleto-${type}-valor`).value);
    const parcelas = parseInt(form.querySelector(`#boleto-${type}-parcelas`).value) || 1;

    if (!nome || !detalhes || !vencimento || isNaN(valor)) {
        alert('Preencha todos os campos obrigatórios corretamente.');
        return;
    }

    const originalId = generateAlphanumericUniqueId();
    let dataVencimento = new Date(vencimento + 'T12:00:00'); // Adiciona T12:00 para evitar problemas de fuso horário

    for (let i = 0; i < parcelas; i++) {
        const vencimentoFormatado = dataVencimento.toISOString().split('T')[0];
        
        const novoBoleto = {
            id: generateAlphanumericUniqueId(),
            originalId: originalId,
            type: type,
            nome: nome,
            detalhes: detalhes,
            valor: valor,
            vencimento: vencimentoFormatado,
            parcela: { atual: i + 1, total: parcelas },
            status: 'pendente' // 'pendente' ou 'pago'
        };
        boletos.push(novoBoleto);
        
        // Incrementa o mês para a próxima parcela
        dataVencimento.setMonth(dataVencimento.getMonth() + 1);
    }

    saveData();
    renderCalendar();
    checkForUpcomingBoletos();
    alert(`${parcelas} boleto(s) de ${type} adicionado(s) com sucesso!`);
    form.reset();
}


function checkForUpcomingBoletos() {
    const alertIcon = document.getElementById('alert-icon-container');
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

    const upcomingBoletos = boletos.filter(b => 
        b.status === 'pendente' && 
        b.vencimento >= todayStr && 
        b.vencimento <= sevenDaysLaterStr
    );

    if (upcomingBoletos.length > 0) {
        alertIcon.style.display = 'block';
    } else {
        alertIcon.style.display = 'none';
    }
}

function openUpcomingBoletosModal() {
    const modal = document.getElementById('upcoming-boletos-modal');
    const listContainer = document.getElementById('upcoming-boletos-list');
    listContainer.innerHTML = '';

    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

    // Popula a lista de compromissos para os próximos 7 dias
    const upcomingBoletos = boletos
        .filter(b => b.status === 'pendente' && b.vencimento >= todayStr && b.vencimento <= sevenDaysLaterStr)
        .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

    if (upcomingBoletos.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center;">Nenhum compromisso vencendo nos próximos 7 dias.</p>';
    } else {
        upcomingBoletos.forEach(boleto => {
            listContainer.innerHTML += createBoletoItemHTML(boleto);
        });
    }

    // Calcula os totais para o mês atual
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const boletosThisMonth = boletos.filter(b => {
        const vencimentoDate = new Date(b.vencimento + 'T12:00:00');
        return b.status === 'pendente' && vencimentoDate.getMonth() === currentMonth && vencimentoDate.getFullYear() === currentYear;
    });

    const countFornecedor = boletosThisMonth.filter(b => b.type === 'fornecedor').length;
    const countCliente = boletosThisMonth.filter(b => b.type === 'cliente').length;
    
    document.querySelector('.count-circle-red').textContent = countFornecedor;
    document.querySelector('.count-circle-yellow').textContent = countCliente;

    modal.classList.add('active');
}

function openDayDetailsModal(dateString) {
    const modal = document.getElementById('day-details-modal');
    const title = document.getElementById('day-details-title');
    const listContainer = document.getElementById('day-details-list');
    listContainer.innerHTML = '';

    const [year, month, day] = dateString.split('-');
    title.textContent = `Compromissos para ${day}/${month}/${year}`;

    const boletosOnDay = boletos.filter(b => b.vencimento === dateString);

    if (boletosOnDay.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center;">Nenhum compromisso para esta data.</p>';
    } else {
        boletosOnDay.forEach(boleto => {
             listContainer.innerHTML += createBoletoItemHTML(boleto, true); // Adiciona botões de ação
        });
    }

    modal.classList.add('active');
}

function createBoletoItemHTML(boleto, withActions = false) {
    const parcelaInfo = boleto.parcela.total > 1 ? ` (Parcela ${boleto.parcela.atual}/${boleto.parcela.total})` : '';
    const vencimentoFmt = new Date(boleto.vencimento + 'T12:00:00').toLocaleDateString('pt-BR');
    
    let actionsHTML = '';
    if (withActions) {
        actionsHTML = `<div class="boleto-actions">`;
        if (boleto.status === 'pendente') {
            actionsHTML += `<button class="btn-secondary btn-sm" onclick="marcarBoletoPago('${boleto.id}')"><i class="fas fa-check"></i> Marcar como Pago</button>`;
        }
        actionsHTML += `<button class="btn-danger btn-sm" onclick="excluirBoleto('${boleto.id}', ${boleto.parcela.total > 1})"><i class="fas fa-trash-alt"></i> Excluir</button>
        </div>`;
    }

    return `
        <div class="boleto-item ${boleto.type} ${boleto.status === 'pago' ? 'paid' : ''}">
            <p class="boleto-header">${boleto.nome}${parcelaInfo}</p>
            <p>${boleto.detalhes}</p>
            <p><strong>Vencimento:</strong> ${vencimentoFmt}</p>
            <p class="boleto-value"><strong>Valor:</strong> ${formatarMoeda(boleto.valor)}</p>
            ${actionsHTML}
        </div>
    `;
}

function marcarBoletoPago(id) {
    const boletoIndex = boletos.findIndex(b => b.id === id);
    if (boletoIndex > -1) {
        boletos[boletoIndex].status = 'pago';
        saveData();
        renderCalendar();
        checkForUpcomingBoletos();
        closeModal('day-details-modal');
        alert('Compromisso marcado como finalizado!');
    }
}

function excluirBoleto(id, isParcelado) {
    let confirmMessage = 'Tem certeza que deseja excluir este boleto?';
    if (isParcelado) {
        confirmMessage = 'Este boleto faz parte de um parcelamento. Deseja excluir apenas esta parcela ou todas as parcelas futuras?';
        const choice = prompt(confirmMessage + '\nDigite "ESTA" para excluir apenas esta ou "TODAS" para excluir esta e as futuras.');

        if (choice && choice.toUpperCase() === 'TODAS') {
            const boleto = boletos.find(b => b.id === id);
            if (boleto) {
                boletos = boletos.filter(b => b.originalId !== boleto.originalId || b.parcela.atual < boleto.parcela.atual);
            }
        } else if (choice && choice.toUpperCase() === 'ESTA') {
            boletos = boletos.filter(b => b.id !== id);
        } else {
            return; // Cancelar se a resposta não for válida
        }
    } else {
        if (!confirm(confirmMessage)) return;
        boletos = boletos.filter(b => b.id !== id);
    }

    saveData();
    renderCalendar();
    checkForUpcomingBoletos();
    closeModal('day-details-modal');
    alert('Boleto(s) excluído(s) com sucesso!');
}


// Funções de Modal
function openItemModal(itemIndex = -1, source = 'current') {
    const modal = document.getElementById('itemModal');
    modal.dataset.source = source;
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
        deleteBtn.style.display = 'inline-block';
    } else {
        carregarProdutosNoModalPorCategoria();
        modal.querySelector('h3').textContent = 'Adicionar Item';
        modal.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Item';
        deleteBtn.style.display = 'none';
    }
    modal.classList.add('active');
}


function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.classList.remove('active');
    }
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