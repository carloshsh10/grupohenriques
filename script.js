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

    // Formulários com Salvamento Automático
    document.getElementById('cliente-form').addEventListener('input', salvarCliente);
    document.getElementById('cliente-form').addEventListener('submit', (e) => e.preventDefault()); // Prevenir envio padrão
    document.getElementById('produto-form').addEventListener('input', salvarProduto);
    document.getElementById('produto-form').addEventListener('submit', (e) => e.preventDefault());

    // Orçamento
    document.getElementById('orcamento-form').addEventListener('input', salvarDadosOrcamento);
    document.getElementById('adicionar-item-btn').addEventListener('click', openItemModal);
    document.getElementById('gerar-pdf-btn').addEventListener('click', () => gerarPDF(false));
    document.getElementById('salvar-orcamento-btn').addEventListener('click', salvarOrcamentoAtual);
    document.getElementById('novo-orcamento-btn').addEventListener('click', novoOrcamento);

    // Modal de Item do Orçamento
    document.getElementById('item-form').addEventListener('submit', adicionarOuEditarItemOrcamento);
    document.querySelector('#itemModal .close-modal').addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == document.getElementById('itemModal')) closeModal();
    });
    document.getElementById('modal-item-categoria').addEventListener('change', carregarProdutosNoModalPorCategoria);

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
    window.addEventListener('click', (event) => {
        if (event.target == document.getElementById('produtosCategoriaModal')) closeProdutosCategoriaModal();
    });

    // Faturamento
    document.getElementById('add-parcela-btn').addEventListener('click', adicionarParcela);
    document.getElementById('gerar-faturamento-pdf-btn').addEventListener('click', gerarEAnexarFaturamento);
    document.getElementById('faturamento-orcamento-vinculado').addEventListener('change', preencherClienteFaturamento);

    // Nota Fornecedor - Event Listeners atualizados
    document.getElementById('nfe-orcamento-vinculado').addEventListener('change', carregarChavesNFEParaOrcamentoSelecionado);

    // Event listener para os botões de salvar/editar/gerar NFE (delegado para o painel)
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

    // Backup
    document.getElementById('importar-backup-file').addEventListener('change', handleFileUpload);

    // Firebase Login/Logout
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('google-logout-btn').addEventListener('click', signOutGoogle);
}

// Funções Firebase
async function signInWithGoogle() {
    try {
        const provider = new window.GoogleAuthProvider();
        await window.signInWithPopup(window.firebaseAuth, provider);
        // onAuthStateChanged will handle the UI update and data loading
    } catch (error) {
        console.error("Erro no login com Google: ", error);
        updateFirebaseStatus('Erro de Conexão Firebase', 'red');
        alert("Erro ao fazer login com Google: " + error.message);
    }
}

async function signOutGoogle() {
    try {
        await window.signOut(window.firebaseAuth);
        // onAuthStateChanged will handle the UI update and data loading
    } catch (error) {
        console.error("Erro no logout: ", error);
        updateFirebaseStatus('Erro ao Desconectar', 'red');
        alert("Erro ao fazer logout: " + error.message);
    }
}

