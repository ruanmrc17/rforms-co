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

// Função para gerar PDF
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, 'fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, 'fonts/Roboto-Bold.ttf'),
    italics: path.join(__dirname, 'fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, 'fonts/Roboto-BoldItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);

async function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [50, 70, 50, 50],
    header: {
      margin: [50, 20, 50, 0],
      columns: [
        { text: 'RELATÓRIO DIÁRIO DE PLANTÃO', alignment: 'center', fontSize: 16, bold: true },
      ]
    },
    footer: (currentPage, pageCount) => {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        fontSize: 10,
        margin: [0, 0, 0, 10]
      };
    },
    content: [
      { text: 'INSPETORES GCM ATALAIA - AL', alignment: 'center', fontSize: 10 },
      { text: 'SECRETARIA DE DEFESA SOCIAL', alignment: 'center', fontSize: 10 },
      { text: 'GUARDA CIVIL MUNICIPAL DE ATALAIA - AL', alignment: 'center', fontSize: 10 },
      { text: '\n' },
      { text: `NOME: ${nome?.toUpperCase() || '-'}` },
      { text: `MATRÍCULA: ${matricula?.toUpperCase() || '-'}` },
      { text: `DATA INÍCIO: ${dataInicio || '-'} - HORA INÍCIO: ${horaInicio || '-'}` },
      { text: `DATA SAÍDA: ${dataSaida || '-'} - HORA SAÍDA: ${horaSaida || '-'}` },
      { text: '\nOBJETOS ENCONTRADOS NA BASE:', bold: true },
      ...Object.keys(objetos).map(item => {
        if (item === 'cones' && objetos.cones?.marcado) return `- ${objetos.cones.quantidade || 0} CONE(S)`;
        if (item === 'NENHUMA DAS OPÇÕES' && objetos[item]?.marcado && objetos[item].outros) return `- ${objetos[item].outros.toUpperCase()}`;
        if (objetos[item]) return `- ${item.toUpperCase()}`;
      }).filter(Boolean),
      { text: '\nPATRULHAMENTO PREVENTIVO:', bold: true },
      ...Object.keys(patrulhamento).map(item => `- ${item.toUpperCase()}: ${patrulhamento[item]?.primeiro || ''}`),
      { text: '\nOCORRÊNCIAS:', bold: true },
      ...Object.keys(ocorrencias).map(item => `- ${item.toUpperCase()}: ${ocorrencias[item]?.detalhes || ''}`),
      { text: '\nOBSERVAÇÕES:', bold: true },
      { text: observacoes || '-' }
    ]
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  return new Promise((resolve, reject) => {
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
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
