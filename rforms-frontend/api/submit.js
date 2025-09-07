// /api/submit.js
const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Função para gerar PDF
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

    // OBJETOS
    pdfDoc.text('OBJETOS ENCONTRADOS NA BASE:');

    // Cones
    if (objetos.cones?.marcado) {
      const qtd = parseInt(objetos.cones.quantidade) || 0;
      pdfDoc.text(`- ${qtd} CONE(S)`);
    }

    // Outros objetos
    Object.keys(objetos).forEach(item => {
      if (item !== 'cones' && objetos[item]) {
        pdfDoc.text(`- ${item.toUpperCase()}`);
      }
    });

    // PATRULHAMENTO
    pdfDoc.moveDown();
    pdfDoc.text('PATRULHAMENTO PREVENTIVO:');
    Object.keys(patrulhamento).forEach(distrito => {
      const nomes = patrulhamento[distrito];
      pdfDoc.text(`- ${distrito.toUpperCase()}: ${nomes?.primeiro?.toUpperCase() || ''}`);
    });

    // OBSERVAÇÕES
    pdfDoc.moveDown();
    pdfDoc.text('OBSERVAÇÕES:');
    pdfDoc.text(observacoes?.toUpperCase() || '-');

    pdfDoc.end();
  });
}

// Função para criar ZIP
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
    // Extrair campos do FormData
    const {
      nome = '',
      matricula = '',
      dataInicio = '',
      horaInicio = '',
      dataSaida = '',
      horaSaida = '',
      observacoes = ''
    } = req.body;

    // OBJETOS e PATRULHAMENTO podem vir como string JSON ou objeto
    let objetos = {};
    let patrulhamento = {};

    if (req.body.objetos) {
      if (typeof req.body.objetos === 'string') objetos = JSON.parse(req.body.objetos);
      else objetos = req.body.objetos;
    }

    if (req.body.patrulhamento) {
      if (typeof req.body.patrulhamento === 'string') patrulhamento = JSON.parse(req.body.patrulhamento);
      else patrulhamento = req.body.patrulhamento;
    }

    // Garantir que quantidade de cones seja número
    if (objetos.cones?.quantidade) objetos.cones.quantidade = parseInt(objetos.cones.quantidade) || 0;

    // Debug: log do que chegou
    console.log('OBJETOS:', objetos);
    console.log('PATRULHAMENTO:', patrulhamento);

    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, observacoes });

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
