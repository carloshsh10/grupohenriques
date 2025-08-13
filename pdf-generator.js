// Função principal para gerar PDF de Orçamento
function gerarPDF(isPreview = false, orcamentoData = null) {
    try {
        const orcamentoParaGerar = orcamentoData || currentOrcamento;

        if (!orcamentoParaGerar || !orcamentoParaGerar.clienteId || orcamentoParaGerar.itens.length === 0) {
            alert('Dados insuficientes para gerar a proposta (cliente e itens são necessários).');
            return;
        }

        const cliente = clientes.find(c => c.id === orcamentoParaGerar.clienteId);
        if (!cliente) {
            alert('Cliente não encontrado.');
            return;
        }

        if (typeof jsPDF === 'undefined') {
            alert('Erro: Biblioteca jsPDF não carregada.');
            return;
        }

        const doc = new jsPDF();
        const proposalId = orcamentoParaGerar.id || 'Novo';

        doc.setProperties({
            title: `Proposta Comercial ${cliente.nome} - Nº ${proposalId}`,
            subject: 'Proposta Comercial GRUPO HENRIQUES',
            author: 'GRUPO HENRIQUES',
            keywords: `orcamento, segurança eletrônica, GRUPO HENRIQUES, ${proposalId}`,
            creator: 'Sistema de Orçamentos GRUPO HENRIQUES'
        });

        // Geração das páginas
        let yPosAposCabecalho = adicionarCabecalhoPremium(doc, cliente, orcamentoParaGerar);
        let yPosAposItens = adicionarItensOrcamentoPremium(doc, orcamentoParaGerar, yPosAposCabecalho);
        let yPosAposTotais = adicionarTotaisPremium(doc, orcamentoParaGerar, yPosAposItens);
        adicionarInformacoesAdicionaisPremium(doc, orcamentoParaGerar, yPosAposTotais);
        adicionarRodapePremium(doc, 1);

        doc.addPage();
        adicionarTermosCondicoes(doc);
        adicionarRodapePremium(doc, 2);

        doc.addPage();
        adicionarApresentacao(doc);
        adicionarRodapePremium(doc, 3);
        
        if (isPreview) {
            doc.output('dataurlnewwindow');
        } else {
            doc.save(`Proposta Comercial ${cliente.nome} - Nº ${proposalId}.pdf`);
            alert('PDF da Proposta gerado com sucesso!');
        }

    } catch (error) {
        alert('Ocorreu um erro ao gerar o PDF da Proposta. Detalhes: ' + error.message);
        console.error('Erro ao gerar PDF:', error);
    }
}