function setupFirebaseAuthStateListener() {
    window.onAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            firebaseUser = user;
            updateFirebaseStatus('Conectado', 'green');
            document.getElementById('google-login-btn').style.display = 'none';
            document.getElementById('google-logout-btn').style.display = 'inline-block';
            await loadDataFromFirestore();
        } else {
            firebaseUser = null;
            updateFirebaseStatus('Desconectado', 'gray');
            document.getElementById('google-login-btn').style.display = 'inline-block';
            document.getElementById('google-logout-btn').style.display = 'none';
            // Optionally clear data or load from local storage if not logged in
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

    updateFirebaseStatus('Conectando...', 'orange');
    try {
        const userDocRef = window.firebaseDb.collection('users').doc(firebaseUser.uid);
        await window.setDoc(userDocRef, {
            clientes: clientes,
            produtos: produtos,
            orcamentos: orcamentos,
            proximoOrcamentoId: proximoOrcamentoId,
            currentOrcamento: currentOrcamento
        });
        updateFirebaseStatus('Banco de Dados Salvo com Sucesso!', 'green');
    } catch (error) {
        console.error("Erro ao salvar dados no Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão Firebase', 'red');
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
        const userDocRef = window.firebaseDb.collection('users').doc(firebaseUser.uid);
        const docSnap = await window.getDoc(userDocRef);

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

            // Ensure nfeChaves are in the correct format for currentOrcamento
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

            // Also ensure for existing orcamentos
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


            updateFirebaseStatus('Dados Carregados do Firebase!', 'green');
        } else {
            updateFirebaseStatus('Nenhum dado no Firebase, começando com vazio.', 'blue');
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
                faturamentoData: null,
                nfeChaves: []
            };
        }
        carregarDadosIniciais(); // Renderiza a UI com os dados carregados
    } catch (error) {
        console.error("Erro ao carregar dados do Firestore: ", error);
        updateFirebaseStatus('Erro de Conexão Firebase', 'red');
        alert("Erro ao carregar dados do Firebase. Carregando dados locais. " + error.message);
        loadDataFromLocalStorage(); // Fallback to local storage
    }
}

function updateFirebaseStatus(message, color) {
    firebaseStatusElement.textContent = message;
    firebaseStatusElement.style.color = color;
}

// Funções de Local Storage (mantidas como fallback/backup)
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

    // Ensure nfeChaves is an array and converted for currentOrcamento from local storage
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

    // Also ensure for existing orcamentos from local storage
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

// Altera a função salvarNoLocalStorage para chamar saveDataToFirestore se logado
function saveData() {
    if (firebaseUser) {
        saveDataToFirestore();
    } else {
        salvarNoLocalStorage('clientes', clientes);
        salvarNoLocalStorage('produtos', produtos);
        salvarNoLocalStorage('orcamentos', orcamentos);
        salvarNoLocalStorage('proximoOrcamentoId', proximoOrcamentoId);
        salvarNoLocalStorage('currentOrcamento', currentOrcamento);
        updateFirebaseStatus('Salvo Localmente', 'blue');
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
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId + '-section').classList.add('active');

    // Carregar dados dinâmicos ao mostrar a seção correspondente
    if (sectionId === 'orcamentos') carregarClientesNoSelect('orcamento-cliente');
    if (sectionId === 'faturamento') carregarOrcamentosNoSelect('faturamento-orcamento-vinculado');
    if (sectionId === 'nota-fornecedor') {
        carregarOrcamentosNoSelect('nfe-orcamento-vinculado');
        carregarChavesNFEParaOrcamentoSelecionado(); // Carregar chaves NFE ao entrar na aba
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
        // Não salva no local storage diretamente, chama saveData()
        saveData(); 
    }
    return id.toString().padStart(4, '0');
}

function formatarMoeda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return 'R$ 0,00';
    return 'R$ ' + parseFloat(valor).toFixed(2).replace('.', ',');
}

// Clientes
function salvarCliente(event, isSubmit = false) {
    const id = document.getElementById('cliente-id').value;
    const nome = document.getElementById('cliente-nome').value.trim();
    const email = document.getElementById('cliente-email').value.trim();
    const telefone = document.getElementById('cliente-telefone').value.trim();
    const endereco = document.getElementById('cliente-endereco').value.trim();

    if (!nome) {
        if (isSubmit) alert('O nome do cliente é obrigatório.');
        return;
    }

    if (id) {
        const index = clientes.findIndex(c => c.id === id);
        if (index !== -1) {
            clientes[index] = { id, nome, email, telefone, endereco };
            if (isSubmit) alert('Cliente atualizado com sucesso!');
        }
    } else {
        const novoCliente = { id: generateAlphanumericUniqueId(), nome, email, telefone, endereco };
        clientes.push(novoCliente);
        document.getElementById('cliente-id').value = novoCliente.id;
        if (isSubmit) alert('Cliente adicionado com sucesso!');
    }
    saveData(); // Save to Firestore or Local Storage
    renderizarClientes();
    if (isSubmit) {
        document.getElementById('cliente-form').reset();
        document.getElementById('cliente-id').value = '';
    }
}

