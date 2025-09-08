const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Função para formatar data em extenso
function formatDateExtenso(dataStr) {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const [ano, mes, dia] = dataStr.split('-'); // esperado "YYYY-MM-DD"
  return `${dia} de ${meses[parseInt(mes) - 1]} de ${ano}`;
}

// Função para gerar o PDF
// Função para gerar o PDF
async function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer); // ✅ retorna só o buffer, não grava no disco
    });

    // Cabeçalho
    pdfDoc.fontSize(14).text('INSPETORES GCM ATALAIA - AL / RELATÓRIOS DE PLANTÃO Report', {
      align: 'center'
    });
    pdfDoc.moveDown();

    // Criar "quadrado" com informações
    const startX = 50;
    const startY = 100;
    const boxWidth = 500;
    let cursorY = startY;

    // Desenhar quadrado
    pdfDoc.rect(startX, startY, boxWidth, 600).stroke();

    // Função auxiliar para escrever linha
    function writeLine(label, value) {
      pdfDoc.fontSize(11)
        .text(`${label}: ${value}`, startX + 10, cursorY + 10, { width: boxWidth - 20 });
      cursorY += 25;
    }

    // Campos principais
    writeLine('NOME', nome?.toUpperCase() || '-');
    writeLine('MATRÍCULA', matricula?.toUpperCase() || '-');
    writeLine('DATA INICIO', `${dataInicio || '-'}  HORA INÍCIO: ${horaInicio || '-'}`);
    writeLine('DATA SAÍDA', `${dataSaida || '-'}  HORA SAÍDA: ${horaSaida || '-'}`);

    // Objetos
    let objetosStr = '';
    if (objetos?.cones?.marcado) {
      objetosStr += `${objetos.cones.quantidade || 0} CONE(S) `;
    }
    Object.keys(objetos || {}).forEach(item => {
      if (item !== 'cones' && objetos[item]) {
        objetosStr += `${item.toUpperCase()} `;
      }
    });
    if (objetos['NENHUMA DAS OPÇÕES']?.marcado) {
      objetosStr += objetos['NENHUMA DAS OPÇÕES'].outros?.toUpperCase() || 'NENHUMA DAS OPÇÕES';
    }
    writeLine('OBJETOS ENCONTRADOS NA BASE', objetosStr || 'NENHUMA DAS OPÇÕES');

    // Patrulhamentos
    Object.keys(patrulhamento || {}).forEach(item => {
      const detalhes = patrulhamento[item]?.primeiro || '';
      writeLine('PATRULHAMENTO PREVENTIVO', `${item.toUpperCase()} ${detalhes.toUpperCase()}`);
    });

    // Ocorrências
    Object.keys(ocorrencias || {}).forEach(item => {
      const detalhes = ocorrencias[item]?.detalhes || '';
      writeLine('OCORRÊNCIA', `${item.toUpperCase()}: ${detalhes.toUpperCase()}`);
    });

    // Observações
    writeLine('OBSERVAÇÕES', observacoes?.toUpperCase() || '-');

    // Espaço extra
    cursorY += 20;
    writeLine('IMPORTAR FOTOS', '');

    // Rodapé com data/hora
    cursorY += 40;
    writeLine('Added Time', `${dataInicio} ${horaInicio}`);
    writeLine('Task Owner', 'gcmatalaiaal@gmail.com');

    pdfDoc.moveDown(2);
    pdfDoc.fontSize(9).text('Powered by Zoho Forms (simulação)', { align: 'center' });

    // Finalizar
    pdfDoc.end();
  });
}


// Função para gerar ZIP
function generateZIP(pdfBuffer, arquivos, nomeArquivoPDF) {
  return new Promise((resolve, reject) => {
    const zipChunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', chunk => zipChunks.push(chunk));
    archive.on('error', err => reject(err));
    archive.on('finish', () => resolve(Buffer.concat(zipChunks)));

    archive.append(pdfBuffer, { name: `${nomeArquivoPDF}.pdf` });

    if (arquivos.fotos) arquivos.fotos.forEach(f => archive.append(f.buffer, { name: `FOTOS/${f.originalname}` }));
    if (arquivos.videos) arquivos.videos.forEach(v => archive.append(v.buffer, { name: `VIDEOS/${v.originalname}` }));

    archive.finalize();
  });
}
app.post('/api/submit', upload.fields([{ name: 'fotos' }, { name: 'videos' }]), async (req, res) => {
  try {
    const {
      nome = '',
      matricula = '',
      dataInicio = '',
      horaInicio = '',
      dataSaida = '',
      horaSaida = '',
      observacoes = ''
    } = req.body;

    // Objetos
    let objetos = req.body.objetos ? (typeof req.body.objetos === 'string' ? JSON.parse(req.body.objetos) : req.body.objetos) : {};

    // Patrulhamento
    let patrulhamento = req.body.patrulhamento ? (typeof req.body.patrulhamento === 'string' ? JSON.parse(req.body.patrulhamento) : req.body.patrulhamento) : {};

    // Ocorrências
    let ocorrencias = req.body.ocorrencias ? (typeof req.body.ocorrencias === 'string' ? JSON.parse(req.body.ocorrencias) : req.body.ocorrencias) : {};

    if (objetos.cones?.quantidade) objetos.cones.quantidade = parseInt(objetos.cones.quantidade) || 0;

    // Debug no console
    console.log('OBJETOS RECEBIDOS:', objetos);
    console.log('PATRULHAMENTO RECEBIDO:', patrulhamento);
    console.log('OCORRÊNCIAS RECEBIDAS:', ocorrencias);

    // Extrair nomes das ocorrências selecionadas
    const nomesOcorrencias = Object.keys(ocorrencias).filter(item => ocorrencias[item]?.primeiro || ocorrencias[item]);
    console.log('Nomes das ocorrências selecionadas:', nomesOcorrencias);
console.log("OCORRÊNCIAS NO BACKEND:", ocorrencias);

    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes });

    const hoje = new Date();
    const dataAtual = `${hoje.getDate().toString().padStart(2,'0')}-${(hoje.getMonth()+1).toString().padStart(2,'0')}-${hoje.getFullYear()}`;
    const arquivoNome = `${matricula}-${dataAtual}`;

    const zipBuffer = await generateZIP(pdfBuffer, req.files, arquivoNome);

    if (zipBuffer.length > MAX_EMAIL_SIZE) {
      return res.status(400).json({ error: 'Arquivo muito grande para envio por e-mail. Apenas PDF será enviado.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'enviorforms@gmail.com',
        pass: 'lgni quba jihs zgox'
      }
    });

    await transporter.sendMail({
      from: '"RELATÓRIO AUTOMÁTICO" <enviorforms@gmail.com>',
      to: 'ruanmarcos1771@gmail.com',
      subject: `RELATÓRIO: ${arquivoNome}`,
      text: 'Segue em anexo o relatório em ZIP.',
      attachments: [{ filename: `${arquivoNome}.zip`, content: zipBuffer }]
    });

    return res.status(200).json({ message: 'Relatório enviado por e-mail com sucesso!' });

  } catch (err) {
    console.error('Erro no backend:', err);
    return res.status(500).json({ error: 'Erro ao gerar ou enviar o relatório' });
  }
});

module.exports = app;
