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

function generatePDF(data) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    let pageNumber = 1;

    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    function addPage() {
      if (pageNumber > 1) pdfDoc.addPage();
      pdfDoc.fontSize(10).text(`Página ${pageNumber}`, pdfDoc.page.width - 70, pdfDoc.page.height - 30);
      pageNumber++;
    }

    function addTextBlock(text) {
      if (!text) return;
      const lines = text.split('\n');
      lines.forEach(line => {
        if (pdfDoc.y > pdfDoc.page.height - 80) addPage();
        pdfDoc.text(line, { width: 500 });
      });
    }

    // Primeira página
    addPage();

    // Logo (opcional)
    try {
      const logoPath = path.join(__dirname, 'seglogoata.jpg');
      pdfDoc.image(logoPath, 450, 15, { width: 100 });
    } catch {}

    // Títulos
    pdfDoc.fontSize(18).text('RELATÓRIO DIÁRIO DE PLANTÃO', { align: 'center' });
    pdfDoc.fontSize(10).text('INSPETORES GCM ATALAIA - AL', { align: 'center' });
    pdfDoc.fontSize(10).text('SECRETARIA DE DEFESA SOCIAL', { align: 'center' });
    pdfDoc.fontSize(10).text('GUARDA CIVIL MUNICIPAL DE ATALAIA - AL', { align: 'center' });
    pdfDoc.moveDown();

    // Informações principais
    pdfDoc.fontSize(12).text(`NOME: ${data.nome || '-'}`);
    pdfDoc.text(`MATRÍCULA: ${data.matricula || '-'}`);
    pdfDoc.text(`DATA INÍCIO: ${data.dataInicio || '-'} - HORA INÍCIO: ${data.horaInicio || '-'}`);
    pdfDoc.text(`DATA SAÍDA: ${data.dataSaida || '-'} - HORA SAÍDA: ${data.horaSaida || '-'}`);
    pdfDoc.moveDown();

    // Objetos
    pdfDoc.text('OBJETOS ENCONTRADOS NA BASE:');
    if (data.objetos?.cones?.marcado) {
      const qtd = parseInt(data.objetos.cones.quantidade) || 0;
      pdfDoc.text(`- ${qtd} CONE(S)`);
    }
    Object.keys(data.objetos || {}).forEach(item => {
      if (item !== 'cones' && item !== 'NENHUMA DAS OPÇÕES' && data.objetos[item]) {
        pdfDoc.text(`- ${item}`);
      }
    });
    if (data.objetos?.['NENHUMA DAS OPÇÕES']?.marcado && data.objetos['NENHUMA DAS OPÇÕES'].outros) {
      pdfDoc.text(`- ${data.objetos['NENHUMA DAS OPÇÕES'].outros}`);
    }

    // Patrulhamento
    pdfDoc.moveDown();
    pdfDoc.text('PATRULHAMENTO PREVENTIVO:');
    Object.keys(data.patrulhamento || {}).forEach(item => {
      addTextBlock(`- ${item}: ${data.patrulhamento[item]?.primeiro || ''}`);
    });

    // Ocorrências
    pdfDoc.moveDown();
    pdfDoc.text('OCORRÊNCIAS:');
    Object.keys(data.ocorrencias || {}).forEach(item => {
      addTextBlock(`- ${item}: ${data.ocorrencias[item]?.detalhes || ''}`);
    });

    // Observações
    pdfDoc.moveDown();
    pdfDoc.text('OBSERVAÇÕES:');
    addTextBlock(data.observacoes || '-');

    pdfDoc.end();
  });
}

// ZIP generator (igual antes)
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

// Endpoint
app.post('/api/submit', upload.fields([{ name: 'fotos' }, { name: 'videos' }]), async (req, res) => {
  try {
    const { nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, observacoes } = req.body;

    let objetos = req.body.objetos ? (typeof req.body.objetos === 'string' ? JSON.parse(req.body.objetos) : req.body.objetos) : {};
    let patrulhamento = req.body.patrulhamento ? (typeof req.body.patrulhamento === 'string' ? JSON.parse(req.body.patrulhamento) : req.body.patrulhamento) : {};
    let ocorrencias = req.body.ocorrencias ? (typeof req.body.ocorrencias === 'string' ? JSON.parse(req.body.ocorrencias) : req.body.ocorrencias) : {};

    if (objetos.cones?.quantidade) objetos.cones.quantidade = parseInt(objetos.cones.quantidade) || 0;

    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes });

    const hoje = new Date();
    const dataAtual = `${hoje.getDate().toString().padStart(2,'0')}-${(hoje.getMonth()+1).toString().padStart(2,'0')}-${hoje.getFullYear()}`;
    const arquivoNome = `${matricula}-${dataAtual}`;

    const zipBuffer = await generateZIP(pdfBuffer, req.files, arquivoNome);

    if (zipBuffer.length > MAX_EMAIL_SIZE) return res.status(400).json({ error: 'Arquivo muito grande para envio por e-mail. Apenas PDF será enviado.' });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: 'enviorforms@gmail.com', pass: 'lgni quba jihs zgox' }
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
