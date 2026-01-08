/**
 * Gerador de PDF Profissional para o Sistema Grupo Henriques
 * Atualizado com Logo no Cabeçalho e Marca D'água
 */

// Função auxiliar para carregar a imagem e converter para DataURL (necessário para o jsPDF)
function carregarLogo(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Necessário se a imagem vier de outro domínio, boa prática manter
        img.src = url;
        img.onload = () => {
            // Cria um canvas para desenhar a imagem e extrair os dados
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                const dataURL = canvas.toDataURL('image/png');
                resolve({ data: dataURL, width: img.width, height: img.height, ok: true });
            } catch (e) {
                console.warn("Erro ao processar logo:", e);
                resolve({ ok: false });
            }
        };
        img.onerror = () => {
            console.warn("Logo não encontrada em: " + url);
            resolve({ ok: false });
        };
    });
}

// Função principal transformada em ASYNC para aguardar o carregamento da logo
async function gerarPDF(isPreview = false, orcamentoData = null) {
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

        if (typeof window.jspdf === 'undefined') {
            alert('Erro: Biblioteca jsPDF não carregada.');
            return;
        }

        // Feedback visual simples (opcional, já que é rápido)
        document.body.style.cursor = 'wait';

        // 1. Carrega a Logo antes de começar
        const logoInfo = await carregarLogo('assets/HENRI LOGO.svg');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const proposalId = orcamentoParaGerar.id || 'Novo';

        doc.setProperties({
            title: `Proposta Comercial ${cliente.nome} - Nº ${proposalId}`,
            subject: 'Proposta Comercial GRUPO HENRI SISTEMAS',
            author: 'GRUPO HENRI SISTEMAS',
            creator: 'Sistema de Orçamentos'
        });

        // --- GERAÇÃO DAS PÁGINAS ---

        // Página 1
        adicionarMarcaDagua(doc, logoInfo); // Adiciona marca d'água no fundo
        let yPosAposCabecalho = adicionarCabecalhoPremium(doc, cliente, orcamentoParaGerar, logoInfo);
        let yPosAposItens = adicionarItensOrcamentoPremium(doc, orcamentoParaGerar, yPosAposCabecalho, logoInfo); // Passa logoInfo se precisar desenhar em novas páginas
        let yPosAposTotais = adicionarTotaisPremium(doc, orcamentoParaGerar, yPosAposItens);
        
        adicionarInformacoesAdicionaisPremium(doc, orcamentoParaGerar, yPosAposTotais);
        adicionarRodapePremium(doc, 1);

        // Página 2 (Termos)
        doc.addPage();
        adicionarMarcaDagua(doc, logoInfo);
        adicionarTermosCondicoes(doc);
        adicionarRodapePremium(doc, 2);

        // Página 3 (Apresentação)
        doc.addPage();
        adicionarMarcaDagua(doc, logoInfo);
        adicionarApresentacao(doc);
        adicionarRodapePremium(doc, 3);
        
        document.body.style.cursor = 'default';

        if (isPreview) {
            window.open(doc.output('bloburl'), '_blank');
        } else {
            // Sanitiza o nome do arquivo
            const servicoTitulo = orcamentoParaGerar.servicos ? orcamentoParaGerar.servicos.replace(/[^a-zA-Z0-9à-úÀ-Ú \-_]/g, "").trim() : "Orcamento";
            const nomeArquivo = `${servicoTitulo} - ${proposalId}.pdf`;
            doc.save(nomeArquivo);
            // alert('PDF gerado com sucesso!'); // Removido para fluxo mais limpo
        }

    } catch (error) {
        document.body.style.cursor = 'default';
        alert('Ocorreu um erro ao gerar o PDF. Detalhes no console.');
        console.error('Erro ao gerar PDF:', error);
    }
}

/**
 * Adiciona a Marca D'água centralizada com transparência
 */
function adicionarMarcaDagua(doc, logoInfo) {
    if (!logoInfo.ok) return;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = 100; // Tamanho da marca d'água
    // Calcula proporção para manter aspect ratio
    const ratio = logoInfo.width / logoInfo.height;
    const imgHeight = imgWidth / ratio;

    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    // Salva o estado atual (cores, transparência)
    doc.saveGraphicsState();
    
    // Define transparência (Alpha) bem baixa para ser discreto (0.05 a 0.1)
    doc.setGState(new doc.GState({ opacity: 0.08 })); 
    
    doc.addImage(logoInfo.data, 'PNG', x, y, imgWidth, imgHeight);

    // Restaura o estado para não afetar o resto do texto
    doc.restoreGraphicsState();
}

