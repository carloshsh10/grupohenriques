/**
 * Exporta um backup completo dos dados do aplicativo.
 * Se o usuário estiver online (logado no Firebase), busca os dados mais recentes da nuvem.
 * Se estiver offline, utiliza os dados das variáveis globais do app.
 */
async function exportarBackupCompleto() {
    const statusEl = document.getElementById('backup-status');
    if (statusEl) statusEl.textContent = 'Exportando...';

    let backupData;

    // 1. Tenta pegar do Firebase (Nuvem)
    if (window.firebaseUser) {
        try {
            console.log("Usuário online. Buscando dados do Firestore para backup.");
            const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', window.firebaseUser.uid);
            const docSnap = await window.firebaseGetDoc(userDocRef);
            if (docSnap.exists()) {
                backupData = docSnap.data();
            }
        } catch (error) {
            console.error("Erro ao buscar da nuvem, tentando local:", error);
        }
    }

    // 2. Se não conseguiu da nuvem (ou está offline), pega das variáveis globais (Memória/Local)
    if (!backupData) {
        console.log("Usando dados locais para backup.");
        // Certifica-se de que as variáveis globais do script.js estão acessíveis
        backupData = {
            clientes: window.clientes || [],
            produtos: window.produtos || [],
            orcamentos: window.orcamentos || [],
            boletos: window.boletos || [],
            // NOVOS DADOS
            contratos: window.contratos || [], 
            transacoes: window.transacoes || [],
            
            proximoOrcamentoId: window.proximoOrcamentoId || 1,
            currentOrcamento: window.currentOrcamento || {}
        };
    }

    if (!backupData) {
        alert("Erro: Não há dados para exportar.");
        if (statusEl) statusEl.textContent = 'Erro';
        return;
    }

    // Cria o arquivo JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    // Nome do arquivo com data
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `backup_grupo_henriques_${dateStr}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    atualizarStatusBackup('Exportação Concluída', new Date().toISOString());
}

/**
 * Importa um arquivo JSON de backup.
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validação básica
            if (!Array.isArray(data.clientes) || !Array.isArray(data.orcamentos)) {
                throw new Error("Formato de arquivo inválido.");
            }

            if (confirm("ATENÇÃO: Importar um backup substituirá todos os dados atuais. Deseja continuar?")) {
                // Atualiza variáveis globais
                window.clientes = data.clientes || [];
                window.produtos = data.produtos || [];
                window.orcamentos = data.orcamentos || [];
                window.boletos = data.boletos || [];
                // NOVOS DADOS
                window.contratos = data.contratos || [];
                window.transacoes = data.transacoes || [];
                
                window.proximoOrcamentoId = data.proximoOrcamentoId || 1;
                window.currentOrcamento = data.currentOrcamento || {};

                // Salva (no Firebase se logado, ou LocalStorage se offline)
                // A função saveData() deve estar acessível globalmente no script.js
                if (typeof window.saveData === 'function') {
                    await window.saveData();
                } else {
                    // Fallback se saveData não estiver exposta
                    localStorage.setItem('clientes', JSON.stringify(window.clientes));
                    localStorage.setItem('produtos', JSON.stringify(window.produtos));
                    localStorage.setItem('orcamentos', JSON.stringify(window.orcamentos));
                    localStorage.setItem('boletos', JSON.stringify(window.boletos));
                    localStorage.setItem('contratos', JSON.stringify(window.contratos));
                    localStorage.setItem('transacoes', JSON.stringify(window.transacoes));
                    localStorage.setItem('proximoOrcamentoId', window.proximoOrcamentoId);
                }

                // Recarrega a página para atualizar a interface
                alert("Backup restaurado com sucesso! A página será recarregada.");
                location.reload();
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao ler o arquivo de backup: " + error.message);
        }
    };
    reader.readAsText(file);
}

function atualizarStatusBackup(status, timestamp) {
    const statusElement = document.getElementById('backup-status');
    const lastBackupElement = document.getElementById('ultimo-backup');

    if (statusElement) statusElement.textContent = status;

    if (lastBackupElement && timestamp) {
        const date = new Date(timestamp);
        lastBackupElement.textContent = date.toLocaleString('pt-BR');
    }
    
    if (statusElement && status !== 'Processando...') {
        setTimeout(() => { statusElement.textContent = 'Pronto'; }, 5000);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = document.getElementById('exportar-backup-btn');
    if (exportBtn) {
        // Usa cloneNode para remover listeners antigos e garantir que só o novo funcione
        const newBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', exportarBackupCompleto);
    }

    const importInput = document.getElementById('importar-backup-file');
    if(importInput) {
        const newInput = importInput.cloneNode(true);
        importInput.parentNode.replaceChild(newInput, importInput);
        newInput.addEventListener('change', handleFileUpload);
    }
});