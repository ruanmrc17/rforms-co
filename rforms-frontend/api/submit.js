// /api/submit.js
const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

// Limite máximo do Gmail ~25MB
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

// Multer em memória
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Função para gerar PDF em memória
function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, observacoes }) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument();
    const chunks = [];

    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    pdfDoc.fontSize(18).text('RELATÓRIO DE PLANTÃO', { align: 'center' });
    pdfDoc.moveDown();
    pdfDoc.fontSize(12).text(`NOME: ${nome?.toUpperCase() || '-'}`);
    pdfDoc.text(`MATRÍCULA: ${matricula?.toUpperCase() || '-'}`);
    pdfDoc.text(`DATA INÍCIO: ${dataInicio || '-'} - HORA: ${horaInicio || '-'}`);
    pdfDoc.text(`DATA SAÍDA: ${dataSaida || '-'} - HORA: ${horaSaida || '-'}`);
    pdfDoc.moveDown();

    pdfDoc.text('OBJETOS ENCONTRADOS NA BASE:');
    Object.keys(objetos).forEach(item => {
      if (objetos[item]) pdfDoc.text(`- ${item.toUpperCase()}`);
    });

    pdfDoc.moveDown();
    pdfDoc.text('PATRULHAMENTO PREVENTIVO:');
    Object.keys(patrulhamento).forEach(distrito => {
      const nomes = patrulhamento[distrito];
      pdfDoc.text(`- ${distrito.toUpperCase()}: ${nomes?.primeiro?.toUpperCase() || ''}`);
    });

    pdfDoc.moveDown();
    pdfDoc.text('OBSERVAÇÕES:');
    pdfDoc.text(observacoes?.toUpperCase() || '-');

    pdfDoc.end();
  });
}

// Função para criar ZIP em memória
function generateZIP(pdfBuffer, arquivos) {
  return new Promise((resolve, reject) => {
    const zipChunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', chunk => zipChunks.push(chunk));
    archive.on('error', err => reject(err));
    archive.on('finish', () => resolve(Buffer.concat(zipChunks)));

    // Adicionar PDF
    archive.append(pdfBuffer, { name: 'RELATORIO.pdf' });

    // Adicionar fotos e vídeos
    if (arquivos.fotos) arquivos.fotos.forEach(f => archive.append(f.buffer, { name: `FOTOS/${f.originalname}` }));
    if (arquivos.videos) arquivos.videos.forEach(v => archive.append(v.buffer, { name: `VIDEOS/${v.originalname}` }));

    archive.finalize();
  });
}
// Rota POST /api/submit
app.post('/submit', upload.fields([{ name: 'fotos' }, { name: 'videos' }]), async (req, res) => {
  try {
    const { nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, observacoes } = req.body;
    const objetos = JSON.parse(req.body.objetos || '{}');
    const patrulhamento = JSON.parse(req.body.patrulhamento || '{}');

    // Gerar PDF
    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, observacoes });

    // Nome baseado em matrícula e data atual
    const hoje = new Date();
    const dataAtual = `${hoje.getDate().toString().padStart(2, '0')}-${(hoje.getMonth()+1).toString().padStart(2, '0')}-${hoje.getFullYear()}`;
    const arquivoNome = `${matricula}-${dataAtual}`;

    // Gerar ZIP com PDF e arquivos
    const zipBuffer = await new Promise((resolve, reject) => {
      const zipChunks = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', chunk => zipChunks.push(chunk));
      archive.on('error', err => reject(err));
      archive.on('finish', () => resolve(Buffer.concat(zipChunks)));

      // Adicionar PDF com nome personalizado
      archive.append(pdfBuffer, { name: `${arquivoNome}.pdf` });

      // Adicionar fotos e vídeos
      if (req.files.fotos) req.files.fotos.forEach(f => archive.append(f.buffer, { name: `FOTOS/${f.originalname}` }));
      if (req.files.videos) req.files.videos.forEach(v => archive.append(v.buffer, { name: `VIDEOS/${v.originalname}` }));

      archive.finalize();
    });

    // Verificar tamanho antes de enviar
    if (zipBuffer.length > MAX_EMAIL_SIZE) {
      return res.status(400).json({ error: 'Arquivo muito grande para envio por e-mail. Apenas PDF será enviado.' });
    }

    // Configuração do Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'enviorforms@gmail.com',
        pass: 'lgni quba jihs zgox' // senha de app
      }
    });

    // Enviar email com ZIP
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


// Export padrão para Vercel
module.exports = app;