// --- Funções de Layout ---

function adicionarCabecalhoPremium(doc, cliente, orcamento, logoInfo) {
    const startY = 0; // Começa do topo absoluto para a tarja
    let y = startY;
    const pageWidth = doc.internal.pageSize.getWidth();
    const headerHeight = 35; // Altura da tarja azul

    // 1. Fundo do Cabeçalho (Tarja Azul Escura)
    doc.setFillColor(15, 0, 23); // Cor #0f0017 do tema (Dark Neon) ou Azul #003366
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // 2. Logo no Cabeçalho (Esquerda)
    if (logoInfo.ok) {
        const logoSize = 24; // Tamanho da logo no header
        const marginLogo = 10;
        const logoY = (headerHeight - logoSize) / 2; // Centralizar verticalmente na tarja

        // Efeito "Badge" Branco (Círculo de fundo para destacar a logo escura/colorida na tarja escura)
        doc.setFillColor(255, 255, 255);
        // Desenha um círculo branco atrás da logo
        doc.circle(marginLogo + (logoSize/2), logoY + (logoSize/2), (logoSize/2) + 2, 'F'); 

        // Desenha a logo sobre o círculo branco
        doc.addImage(logoInfo.data, 'PNG', marginLogo, logoY, logoSize, logoSize);
    }

    // 3. Textos do Cabeçalho (Centralizados e Direita)
    // Ajuste: Deslocar textos um pouco se tiver logo, mas manter alinhamento central da página fica elegante
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO HENRI SISTEMAS', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 188, 212); // Ciano Neon para destaque
    doc.text('SEGURANÇA ELETRÔNICA', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(220, 220, 220);
    doc.text('CNPJ: 22.827.727/0001-80 | Contato: (24) 99223-2018 / 99296-9844', pageWidth / 2, 27, { align: 'center' });

    // 4. Box de Dados do Cliente
    y = headerHeight + 8;
    const margin = 15;
    const clienteBoxHeight = 40; // Altura um pouco menor para ficar compacto

    // Fundo cinza bem claro para o box do cliente
    doc.setFillColor(248, 249, 250); 
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, pageWidth - 2*margin, clienteBoxHeight, 2, 2, 'FD'); // Fill and Draw

    // Título do Box
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102); // Azul escuro
    doc.text('DADOS DO CLIENTE', margin + 5, y + 8);

    // Linha divisória sutil
    doc.setDrawColor(220, 220, 220);
    doc.line(margin + 5, y + 10, pageWidth - margin - 5, y + 10);

    // Conteúdo do Cliente
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    let infoY = y + 16;
    const lineH = 5;

    // Coluna Esquerda
    doc.text(`Cliente: ${cliente.nome}`, margin + 5, infoY);
    if(cliente.cpfCnpj) {
        // Se couber, coloca ao lado, senão em baixo (simples aqui: em baixo para garantir)
        // Mas vamos tentar otimizar espaço
    }
    
    // Serviços / Objeto (Importante)
    infoY += lineH;
    let servicoTxt = orcamento.servicos || 'Serviços de Segurança Eletrônica';
    if(servicoTxt.length > 50) servicoTxt = servicoTxt.substring(0, 50) + "...";
    doc.text(`Objeto: ${servicoTxt}`, margin + 5, infoY);

    infoY += lineH;
    const contatoTxt = [cliente.telefone, cliente.email].filter(Boolean).join(' | ');
    doc.text(`Contato: ${contatoTxt || 'Não informado'}`, margin + 5, infoY);

    if (cliente.endereco) {
        infoY += lineH;
        doc.text(`Endereço: ${cliente.endereco}`, margin + 5, infoY);
    }

    // Coluna Direita (Dados da Proposta) - Alinhado à direita dentro do box
    let rightX = pageWidth - margin - 5;
    let rightY = y + 16;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Orçamento Nº: ${orcamento.id}`, rightX, rightY, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    rightY += lineH;
    const dataEmissao = orcamento.data ? new Date(orcamento.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    doc.text(`Data: ${dataEmissao}`, rightX, rightY, { align: 'right' });
    
    rightY += lineH;
    doc.text(`Validade: 07 Dias`, rightX, rightY, { align: 'right' });

    return y + clienteBoxHeight + 10;
}

function adicionarItensOrcamentoPremium(doc, orcamento, startY, logoInfo) {
    let y = startY;
    const margin = 15;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('DETALHAMENTO TÉCNICO E VALORES', margin, y);
    y += 5;

    const tableColumn = [
        {header: "ITEM / DESCRIÇÃO", dataKey: "produto"},
        {header: "QTD", dataKey: "quantidade"},
        {header: "UNIT. (R$)", dataKey: "unitario"}, 
        {header: "TOTAL (R$)", dataKey: "total"}
    ];
    
    const tableRows = orcamento.itens.map(item => ({
        produto: item.produtoNome,
        quantidade: item.quantidade,
        unitario: formatarNumeroSemSimbolo(item.valor),
        total: formatarNumeroSemSimbolo(item.quantidade * item.valor)
    }));
    
    if (orcamento.maoDeObra > 0) {
        tableRows.push({
            produto: {content: "MÃO DE OBRA ESPECIALIZADA / SERVIÇOS TÉCNICOS", colSpan: 3, styles: {fontStyle: 'bold', fillColor: [240, 240, 240]}},
            total: {content: formatarNumeroSemSimbolo(orcamento.maoDeObra), styles: {fontStyle: 'bold', fillColor: [240, 240, 240]}}
        });
    }

    doc.autoTable({
        columns: tableColumn, 
        body: tableRows, 
        startY: y, 
        margin: {left: margin, right: margin},
        theme: 'striped',
        styles: { 
            fontSize: 9, 
            cellPadding: 3, 
            overflow: 'linebreak', 
            lineColor: [220, 220, 220], 
            lineWidth: 0.1,
            valign: 'middle'
        },
        headerStyles: { 
            fillColor: [15, 0, 23], // Header da tabela combinando com o tema
            textColor: [255, 255, 255], 
            fontStyle: 'bold', 
            halign: 'center' 
        },
        columnStyles: { 
            produto: {cellWidth: 'auto', halign: 'left'}, 
            quantidade: {cellWidth: 15, halign: 'center'}, 
            unitario: {cellWidth: 25, halign: 'right'}, 
            total: {cellWidth: 30, halign: 'right'} 
        },
        // Reaplica a marca d'água se a tabela quebrar página
        didDrawPage: function(data) { 
            adicionarMarcaDagua(doc, logoInfo);
            adicionarRodapePremium(doc, data.pageNumber); 
        }
    });
    
    return doc.lastAutoTable.finalY + 5;
}

function adicionarTotaisPremium(doc, orcamento, startY) {
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Evita quebra de página ruim para o bloco de totais
    if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 20;
    }

    const totalProdutos = orcamento.itens.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
    const totalGeral = totalProdutos + (orcamento.maoDeObra || 0);
    
    // Caixa de Totais à Direita
    const boxWidth = 80;
    const xBox = pageWidth - margin - boxWidth;
    
    doc.setFillColor(245, 245, 245);
    doc.rect(xBox, y, boxWidth, 25, 'F'); // Fundo leve
    
    // Linha final
    doc.setDrawColor(0, 188, 212); // Ciano neon do tema
    doc.setLineWidth(0.5);
    doc.line(xBox, y, xBox + boxWidth, y); // Linha topo
    doc.line(xBox, y + 25, xBox + boxWidth, y + 25); // Linha base

    let currentY = y + 8;
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Soma dos Produtos:', xBox + 5, currentY);
    doc.text(formatarMoeda(totalProdutos), pageWidth - margin - 5, currentY, {align: 'right'});
    
    currentY += 10;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DA PROPOSTA:', xBox + 5, currentY);
    doc.setTextColor(0, 51, 102);
    doc.text(formatarMoeda(totalGeral), pageWidth - margin - 5, currentY, {align: 'right'});

    return y + 30; // Retorna Y abaixo do box
}

function adicionarInformacoesAdicionaisPremium(doc, orcamento, startY) {
    let y = startY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const width = pageWidth - (2 * margin);

    // Se tiver pouco espaço, nova página
    if (y > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        y = 20;
    }

    // Condições de Pagamento e Obs
    doc.setFontSize(10);
    doc.setTextColor(0, 51, 102);
    doc.setFont('helvetica', 'bold');
    
    if (orcamento.formasPagamento) {
        doc.text('CONDIÇÕES DE PAGAMENTO:', margin, y);
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        const linesPgto = doc.splitTextToSize(orcamento.formasPagamento, width);
        doc.text(linesPgto, margin, y);
        y += (linesPgto.length * 5) + 5;
    }

    if (orcamento.relatorio) {
        doc.setFontSize(10);
        doc.setTextColor(0, 51, 102);
        doc.setFont('helvetica', 'bold');
        doc.text('OBSERVAÇÕES:', margin, y);
        y += 5;
        
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        const linesObs = doc.splitTextToSize(orcamento.relatorio, width);
        doc.text(linesObs, margin, y);
        y += (linesObs.length * 5);
    }
}

function adicionarTermosCondicoes(doc) {
    const margin = 15;
    let y = 20;
    const contentWidth = doc.internal.pageSize.getWidth() - (2 * margin);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('TERMOS E CONDIÇÕES GERAIS', margin, y);
    
    // Linha decorativa
    doc.setDrawColor(0, 188, 212);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 2, margin + 85, y + 2);
    
    y += 12;

    const termos = [
        { title: "1. Prazo de Garantia", text: "O Grupo Henri Sistemas oferece garantia de 3 (três) meses para a mão de obra dos serviços prestados. A garantia dos equipamentos segue estritamente os prazos e políticas dos respectivos fabricantes." },
        { title: "2. Exclusões da Garantia", text: "A garantia não cobre danos causados por mau uso, acidentes, descargas elétricas, variações de tensão, raios, inundações ou intervenção de terceiros não autorizados." },
        { title: "3. Validade da Proposta", text: "Os valores apresentados neste orçamento são válidos por 7 (sete) dias corridos a partir da data de emissão, sujeitos a reajuste após este período." },
        { title: "4. Execução dos Serviços", text: "O cliente deve fornecer as condições necessárias para a execução (acesso ao local, energia elétrica 127V/220V, infraestrutura civil se não inclusa). O prazo de início será agendado mediante aprovação e disponibilidade de agenda." },
        { title: "5. Pagamento", text: "O não pagamento nas datas acordadas acarretará multa de 2% e juros de mora de 1% ao mês, além de suspensão da garantia até regularização." }
    ];
    
    termos.forEach(item => {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(item.title, margin, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        
        const lines = doc.splitTextToSize(item.text, contentWidth);
        doc.text(lines, margin, y);
        y += (lines.length * 4.5) + 6; // Espaço para próximo item
    });
}

function adicionarApresentacao(doc) {
    const margin = 15;
    let y = 25;
    const contentWidth = doc.internal.pageSize.getWidth() - (2 * margin);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('SOBRE NÓS', margin, y);
    y += 10;

    const texto = [
        "O GRUPO HENRI SISTEMAS é referência em soluções de Segurança Eletrônica em Angra dos Reis e região. Com anos de experiência, nosso compromisso é proteger seu patrimônio com tecnologia de ponta e serviço de excelência.",
        "Nossa equipe técnica é altamente qualificada e passa por constantes atualizações para entregar instalações limpas, seguras e duráveis.",
        "Trabalhamos com as melhores marcas do mercado (Intelbras, Hikvision, JFL, etc), garantindo confiabilidade e tranquilidade para sua residência ou empresa.",
        "",
        "Agradecemos a oportunidade de apresentar esta proposta e nos colocamos à inteira disposição para quaisquer dúvidas."
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const lineHeight = 6;

    texto.forEach(paragrafo => {
        const lines = doc.splitTextToSize(paragrafo, contentWidth);
        doc.text(lines, margin, y);
        y += (lines.length * lineHeight) + 2;
    });

    y += 15;
    
    // Assinatura Digital Simulada
    doc.setDrawColor(150);
    doc.line(margin, y, margin + 80, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("Carlos Henrique dos Santos", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Diretor Técnico - Grupo Henri Sistemas", margin, y);
}

function adicionarRodapePremium(doc, pageNum) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const h = 12; 
    const y = pageHeight - h;

    doc.setFillColor(240, 240, 240); // Rodapé cinza claro
    doc.rect(0, y, pageWidth, h, 'F');

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    
    const textoRodape = "Grupo Henri Sistemas | Segurança Eletrônica e Automação | www.grupohenrisistemas.com.br"; // Exemplo
    doc.text(textoRodape, marginX = 15, y + 8);
    
    doc.text(`Página ${pageNum}`, pageWidth - 20, y + 8, { align: 'right' });
}

// Utilitários
function formatarMoeda(valor) {
    return 'R$ ' + parseFloat(valor || 0).toFixed(2).replace('.', ',');
}

function formatarNumeroSemSimbolo(valor) {
    return parseFloat(valor || 0).toFixed(2).replace('.', ',');
        }
    
