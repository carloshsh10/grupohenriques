// =======================================================
// ========= GERADOR DE PDF - GRUPO HENRI SISTEMAS =======
// =======================================================

// --- ORÇAMENTOS (PROPOSTAS COMERCIAIS) ---

function gerarPDF(isPreview = false, orcamentoData = null) {
    try {
        // Usa o orçamento passado ou o atual da memória global
        const orcamentoParaGerar = orcamentoData || (typeof currentOrcamento !== 'undefined' ? currentOrcamento : null);

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

        const doc = new window.jspdf.jsPDF();
        const proposalId = orcamentoParaGerar.id || 'Novo';

        doc.setProperties({
            title: `Proposta Comercial ${cliente.nome} - Nº ${proposalId}`,
            subject: 'Proposta Comercial GRUPO HENRI SISTEMAS',
            author: 'GRUPO HENRI SISTEMAS',
            creator: 'Sistema de Gestão GH'
        });

        // Geração das páginas
        let yPosAposCabecalho = adicionarCabecalhoPremium(doc, cliente, orcamentoParaGerar);
        let yPosAposItens = adicionarItensOrcamentoPremium(doc, orcamentoParaGerar, yPosAposCabecalho);
        let yPosAposTotais = adicionarTotaisPremium(doc, orcamentoParaGerar, yPosAposItens);
        adicionarInformacoesAdicionaisPremium(doc, orcamentoParaGerar, yPosAposTotais);
        adicionarRodapePremium(doc, 1);

        // Página 2: Termos
        doc.addPage();
        adicionarTermosCondicoes(doc);
        adicionarRodapePremium(doc, 2);

        // Página 3: Apresentação
        doc.addPage();
        adicionarApresentacao(doc);
        adicionarRodapePremium(doc, 3);
        
        if (isPreview) {
            window.open(doc.output('bloburl'), '_blank');
        } else {
            doc.save(`Proposta Comercial ${cliente.nome} - Nº ${proposalId}.pdf`);
            alert('PDF da Proposta gerado com sucesso!');
        }

    } catch (error) {
        alert('Ocorreu um erro ao gerar o PDF da Proposta. Detalhes: ' + error.message);
        console.error('Erro ao gerar PDF:', error);
    }
}

// --- RELATÓRIOS DE MANUTENÇÃO (ATUALIZADO COM ASSINATURA DIGITAL) ---

