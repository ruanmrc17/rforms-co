// /api/submit.js
const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const serverless = require('serverless-http');

const app = express();

// Limite máximo do Gmail ~25MB
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

// Multer em memória
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middlewares
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

// Rota POST /submit
app.post('/submit', (req, res) => {
  console.log('Recebido:', req.body);
  console.log('Arquivos:', req.files);
  res.status(200).json({ message: 'Funcionando!' });
});

// Export serverless handler para Vercel
module.exports.handler = serverless(app);