// --- Funções para PDF de Orçamento (Página 1 - ALTERADAS) ---
function adicionarCabecalhoPremium(doc, cliente, orcamento) {
    const startY = 8;
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO HENRIQUES', pageWidth / 2, y + 7, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(255, 153, 0);
    doc.text('SEGURANÇA ELETRÔNICA', pageWidth / 2, y + 14, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    // REMOVIDO: Endereço da empresa
    doc.text('Contato: 24 99223-2018 / 24 99296-9844 | CNPJ: 22.827.727/0001-80', pageWidth / 2, y + 22, { align: 'center' });
    y = 42;
    const clienteBoxHeight = 45;
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 3, 3, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 3, 3, 'S');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('PROPOSTA COMERCIAL', pageWidth / 2, y + 7, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const lineSpacingCliente = 5.5;
    let clienteInfoY = y + 16;
    doc.text(`Cliente: ${cliente.nome}`, margin + 4, clienteInfoY);
    
    // SUBSTITUIÇÃO: Endereço do cliente por "Serviços"
    const servicosText = orcamento.servicos || 'Serviços de Segurança Eletrônica';
    clienteInfoY += lineSpacingCliente;
    doc.text(`Serviços: ${servicosText}`, margin + 4, clienteInfoY);
    
    if (cliente.telefone) {
        clienteInfoY += lineSpacingCliente;
        doc.text(`Telefone: ${cliente.telefone}`, margin + 4, clienteInfoY);
    }
    if (cliente.email) {
        clienteInfoY += lineSpacingCliente;
        doc.text(`E-mail: ${cliente.email}`, margin + 4, clienteInfoY);
    }
    doc.setFontSize(8.5);
    doc.setTextColor(0, 51, 102);
    const proposalId = orcamento.id;
    doc.text(`Data: ${new Date(orcamento.data || Date.now()).toLocaleDateString('pt-BR')}`, pageWidth - margin - 4, y + 16, { align: 'right' });
    doc.text(`Proposta Nº: ${proposalId}`, pageWidth - margin - 4, y + 16 + lineSpacingCliente, { align: 'right' });
    doc.text(`Validade: 7 dias`, pageWidth - margin - 4, y + 16 + (2 * lineSpacingCliente), { align: 'right' });
    y += clienteBoxHeight + 8;
    return y;
}

// As demais funções de PDF (adicionarItens, Totais, etc.) permanecem as mesmas
function adicionarItensOrcamentoPremium(doc, orcamento, startY) {
    let y = startY;
    const margin = 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('DETALHES DOS SERVIÇOS E PRODUTOS', margin, y);
    y += 7;
    const tableColumn = [
        {header: "PRODUTO/SERVIÇO", dataKey: "produto"},
        {header: "QTD", dataKey: "quantidade"},
        {header: "V. UNIT.", dataKey: "unitario"}, 
        {header: "TOTAL", dataKey: "total"}
    ];
    
    // ======================= PONTO DA ALTERAÇÃO =======================
    // A tabela de itens agora usa a nova função "formatarNumeroSemSimbolo"
    // para não exibir "R$" nas colunas de valores.
    const tableRows = orcamento.itens.map(item => ({
        produto: item.produtoNome,
        quantidade: item.quantidade.toLocaleString('pt-BR'),
        unitario: formatarNumeroSemSimbolo(item.valor),
        total: formatarNumeroSemSimbolo(item.quantidade * item.valor)
    }));
    
    if (orcamento.maoDeObra > 0) {
        tableRows.push({
            _section: "maoDeObra",
            produto: {content: "MÃO DE OBRA / SERVIÇOS", colSpan: 3, styles: {fontStyle: 'bold', fillColor: [235, 235, 235], textColor: [0,0,0]}},
            total: {content: formatarNumeroSemSimbolo(orcamento.maoDeObra), styles: {fontStyle: 'bold', fillColor: [235, 235, 235], textColor: [0,0,0]}}
        });
    }
    // =================================================================

    let fontSizeTabela = 8; 
    if (orcamento.itens.length > 12 && orcamento.itens.length <= 18) {
        fontSizeTabela = 7;
    } else if (orcamento.itens.length > 18) {
        fontSizeTabela = 6.5; 
    }
    doc.autoTable({
        columns: tableColumn, body: tableRows, startY: y, margin: {left: margin, right: margin},
        styles: { fontSize: fontSizeTabela, cellPadding: 1.8, overflow: 'linebreak', lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [0, 0, 0] },
        headerStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: fontSizeTabela + 0.5, cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { produto: {cellWidth: 'auto', halign: 'left'}, quantidade: {cellWidth: 14, halign: 'center'}, unitario: {cellWidth: 23, halign: 'right'}, total: {cellWidth: 28, halign: 'right'} },
        didDrawPage: function(data) { adicionarRodapePremium(doc, data.pageNumber); },
        pageBreak: 'auto', tableWidth: 'auto'
    });
    y = doc.autoTable.previous.finalY + 4;
    return y;
}
function adicionarTotaisPremium(doc, orcamento, startY) {
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const rodapeHeight = 18;
    const totalProdutos = orcamento.itens.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
    const totalGeral = totalProdutos + (orcamento.maoDeObra || 0);
    const boxWidth = 90;
    const boxHeight = 22;
    let boxX = pageWidth - margin - boxWidth;
    let boxY = y;
    if (boxY + boxHeight > pageHeight - rodapeHeight - 5) {
      if (doc.autoTable.previous.finalY < pageHeight - rodapeHeight - boxHeight - 8) { 
          boxY = doc.autoTable.previous.finalY + 3; 
      } 
    }
    doc.setFillColor(238, 238, 238);
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.15);
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    
    // Totais Finais continuam usando "formatarMoeda" para exibir o "R$"
    doc.text('TOTAL PRODUTOS:', boxX + 4, boxY + 6);
    doc.text(formatarMoeda(totalProdutos), boxX + boxWidth - 4, boxY + 6, {align: 'right'});
    doc.setFontSize(10);
    doc.setTextColor(255, 153, 0);
    doc.text('TOTAL GERAL:', boxX + 4, boxY + 15);
    doc.text(formatarMoeda(totalGeral), boxX + boxWidth - 4, boxY + 15, {align: 'right'});
    y = boxY + boxHeight + 4;
    return y;
}
function adicionarInformacoesAdicionaisPremium(doc, orcamento, startY) {
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - 2 * margin;
    const pageHeight = doc.internal.pageSize.getHeight();
    const rodapeHeight = 18;
    const espacoDisponivelParaTexto = pageHeight - y - rodapeHeight - 20;
    let textoRelatorio = orcamento.relatorio || 'Sem observações adicionais.';
    let textoPagamento = orcamento.formasPagamento || 'A combinar com o cliente.';
    let fontSizeInfo = 8.5;
    const relatorioLinesEstimadas = doc.splitTextToSize(textoRelatorio, availableWidth).length;
    const pagamentoLinesEstimadas = doc.splitTextToSize(textoPagamento, availableWidth).length;
    const totalLinesEstimadas = relatorioLinesEstimadas + pagamentoLinesEstimadas + 4;
    const alturaEstimadaTexto = totalLinesEstimadas * (fontSizeInfo * 0.352778 * 1.4);
    if (alturaEstimadaTexto > espacoDisponivelParaTexto && espacoDisponivelParaTexto > 15) { 
        if (totalLinesEstimadas > 18) fontSizeInfo = 7; 
        else fontSizeInfo = 7.5;
    }
    function adicionarSecaoTexto(titulo, texto, currentY, isLastSection = false) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text(titulo, margin, currentY);
        currentY += 5.5;
        doc.setFontSize(fontSizeInfo);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(texto, availableWidth);
        lines.forEach(line => {
            if (currentY > pageHeight - rodapeHeight - 8) {
                if (!isLastSection) {
                    doc.addPage();
                    adicionarRodapePremium(doc, doc.internal.getCurrentPageInfo().pageNumber);
                    currentY = 18;
                    doc.setFontSize(9.5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 51, 102);
                    doc.text(titulo, margin, currentY);
                    currentY += 5.5;
                    doc.setFontSize(fontSizeInfo);
                    doc.setFont('helvetica', 'normal');
                 }
            }
            if (currentY <= pageHeight - rodapeHeight - 8) {
                doc.text(line, margin, currentY);
                currentY += (fontSizeInfo * 0.352778 * 1.35);
            }
        });
        currentY += 4;
        return currentY;
    }
    if (textoRelatorio.trim() !== 'Sem observações adicionais.' && textoRelatorio.trim() !== '') {
      y = adicionarSecaoTexto('OBSERVAÇÕES:', textoRelatorio, y);
    }
    if (y < pageHeight - rodapeHeight - 18 || (textoPagamento.trim() !== 'A combinar com o cliente.' && textoPagamento.trim() !== '')) {
       y = adicionarSecaoTexto('FORMA DE PAGAMENTO:', textoPagamento, y, true);
    }
    return y;
}
function adicionarTermosCondicoes(doc) {
    const margin = 15;
    let y = 20;
    const contentWidth = doc.internal.pageSize.getWidth() - (2 * margin);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('TERMOS E CONDIÇÕES', margin, y);
    y += 10;

    const termos = [
        { text: "Prezados,", style: "normal"},
        { text: "SOBRE O ORÇAMENTO", style: "bold", spaceBefore: 4, spaceAfter: 2.5},
        { text: "Prazo de Garantia:", style: "bold"},
        { text: "O Grupo Henriques oferece garantia de até 3 (três) meses para a execução de todos os serviços prestados, contados a partir da data de conclusão. A garantia dos equipamentos segue os prazos e condições estabelecidos pelos respectivos fabricantes. Os serviços de garantia serão realizados exclusivamente nas dependências localizadas em Angra dos Reis – RJ.", style: "normal", spaceAfter: 2.5},
        { text: "Ressaltamos que o Grupo Henriques não se responsabiliza por danos oriundos de acidentes, negligência, uso inadequado dos equipamentos, bem como danos decorrentes de eventos fortuitos, força maior ou fenômenos naturais, tais como descargas elétricas, raios, vendavais, inundações e desabamentos.", style: "normal", spaceAfter: 4},
        { text: "Duração dos Trabalhos:", style: "bold"},
        { text: "O prazo para execução será definido em comum acordo com o cliente. Este cronograma pode ser impactado por fatores externos, como: problemas estruturais, dutos obstruídos, postes com estrutura inadequada, dificuldade de acesso aos pontos de distribuição, autorização da Prefeitura Municipal e de órgãos públicos ou privados necessários à execução dos serviços.", style: "normal", spaceAfter: 4},
        { text: "Observações importantes para execução do serviço:", style: "bold"},
        { text: "• Acesso livre aos locais de instalação", style: "normal", indent: 5},
        { text: "• Espaço adequado para acondicionamento dos equipamentos", style: "normal", indent: 5},
        { text: "• Infraestrutura disponível para passagem dos cabos", style: "normal", indent: 5},
        { text: "• Ponto de energia com tensão de 127V", style: "normal", indent: 5},
        { text: "• Acompanhamento de um responsável durante os testes", style: "normal", indent: 5, spaceAfter: 4},
        { text: "Início dos Trabalhos:", style: "bold"},
        { text: "• Em até 10 (dez) dias úteis após a confirmação de recebimento e aprovação do orçamento", style: "normal", indent: 5},
        { text: "• O presente orçamento tem validade de 7 (sete) dias corridos a contar da data de emissão", style: "normal", indent: 5, spaceAfter: 4},
        { text: "Estamos confiantes de que entregaremos um trabalho de excelência, caso nos seja confiada a execução do serviço.", style: "normal", spaceAfter: 2.5},
        { text: "Agradecemos desde já a oportunidade e nos colocamos à disposição para quaisquer esclarecimentos.", style: "normal"}
    ];
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lineHeight = 4.5;

    termos.forEach(item => {
        if (item.spaceBefore) y += item.spaceBefore;
        doc.setFont('helvetica', item.style === "bold" ? 'bold' : 'normal');
        let prefix = item.indent ? ' '.repeat(item.indent) : '';
        const lines = doc.splitTextToSize(prefix + item.text, contentWidth - (item.indent || 0));
        lines.forEach(line => {
            if (y + lineHeight > doc.internal.pageSize.getHeight() - 18) {
                doc.addPage();
                y = 18;
            }
            doc.text(line, margin + (item.indent ? (item.indent * 1.5) : 0) , y); 
            y += lineHeight;
        });
        doc.setFont('helvetica', 'normal');
        if (item.spaceAfter) y += item.spaceAfter;
        else y += 1.5;
    });
}
function adicionarApresentacao(doc) {
    const margin = 15;
    let y = 25;
    const contentWidth = doc.internal.pageSize.getWidth() - (2 * margin);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('APRESENTAÇÃO DA EMPRESA', margin, y);
    y += 12;

    const apresentacao = [
        "Prezado(a) Cliente,",
        "Apresentamos a seguir nossa proposta orçamentária referente aos serviços de Segurança Eletrônica, elaborada conforme as especificações e necessidades apresentadas.",
        "O Grupo Henriques atua há mais de 10 anos no segmento de Segurança Eletrônica e Digital na cidade de Angra dos Reis – RJ, consolidando-se como referência pela qualidade dos serviços prestados e pela busca contínua da satisfação total de nossos clientes.",
        "Contamos com uma equipe de profissionais altamente capacitados e constantemente treinados. Este diferencial garante que todos os serviços sejam executados em conformidade com os mais altos padrões técnicos, utilizando sempre materiais de primeira linha e tecnologia de ponta.",
        "A execução dos projetos é realizada por técnicos especializados, responsáveis por assegurar que todas as atividades sigam rigorosamente o escopo acordado. Mantemos nossos clientes constantemente informados sobre o progresso dos serviços, promovendo uma parceria transparente e eficaz.",
        "Permanecemos à inteira disposição para quaisquer dúvidas, esclarecimentos ou ajustes que se façam necessários nesta proposta.",
        "Esperamos ter a oportunidade de atendê-lo(a) e superar suas expectativas.",
        "Atenciosamente,"
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lineHeight = 6;

    apresentacao.forEach(paragrafo => {
        const lines = doc.splitTextToSize(paragrafo, contentWidth);
        lines.forEach(line => {
            if (y + lineHeight > doc.internal.pageSize.getHeight() - 18) {
                doc.addPage();
                y = 18; 
            }
            doc.text(line, margin, y);
            y += lineHeight;
        });
        y += lineHeight * 0.5;
    });

    y += lineHeight * 1.5;
    const assinatura = [
        "Carlos Henrique dos Santos",
        "Diretor Técnico – Grupo Henriques",
        "Telefones: (24) 99223-2018 / (24) 99296-9844"
    ];
    assinatura.forEach(linha => {
        if (y + lineHeight > doc.internal.pageSize.getHeight() - 18) {
            doc.addPage(); y = 18; 
        }
        doc.text(linha, margin, y);
        y += lineHeight;
    });
}
function adicionarRodapePremium(doc, pageNumForDisplay = null) {
    const pageCount = doc.internal.getNumberOfPages();
    const currentPage = pageNumForDisplay || doc.internal.getCurrentPageInfo().pageNumber; 
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const rodapeHeight = 16;
    doc.setFillColor(0, 51, 102);
    doc.rect(0, pageHeight - rodapeHeight, pageWidth, rodapeHeight, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth / 2, pageHeight - (rodapeHeight / 2) - 2.5, { align: 'center' }); 
    doc.setFontSize(6.5);
    doc.text('Angra dos Reis - RJ | (24) 99223-2018 / (24) 99296-9844 | CNPJ: 22.827.727/0001-80', pageWidth / 2, pageHeight - (rodapeHeight / 2) + 3, { align: 'center' });
}

// --- FUNÇÃO PARA GERAR PDF DE FATURAMENTO ---
function gerarFaturamentoPDF(faturamentoData, isPreview = false) {
    try {
        if (!faturamentoData || !faturamentoData.clienteId) {
            alert('Dados de faturamento insuficientes.'); return;
        }
        const cliente = clientes.find(c => c.id === faturamentoData.clienteId);
        if (!cliente) { alert('Cliente do faturamento não encontrado.'); return; }

        const doc = new jsPDF();
        doc.setProperties({ title: `Relatório de Faturamento - ${cliente.nome}` });

        adicionarCabecalhoFaturamento(doc, cliente);
        let y = 98;
        const margin = 15;
        const contentWidth = doc.internal.pageSize.getWidth() - 2 * margin;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('INFORMAÇÕES DO SERVIÇO', margin, y);
        y += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`Local do Serviço: ${faturamentoData.localServico}`, margin, y);
        y += 6;
        doc.text(`Tipo do Serviço: ${faturamentoData.tipoServico}`, margin, y);
        y += 12;

        if (faturamentoData.parcelas.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('DETALHAMENTO DO FATURAMENTO', margin, y);
            y += 7;

            const tableRows = faturamentoData.parcelas.map((p, index) => {
                const dataFormatada = p.data ? new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
                return { parcela: `${index + 1}ª`, vencimento: dataFormatada, valor: formatarMoeda(p.valor) };
            });

            doc.autoTable({
                columns: [{ header: 'PARCELA', dataKey: 'parcela' }, { header: 'VENCIMENTO', dataKey: 'vencimento' }, { header: 'VALOR (R$)', dataKey: 'valor' }],
                body: tableRows, startY: y, theme: 'grid',
                headerStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
                columnStyles: { valor: { halign: 'right' } }
            });
            y = doc.autoTable.previous.finalY;
        }
        
        const totalParcelas = faturamentoData.parcelas.reduce((sum, p) => sum + p.valor, 0);
        const totalGeral = faturamentoData.valorEntrada + totalParcelas;
        y += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Valor de Entrada: ${formatarMoeda(faturamentoData.valorEntrada)}`, contentWidth - 80 + margin, y, { align: 'left' });
        y += 6;
        doc.text(`Total em Parcelas: ${formatarMoeda(totalParcelas)}`, contentWidth - 80 + margin, y, { align: 'left' });
        y += 6;
        doc.setLineWidth(0.5);
        doc.line(contentWidth - 80 + margin, y, contentWidth + margin, y);
        y += 6;
        doc.setFontSize(11);
        doc.setTextColor(0, 51, 102);
        doc.text(`VALOR TOTAL: ${formatarMoeda(totalGeral)}`, contentWidth - 80 + margin, y, { align: 'left' });

        adicionarRodapePremium(doc, 1);
        
        if (isPreview) {
            doc.output('dataurlnewwindow');
        } else {
            doc.save(`Faturamento - ${cliente.nome}.pdf`);
        }
    } catch (error) {
        alert('Erro ao gerar PDF de Faturamento: ' + error.message);
        console.error('Erro PDF Faturamento:', error);
    }
}

function adicionarCabecalhoFaturamento(doc, cliente) {
    const startY = 8; let y = startY; const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('GRUPO HENRIQUES', pageWidth / 2, y + 7, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(255, 153, 0);
    doc.text('SEGURANÇA ELETRÔNICA', pageWidth / 2, y + 14, { align: 'center' });
    doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    doc.text('Contato: 24 99223-2018 / 24 99296-9844 | CNPJ: 22.827.727/0001-80', pageWidth / 2, y + 22, { align: 'center' });
    y = 42;
    const clienteBoxHeight = 48;
    doc.setFillColor(240, 240, 240); 
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 3, 3, 'F');
    doc.setDrawColor(0, 51, 102); doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 3, 3, 'S');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 51, 102);
    doc.text('RELATÓRIO DE FATURAMENTO', pageWidth / 2, y + 8, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    const lineSpacingCliente = 6; let clienteInfoY = y + 18;
    doc.text(`Cliente: ${cliente.nome}`, margin + 5, clienteInfoY);
    if (cliente.endereco) { clienteInfoY += lineSpacingCliente; doc.text(`Endereço: ${cliente.endereco}`, margin + 5, clienteInfoY); }
    if (cliente.telefone) { clienteInfoY += lineSpacingCliente; doc.text(`Telefone: ${cliente.telefone}`, margin + 5, clienteInfoY); }
    if (cliente.email) { clienteInfoY += lineSpacingCliente; doc.text(`E-mail: ${cliente.email}`, margin + 5, clienteInfoY); }
    doc.setFontSize(9); doc.setTextColor(0, 51, 102);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin - 5, y + 18, { align: 'right' });
    return y + clienteBoxHeight + 8;
}

/**
 * Formata um número para o padrão monetário brasileiro (ex: R$ 1.250,75).
 * @param {number} valor O número a ser formatado.
 * @returns {string} O valor formatado com o símbolo "R$".
 */
function formatarMoeda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return 'R$ 0,00';
    return 'R$ ' + parseFloat(valor).toFixed(2).replace('.', ',');
}

/**
 * NOVA FUNÇÃO: Formata um número para o padrão monetário, mas SEM o símbolo "R$".
 * Usada para as colunas da tabela, para um visual mais limpo.
 * @param {number} valor O número a ser formatado.
 * @returns {string} O valor formatado sem o símbolo "R$" (ex: "1.250,75").
 */
function formatarNumeroSemSimbolo(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) {
        return '0,00';
    }
    // Formata o número com duas casas decimais e usa a vírgula como separador decimal.
    return parseFloat(valor).toFixed(2).replace('.', ',');
}
