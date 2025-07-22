/**
 * Exporta um backup completo dos dados do aplicativo.
 * Se o usuário estiver online (logado no Firebase), busca os dados mais recentes da nuvem.
 * Se estiver offline, utiliza os dados das variáveis globais do app (que são carregadas do Local Storage).
 */
async function exportarBackupCompleto() {
    const statusEl = document.getElementById('backup-status');
    if (statusEl) statusEl.textContent = 'Exportando...';

    let backupData;

    // Verifica se o usuário está logado no Firebase
    if (window.firebaseUser) {
        try {
            console.log("Usuário online. Buscando dados do Firestore para backup.");
            const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', window.firebaseUser.uid);
            const docSnap = await window.firebaseGetDoc(userDocRef);
            if (docSnap.exists()) {
                backupData = docSnap.data();
            } else {
                alert('Nenhum dado encontrado na nuvem para exportar.');
                if (statusEl) statusEl.textContent = 'Pronto';
                return;
            }
        } catch (error) {
            console.error("Erro ao buscar dados do Firestore para backup:", error);
            alert("Falha ao buscar dados da nuvem. O backup pode estar incompleto.");
            if (statusEl) statusEl.textContent = 'Erro na exportação';
            return;
        }
    } else {
        // Se estiver offline, usa os dados carregados nas variáveis globais do script.js
        console.log("Usuário offline. Usando dados locais para backup.");
        backupData = {
            clientes: window.clientes,
            produtos: window.produtos,
            orcamentos: window.orcamentos,
            proximoOrcamentoId: window.proximoOrcamentoId,
            currentOrcamento: window.currentOrcamento
        };
    }

    if (!backupData) {
        alert("Não foi possível coletar os dados para o backup.");
        if (statusEl) statusEl.textContent = 'Pronto';
        return;
    }
    
    // Adiciona um timestamp ao backup
    backupData.timestamp = new Date().toISOString();

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dataFormatada = new Date().toISOString().slice(0, 10);
    a.download = `backup_grupohenriques_${dataFormatada}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    atualizarStatusBackup('Exportação concluída!', backupData.timestamp);
}

/**
 * Lida com o upload de um arquivo de backup.
 * @param {Event} event O evento de mudança do input de arquivo.
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (!confirm("Tem certeza que deseja importar este arquivo? Todos os dados atuais (clientes, produtos, orçamentos, etc.) serão substituídos pelos dados do arquivo de backup. Esta ação não pode ser desfeita.")) {
        event.target.value = ''; // Limpa o input se o usuário cancelar
        return;
    }
    
    const reader = new FileReader();
    atualizarStatusBackup('Processando...');

    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validação simples para ver se o arquivo parece correto
            if (data.clientes && data.produtos && data.orcamentos) {
                
                // Atualiza as variáveis globais do script.js
                window.clientes = data.clientes || [];
                window.produtos = data.produtos || [];
                window.orcamentos = data.orcamentos || [];
                window.proximoOrcamentoId = data.proximoOrcamentoId || 1;
                window.currentOrcamento = data.currentOrcamento || { id: generateSequentialId(true), clienteId: null, itens: [], maoDeObra: 0, relatorio: "", formasPagamento: "", servicos: "", faturamentoData: null, nfeChaves: [] };

                // Salva os novos dados (seja no Firebase ou LocalStorage, a função saveData decide)
                window.saveData();

                // Recarrega todos os dados na interface a partir das variáveis atualizadas
                window.carregarDadosIniciais();

                alert('Backup importado com sucesso! Os dados foram atualizados.');
                atualizarStatusBackup('Importação bem-sucedida!', data.timestamp);

            } else {
                throw new Error('Formato de arquivo inválido. Faltam dados essenciais.');
            }
        } catch (error) {
            console.error('Erro ao importar backup:', error);
            alert(`Falha ao importar o backup. Verifique se o arquivo está no formato correto e não está corrompido. Erro: ${error.message}`);
            atualizarStatusBackup('Erro na importação');
        } finally {
            event.target.value = ''; // Limpa o input de arquivo
        }
    };

    reader.onerror = function() {
        alert('Ocorreu um erro ao tentar ler o arquivo de backup.');
        atualizarStatusBackup('Erro ao ler o arquivo');
    };

    reader.readAsText(file);
}


/**
 * Função auxiliar para atualizar o status do backup na interface.
 * @param {string} status A mensagem de status.
 * @param {string} [timestamp] O timestamp do backup.
 */
function atualizarStatusBackup(status, timestamp) {
    const statusElement = document.getElementById('backup-status');
    const lastBackupElement = document.getElementById('ultimo-backup');

    if (statusElement) statusElement.textContent = status;

    if (lastBackupElement) {
        if (timestamp) {
            const date = new Date(timestamp);
            lastBackupElement.textContent = date.toLocaleString('pt-BR');
        }
    }
    
    // Limpa o status após 5 segundos, se não for um processo em andamento
    if (statusElement && status !== 'Processando...') {
        setTimeout(() => {
            statusElement.textContent = 'Pronto';
        }, 5000);
    }
}

// Inicializa os event listeners quando o DOM estiver carregado.
document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = document.getElementById('exportar-backup-btn');
    if (exportBtn) {
        // Remove o listener antigo para evitar duplicação, se houver
        exportBtn.removeEventListener('click', window.exportarBackup); // Função antiga, se existir
        // Adiciona o listener para a nova função
        exportBtn.addEventListener('click', exportarBackupCompleto);
    }

    const importInput = document.getElementById('importar-backup-file');
    if(importInput) {
        importInput.addEventListener('change', handleFileUpload);
    }
});