function gerarRelatorioPDF(isPreview = false, manutencaoData = null) {
    try {
        // Usa o relatório passado ou o atual da memória
        let manutencaoParaGerar = manutencaoData;
        if (!manutencaoParaGerar && typeof currentManutencao !== 'undefined') {
            // Pega os dados do formulário se for o atual
            if(typeof salvarDadosManutencaoFormulario === 'function') salvarDadosManutencaoFormulario(); 
            manutencaoParaGerar = currentManutencao;
        }

        if (!manutencaoParaGerar || !manutencaoParaGerar.clienteId || manutencaoParaGerar.itens.length === 0) {
            alert('Dados insuficientes. Selecione um cliente e adicione itens ao relatório.');
            return;
        }

        const cliente = clientes.find(c => c.id === manutencaoParaGerar.clienteId);
        if (!cliente) { alert('Cliente não encontrado.'); return; }

        const doc = new window.jspdf.jsPDF();
        
        doc.setProperties({
            title: `Relatório Técnico - ${cliente.nome}`,
            subject: 'Relatório de Manutenção',
            author: 'GRUPO HENRI SISTEMAS'
        });

        // 1. Cabeçalho Específico de Manutenção
        let y = adicionarCabecalhoManutencao(doc, cliente, manutencaoParaGerar);

        // 2. Tabela de Itens (Serviços/Testes)
        const tableColumn = [
            {header: "ITEM / SERVIÇO / TESTE", dataKey: "descricao"},
            {header: "STATUS / RESULTADO", dataKey: "status"},
            {header: "DETALHES / OBSERVAÇÃO", dataKey: "obs"}
        ];

        const tableRows = manutencaoParaGerar.itens.map(item => ({
            descricao: item.descricao,
            status: item.status,
            obs: item.obs || '-'
        }));

        doc.autoTable({
            columns: tableColumn,
            body: tableRows,
            startY: y,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
            headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                descricao: { cellWidth: 80, fontStyle: 'bold' },
                status: { cellWidth: 40 },
                obs: { cellWidth: 'auto' }
            },
            didParseCell: function(data) {
                // Colorir texto baseado no status
                if (data.section === 'body' && data.column.dataKey === 'status') {
                    const statusText = data.cell.raw;
                    if (statusText.includes('OK') || statusText.includes('Funcionando')) {
                        data.cell.styles.textColor = [46, 204, 113]; // Verde
                        data.cell.styles.fontStyle = 'bold';
                    } else if (statusText.includes('Defeito') || statusText.includes('Pendente')) {
                        data.cell.styles.textColor = [231, 76, 60]; // Vermelho
                        data.cell.styles.fontStyle = 'bold';
                    } else if (statusText.includes('Reparado') || statusText.includes('Substituído')) {
                        data.cell.styles.textColor = [0, 51, 102]; // Azul
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        y = doc.lastAutoTable.finalY + 25;

        // 3. Validação Digital Profissional (Substitui Assinatura Física)
        if (y > 250) { doc.addPage(); y = 40; } // Quebra página se necessário

        // Caixa de fundo para a validação
        doc.setFillColor(248, 250, 252); // Fundo muito suave (quase branco/azulado)
        doc.setDrawColor(200, 200, 200); // Borda cinza claro
        doc.roundedRect(15, y, 180, 40, 2, 2, 'FD');

        // Título da Validação
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 51, 102); // Azul da marca
        doc.text("VALIDAÇÃO TÉCNICA DIGITAL", 105, y + 8, { align: 'center' });

        // Texto Profissional
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60); // Cinza escuro para leitura

        const textoValidacao = "Atestamos com total credibilidade, respeito e profissionalismo que os serviços descritos neste relatório foram executados sob a responsabilidade técnica de Carlos Henrique, representando a empresa Grupo Henri Sistemas. Este documento digital garante a segurança e a veracidade das informações registradas, dispensando assinatura física para fins de comprovação técnica.";
        
        const splitValidacao = doc.splitTextToSize(textoValidacao, 170);
        doc.text(splitValidacao, 105, y + 16, { align: 'center' });

        // Selo "Assinado Digitalmente" (Texto)
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | ID: ${manutencaoParaGerar.id || 'N/A'}`, 105, y + 36, { align: 'center' });

        // Rodapé
        adicionarRodapePremium(doc, 1);

        if (isPreview) {
            window.open(doc.output('bloburl'), '_blank');
        } else {
            const dataFile = manutencaoParaGerar.data.replace(/\//g, '-');
            doc.save(`Relatorio_Manutencao_${cliente.nome}_${dataFile}.pdf`);
            alert('Relatório gerado com sucesso!');
        }

    } catch (error) {
        console.error(error);
        alert("Erro ao gerar relatório: " + error.message);
    }
}

// --- FUNÇÕES AUXILIARES DE LAYOUT ---

function adicionarCabecalhoPremium(doc, cliente, orcamento) {
    const startY = 8;
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Faixa Azul
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Textos Empresa
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO HENRI SISTEMAS', pageWidth / 2, y + 7, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(255, 153, 0);
    doc.text('SEGURANÇA ELETRÔNICA', pageWidth / 2, y + 14, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Contato: 24 99223-2018 / 24 99296-9844 | CNPJ: 22.827.727/0001-80', pageWidth / 2, y + 22, { align: 'center' });
    
    y = 42;
    const clienteBoxHeight = 45;
    
    // Box Cliente
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 3, 3, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 3, 3, 'S');
    
    // Título Box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('PROPOSTA COMERCIAL', pageWidth / 2, y + 7, { align: 'center' });
    
    // Dados Cliente
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const lineSpacingCliente = 5.5;
    let clienteInfoY = y + 16;
    doc.text(`Cliente: ${cliente.nome}`, margin + 4, clienteInfoY);
    
    const servicosText = orcamento.servicos || 'Serviços de Segurança Eletrônica';
    clienteInfoY += lineSpacingCliente;
    doc.text(`Serviços: ${servicosText}`, margin + 4, clienteInfoY);
    
    if (cliente.telefone) {
        clienteInfoY += lineSpacingCliente;
        doc.text(`Telefone: ${cliente.telefone}`, margin + 4, clienteInfoY);
    }
    
    // Dados Proposta (Lado Direito)
    doc.setFontSize(8.5);
    doc.setTextColor(0, 51, 102);
    const proposalId = orcamento.id;
    doc.text(`Data: ${new Date(orcamento.data || Date.now()).toLocaleDateString('pt-BR')}`, pageWidth - margin - 4, y + 16, { align: 'right' });
    doc.text(`Proposta Nº: ${proposalId}`, pageWidth - margin - 4, y + 16 + lineSpacingCliente, { align: 'right' });
    doc.text(`Validade: 7 dias`, pageWidth - margin - 4, y + 16 + (2 * lineSpacingCliente), { align: 'right' });
    
    y += clienteBoxHeight + 8;
    return y;
}

function adicionarCabecalhoManutencao(doc, cliente, manutencao) {
    const startY = 8;
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Faixa Azul (Igual ao Orçamento para consistência)
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO HENRI SISTEMAS', pageWidth / 2, y + 7, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(255, 153, 0);
    doc.text('RELATÓRIOS TÉCNICOS', pageWidth / 2, y + 14, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Contato: 24 99223-2018 / 24 99296-9844 | CNPJ: 22.827.727/0001-80', pageWidth / 2, y + 22, { align: 'center' });

    y = 42;
    const infoBoxHeight = 40;
    
    // Box Info
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, pageWidth - 2*margin, infoBoxHeight, 3, 3, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - 2*margin, infoBoxHeight, 3, 3, 'S');

    // Título
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('RELATÓRIO DE MANUTENÇÃO TÉCNICA', pageWidth / 2, y + 8, { align: 'center' });

    // Dados da Visita (Organizados em colunas)
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    let infoY = y + 18;
    doc.text(`Cliente:`, margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cliente.nome}`, margin + 25, infoY);

    infoY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Endereço:`, margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cliente.endereco || 'Não informado'}`, margin + 25, infoY);

    // Linha divisória interna
    doc.setDrawColor(200);
    doc.line(margin + 5, infoY + 4, pageWidth - margin - 5, infoY + 4);

    // Dados Técnicos (Data, Hora, Tipo)
    infoY += 10;
    doc.setFont('helvetica', 'bold');
    
    // Coluna 1: Data
    doc.text(`Data da Visita:`, margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    const dataFormatada = new Date(manutencao.data).toLocaleDateString('pt-BR');
    doc.text(dataFormatada, margin + 35, infoY);

    // Coluna 2: Hora
    doc.setFont('helvetica', 'bold');
    doc.text(`Horário:`, margin + 70, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(manutencao.hora, margin + 90, infoY);

    // Coluna 3: Tipo
    doc.setFont('helvetica', 'bold');
    doc.text(`Tipo:`, margin + 120, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 51, 102); // Destaca o tipo em azul
    doc.text(manutencao.tipo.toUpperCase(), margin + 135, infoY);

    y += infoBoxHeight + 8;
    return y;
}

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
    y = doc.lastAutoTable.finalY + 4;
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
    
    // Verifica se cabe na página
    if (boxY + boxHeight > pageHeight - rodapeHeight - 5) {
      // Se não couber, usa a posição final da tabela (que já pode ter quebrado página)
      if (doc.lastAutoTable.finalY) { 
          boxY = doc.lastAutoTable.finalY + 3; 
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
    
    let textoRelatorio = orcamento.relatorio || 'Sem observações adicionais.';
    let textoPagamento = orcamento.formasPagamento || 'A combinar com o cliente.';
    let fontSizeInfo = 8.5;

    function adicionarSecaoTexto(titulo, texto, currentY) {
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
                doc.addPage();
                adicionarRodapePremium(doc, doc.internal.getCurrentPageInfo().pageNumber);
                currentY = 18;
                doc.setFontSize(9.5); // Repete título na nova página se quiser, ou continua texto
            }
            doc.text(line, margin, currentY);
            currentY += (fontSizeInfo * 0.352778 * 1.35);
        });
        currentY += 4;
        return currentY;
    }
    
    if (textoRelatorio.trim() !== 'Sem observações adicionais.' && textoRelatorio.trim() !== '') {
      y = adicionarSecaoTexto('OBSERVAÇÕES:', textoRelatorio, y);
    }
    if (y < pageHeight - rodapeHeight - 10 || (textoPagamento.trim() !== 'A combinar com o cliente.' && textoPagamento.trim() !== '')) {
       y = adicionarSecaoTexto('FORMA DE PAGAMENTO:', textoPagamento, y);
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
        { text: "SOBRE O ORÇAMENTO", style: "bold", spaceBefore: 5, spaceAfter: 3},
        
        { text: "Prazo de Garantia:", style: "bold"},
        { text: "O Grupo Henri Sistemas oferece garantia de até 3 (três) meses para a execução de todos os serviços prestados, contados a partir da data de conclusão.", style: "normal"},
        { text: "A garantia dos equipamentos segue os prazos e condições estabelecidos pelos respectivos fabricantes.", style: "normal"},
        { text: "Os serviços de garantia serão realizados exclusivamente nas dependências localizadas em Angra dos Reis – RJ.", style: "normal", spaceAfter: 3},
        { text: "Ressaltamos que o Grupo Henri Sistemas não se responsabiliza por danos oriundos de acidentes, negligência, uso inadequado dos equipamentos, bem como danos decorrentes de eventos fortuitos, força maior ou fenômenos naturais, tais como descargas elétricas, raios, vendavais, inundações e desabamentos.", style: "normal", spaceAfter: 5},
        
        { text: "Duração dos Trabalhos:", style: "bold"},
        { text: "O prazo para execução será definido em comum acordo com o cliente.", style: "normal"},
        { text: "Este cronograma pode ser impactado por fatores externos, como: problemas estruturais, dutos obstruídos, postes com estrutura inadequada, dificuldade de acesso aos pontos de distribuição, autorização da Prefeitura Municipal e de órgãos públicos ou privados necessários à execução dos serviços.", style: "normal", spaceAfter: 5},
        
        { text: "Observações importantes para execução do serviço:", style: "bold"},
        { text: "• Acesso livre aos locais de instalação", style: "normal", indent: 5},
        { text: "• Espaço adequado para acondicionamento dos equipamentos", style: "normal", indent: 5},
        { text: "• Infraestrutura disponível para passagem dos cabos", style: "normal", indent: 5},
        { text: "• Ponto de energia com tensão de 127V", style: "normal", indent: 5},
        { text: "• Acompanhamento de um responsável durante os testes", style: "normal", indent: 5, spaceAfter: 5},

        { text: "Início dos Trabalhos:", style: "bold"},
        { text: "• Em até 10 (dez) dias úteis após a confirmação de recebimento e aprovação do orçamento", style: "normal", indent: 5},
        { text: "• O presente orçamento tem validade de 7 (sete) dias corridos a contar da data de emissão", style: "normal", indent: 5, spaceAfter: 5},
        
        { text: "Estamos confiantes de que entregaremos um trabalho de excelência, caso nos seja confiada a execução do serviço.", style: "normal", spaceBefore: 2},
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
        "O Grupo Henri Sistemas atua há mais de 10 anos no segmento de Segurança Eletrônica e Digital na cidade de Angra dos Reis – RJ, consolidando-se como referência pela qualidade dos serviços prestados e pela busca contínua da satisfação total de nossos clientes.",
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
        "Diretor Técnico – Grupo Henri Sistemas",
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

// Utils de Formatação
function formatarMoeda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return 'R$ 0,00';
    return 'R$ ' + parseFloat(valor).toFixed(2).replace('.', ',');
}

function formatarNumeroSemSimbolo(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return '0,00';
    return parseFloat(valor).toFixed(2).replace('.', ',');
}