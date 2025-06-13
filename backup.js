// Funções de Backup
function exportarBackup() {
    try {
        const backupData = {
            clientes: JSON.parse(localStorage.getItem('clientes')) || [],
            produtos: JSON.parse(localStorage.getItem('produtos')) || [],
            orcamentos: JSON.parse(localStorage.getItem('orcamentos')) || [],
            proximoOrcamentoId: localStorage.getItem('proximoOrcamentoId') || 1,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_orcamentos_GRUPOHENRIQUES_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        atualizarStatusBackup('Backup exportado com sucesso', backupData.timestamp);
    } catch (error) {
        alert('Erro ao exportar backup: ' + error.message);
        console.error('Erro ao exportar backup:', error);
        atualizarStatusBackup('Erro na exportação');
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        atualizarStatusBackup('Nenhum arquivo selecionado.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.clientes && importedData.produtos && importedData.orcamentos) {
                if (confirm('Ao importar, todos os dados atuais serão PERDIDOS e substituídos pelos dados do arquivo. Deseja continuar?')) {
                    localStorage.setItem('clientes', JSON.stringify(importedData.clientes));
                    localStorage.setItem('produtos', JSON.stringify(importedData.produtos));
                    localStorage.setItem('orcamentos', JSON.stringify(importedData.orcamentos));
                    localStorage.setItem('proximoOrcamentoId', importedData.proximoOrcamentoId || 1);
                    
                    // Limpa o currentOrcamento para evitar carregar um orçamento antigo e inválido
                    localStorage.removeItem('currentOrcamento');

                    alert('Backup importado com sucesso! A página será recarregada para aplicar todas as alterações.');
                    
                    // Recarrega a página para que todos os dados sejam lidos do zero
                    location.reload();

                } else {
                    atualizarStatusBackup('Importação cancelada.');
                }
            } else {
                alert('O arquivo JSON não parece ser um backup válido. Faltam dados essenciais (clientes, produtos, orçamentos).');
                atualizarStatusBackup('Arquivo inválido');
            }
        } catch (error) {
            alert('Erro ao ler o arquivo JSON. Certifique-se de que é um arquivo de backup válido.');
            console.error('Erro na leitura/parsing do arquivo:', error);
            atualizarStatusBackup('Erro na importação');
        } finally {
            // Reseta o input para permitir o upload do mesmo arquivo novamente
            event.target.value = '';
        }
    };
    reader.onerror = function() {
        alert('Erro ao carregar o arquivo.');
        atualizarStatusBackup('Erro ao carregar arquivo');
    };
    reader.readAsText(file);
}

// Função auxiliar para atualizar status de backup
function atualizarStatusBackup(status, timestamp) {
    const statusElement = document.getElementById('backup-status');
    const lastBackupElement = document.getElementById('ultimo-backup');

    if (statusElement) statusElement.textContent = status;

    if (lastBackupElement) {
        if (timestamp) {
            const date = new Date(timestamp);
            lastBackupElement.textContent = date.toLocaleString('pt-BR');
        } else {
            lastBackupElement.textContent = 'Nenhum';
        }
    }
    
    if (statusElement && status !== 'Processando...') {
        setTimeout(() => {
            statusElement.textContent = 'Pronto';
        }, 5000);
    }
}

// Inicializa os event listeners para os botões de backup
document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = document.getElementById('exportar-backup-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportarBackup);

    const importInput = document.getElementById('importar-backup-file');
    if(importInput) importInput.addEventListener('change', handleFileUpload);
});