function renderizarClientes() {
    const tbody = document.querySelector('#clientes-tabela tbody');
    tbody.innerHTML = '';
    clientes.forEach(cliente => {
        const row = tbody.insertRow();
        row.insertCell().textContent = cliente.nome;
        row.insertCell().textContent = cliente.email || 'N/A';
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
        document.getElementById('cliente-email').value = cliente.email;
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
        saveData(); // Save to Firestore or Local Storage
        renderizarClientes();
        alert('Cliente excluído com sucesso!');
    }
}

// Produtos
function salvarProduto(event, isSubmit = false) {
    const id = document.getElementById('produto-id').value;
    const nomeProposta = document.getElementById('produto-nome-proposta').value.trim();
    const nomeReal = document.getElementById('produto-nome-real').value.trim();
    const categoriaInput = document.getElementById('produto-categoria').value.trim();
    const valorInput = document.getElementById('produto-valor').value;

    if (!nomeProposta) {
        if(isSubmit) alert('O "Nome para Proposta" é obrigatório.');
        return;
    }
    const valor = parseFloat(valorInput);
    if ((isNaN(valor) || valor < 0) && isSubmit) {
        alert('O valor do produto deve ser um número válido.');
        return;
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
        if (index !== -1) produtos[index] = produtoData;
    } else {
        produtos.push(produtoData);
        document.getElementById('produto-id').value = produtoData.id;
    }
    if(isSubmit) alert(id ? 'Produto atualizado!' : 'Produto adicionado!');

    saveData(); // Save to Firestore or Local Storage
    renderizarProdutosPorCategoria();
    if (isSubmit) {
        document.getElementById('produto-form').reset();
        document.getElementById('produto-id').value = '';
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
        saveData(); // Save to Firestore or Local Storage
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
    saveData(); // Save to Firestore or Local Storage
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
    if (isEditingItem && editingItemIndex > -1) {
        currentOrcamento.itens[editingItemIndex] = newItem;
    } else {
        currentOrcamento.itens.push(newItem);
    }
    saveData(); // Save to Firestore or Local Storage
    renderizarItensOrcamento();
    calcularTotaisOrcamento();
    closeModal();
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
                    <button class="btn-editar" onclick="openItemModal(${index})"><i class="fas fa-edit"></i></button>
                    <button class="btn-excluir" onclick="excluirItemOrcamento(${index})"><i class="fas fa-trash-alt"></i></button>
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
    // currentOrcamento is already loaded by loadDataFromFirestore or loadDataFromLocalStorage
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
    if (!currentOrcamento.clienteId) { alert('Selecione um cliente.'); return; }
    if (currentOrcamento.itens.length === 0) { alert('Adicione pelo menos um item.'); return; }

    currentOrcamento.data = new Date().toISOString();
    salvarDadosOrcamento(); // This will call saveData() which handles Firestore/Local Storage

    const existingIndex = orcamentos.findIndex(o => o.id === currentOrcamento.id);
    if (existingIndex !== -1) {
        orcamentos[existingIndex] = { ...currentOrcamento };
    } else {
        orcamentos.push({ ...currentOrcamento });
    }
    saveData(); // Save to Firestore or Local Storage
    renderizarOrcamentosSalvos();
    alert(`Orçamento ${currentOrcamento.id} salvo com sucesso!`);
}

function novoOrcamento() {
    if (confirm('Deseja iniciar um novo orçamento? As alterações não salvas no orçamento atual serão perdidas.')) {
        currentOrcamento = {
            id: generateSequentialId(),
            clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: []
        };
        saveData(); // Save to Firestore or Local Storage
        carregarOrcamentoAtual();
        alert('Novo orçamento iniciado com ID: ' + currentOrcamento.id);
    }
}

function renderizarOrcamentosSalvos() {
    const ul = document.getElementById('lista-orcamentos');
    ul.innerHTML = '';
    orcamentos.sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(orc => {
        const cliente = clientes.find(c => c.id === orc.clienteId);
        const dataFmt = new Date(orc.data || Date.now()).toLocaleDateString('pt-BR');
        // Verifica se há alguma chave NFE para exibir o botão "Ver NFE"
        const hasNFE = orc.nfeChaves && orc.nfeChaves.filter(n => n).length > 0;
        ul.innerHTML += `
            <li>
                <span>${cliente ? cliente.nome : 'Cliente Desconhecido'} - ${dataFmt} (Nº: ${orc.id})</span>
                <div>
                    <button class="btn-editar" onclick="carregarOrcamentoSalvo('${orc.id}')" title="Abrir"><i class="fas fa-folder-open"></i></button>
                    <button class="btn-excluir" onclick="excluirOrcamentoSalvo('${orc.id}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                    <button class="btn-preview" onclick="previewOrcamento('${orc.id}')" title="Preview Proposta"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-faturamento ${orc.faturamentoData ? 'active' : ''}" onclick="visualizarFaturamento('${orc.id}')" title="Ver Faturamento"><i class="fas fa-file-invoice"></i></button>
                    <button class="btn-nfe ${hasNFE ? 'active' : ''}" onclick="visualizarNFE('${orc.id}')" title="Ver NFE"><i class="fas fa-receipt"></i></button>
                </div>
            </li>
        `;
    });
}

function carregarOrcamentoSalvo(id) {
    const orc = orcamentos.find(o => o.id === id);
    if(orc) {
        if(confirm('Deseja carregar este orçamento? As alterações não salvas no formulário atual serão perdidas.')) {
            currentOrcamento = { ...orc };
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
            saveData(); // Save to Firestore or Local Storage
            carregarOrcamentoAtual();
            document.querySelector('#nav-orcamentos').click();
            alert(`Orçamento ${id} carregado.`);
        }
    }
}

function excluirOrcamentoSalvo(id) {
    if (confirm('Tem certeza que deseja excluir permanentemente este orçamento?')) {
        orcamentos = orcamentos.filter(o => o.id !== id);
        saveData(); // Save to Firestore or Local Storage
        renderizarOrcamentosSalvos();
        if (currentOrcamento.id === id) novoOrcamento();
        alert('Orçamento excluído!');
    }
}

function previewOrcamento(id) {
    const orc = orcamentos.find(o => o.id === id);
    if(orc) gerarPDF(true, orc); else alert('Orçamento não encontrado.');
}

// Faturamento
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
    if (!orcamentoId) { alert('Selecione um orçamento para vincular o faturamento.'); return; }

    const orcIndex = orcamentos.findIndex(o => o.id === orcamentoId);
    if (orcIndex === -1) { alert('Orçamento não encontrado.'); return; }

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
        alert('Preencha o Local e o Tipo de Serviço.'); return;
    }

    orcamentos[orcIndex].faturamentoData = faturamentoData;
    saveData(); // Save to Firestore or Local Storage
    gerarFaturamentoPDF(faturamentoData);
    renderizarOrcamentosSalvos();
    renderizarFaturamentosGerados();
    document.getElementById('faturamento-form').reset();
    document.getElementById('faturamento-parcelas-container').innerHTML = ''; // Limpa as parcelas
    alert('Faturamento gerado e anexado ao orçamento com sucesso!');
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
        preencherClienteFaturamento(); // Preenche o nome do cliente
        document.getElementById('faturamento-local').value = orc.faturamentoData.localServico || '';
        document.getElementById('faturamento-tipo-servico').value = orc.faturamentoData.tipoServico || '';
        document.getElementById('faturamento-entrada').value = orc.faturamentoData.valorEntrada > 0 ? orc.faturamentoData.valorEntrada.toFixed(2) : '0';

        const container = document.getElementById('faturamento-parcelas-container');
        container.innerHTML = ''; // Limpa as parcelas existentes
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
            orcamentos[orcIndex].faturamentoData = null; // Remove os dados do faturamento
            saveData(); // Save to Firestore or Local Storage
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

// Nota Fornecedor (NFE) - Funções REORGANIZADAS
const MAX_NFE_CHAVES = 3; 

function carregarChavesNFEParaOrcamentoSelecionado() {
    const orcamentoId = document.getElementById('nfe-orcamento-vinculado').value;
    const nfePanel = document.getElementById('nfe-management-panel');
    nfePanel.innerHTML = ''; // Limpa o painel

    if (!orcamentoId) {
        nfePanel.innerHTML = '<div class="nfe-placeholder"><i class="fas fa-arrow-up"></i><p>Selecione um orçamento acima para começar.</p></div>';
        return;
    }

    const orc = orcamentos.find(o => o.id === orcamentoId);

    // Garante que nfeChaves exista no orçamento
    if (orc && !orc.nfeChaves) {
        orc.nfeChaves = [];
    }

    // Renderiza campos existentes ou vazios até o limite de MAX_NFE_CHAVES
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

    // Adiciona o event listener para formatação automática
    const inputField = document.getElementById(`nfe-chave-${index}`);
    inputField.addEventListener('input', formatNFEChaveInput);

    // Controle de estado dos botões e campos
    const fornecedorField = document.getElementById(`nfe-fornecedor-${index}`);
    const saveButton = div.querySelector('.btn-salvar-nfe');
    const editButton = div.querySelector('.btn-editar-nfe');

    if (initialEntry.chave) { // Se já tem uma chave, está salvo
        inputField.disabled = true;
        fornecedorField.disabled = true;
        saveButton.style.display = 'none';
        editButton.style.display = 'inline-flex';
    } else { // Campo novo/vazio
        inputField.disabled = false;
        fornecedorField.disabled = false;
        saveButton.style.display = 'inline-flex';
        editButton.style.display = 'none';
    }
}

function formatNFEChaveInput(event) {
    let value = event.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    let formattedValue = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formattedValue += '-';
        }
        formattedValue += value[i];
    }
    event.target.value = formattedValue.substring(0, 54); // Limita a 54 caracteres (44 digitos + 10 hifens)
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

    saveData(); // Save to Firestore or Local Storage
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
        // Substitui por null em vez de remover para manter os índices dos outros campos
        orc.nfeChaves[index] = null;
        // Limpa o array de nulos no final
        while (orc.nfeChaves.length > 0 && orc.nfeChaves[orc.nfeChaves.length - 1] === null) {
            orc.nfeChaves.pop();
        }

        saveData(); // Save to Firestore or Local Storage
        renderizarOrcamentosSalvos();
        carregarChavesNFEParaOrcamentoSelecionado(); // Recarrega os campos para refletir a remoção
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
            if (entry) { // Verifica se a entrada não é nula
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
function openItemModal(itemIndex = -1) {
    const modal = document.getElementById('itemModal');
    const form = document.getElementById('item-form');
    form.reset();
    isEditingItem = itemIndex > -1;
    editingItemIndex = itemIndex;

    carregarCategoriasNoModalItem();

    if (isEditingItem && currentOrcamento.itens[itemIndex]) {
        const item = currentOrcamento.itens[itemIndex];
        const produto = produtos.find(p => p.id === item.produtoId);
        document.getElementById('modal-item-categoria').value = produto ? (produto.categoria || 'Geral') : '';
        carregarProdutosNoModalPorCategoria();
        document.getElementById('modal-produto').value = item.produtoId;
        document.getElementById('modal-quantidade').value = item.quantidade;
        document.getElementById('modal-valor').value = item.valor.toFixed(2);
        modal.querySelector('h3').textContent = 'Editar Item';
        modal.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-edit"></i> Atualizar Item';
    } else {
        carregarProdutosNoModalPorCategoria();
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
        select.innerHTML += `<option value="${p.id}" data-valor="${p.valor}">${p.nomeProposta} ${valorDisplay}</option>`;
    });
}
