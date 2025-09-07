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
function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, observacoes }) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    // Logo no canto superior direito
    const logoPath = path.join(__dirname, 'seglogoata.jpg');
    pdfDoc.image(logoPath, 450, 15, { width: 100 });

    // Título e subtítulo centralizados
    pdfDoc.fontSize(18).text('RELATÓRIO DE PLANTÃO', { align: 'center' });
    pdfDoc.fontSize(10).text('INSPETORES GCM ATALAIA - AL', { align: 'center' });
    pdfDoc.moveDown();

    // Informações principais
    pdfDoc.fontSize(12).text(`NOME: ${nome?.toUpperCase() || '-'}`);
    pdfDoc.text(`MATRÍCULA: ${matricula?.toUpperCase() || '-'}`);
    pdfDoc.text(`DATA INÍCIO: ${dataInicio || '-'} - HORA: ${horaInicio || '-'}`);
    pdfDoc.text(`DATA SAÍDA: ${dataSaida || '-'} - HORA: ${horaSaida || '-'}`);
    pdfDoc.moveDown();

    // OBJETOS
    pdfDoc.text('OBJETOS ENCONTRADOS NA BASE:');
    if (objetos.cones?.marcado) {
      const qtd = parseInt(objetos.cones.quantidade) || 0;
      pdfDoc.text(`- ${qtd} CONE(S)`);
    }

    Object.keys(objetos).forEach(item => {
      if (item !== 'cones' && item !== 'NENHUMA DAS OPÇÕES' && objetos[item]) {
        pdfDoc.text(`- ${item.toUpperCase()}`);
      }
    });

    if (objetos['NENHUMA DAS OPÇÕES']?.marcado && objetos['NENHUMA DAS OPÇÕES'].outros) {
      pdfDoc.text(`- ${objetos['NENHUMA DAS OPÇÕES'].outros.toUpperCase()}`);
    }

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

// Rota POST /api/submit
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

    let objetos = {};
    let patrulhamento = {};

    if (req.body.objetos) {
      objetos = typeof req.body.objetos === 'string' ? JSON.parse(req.body.objetos) : req.body.objetos;
    }

    if (req.body.patrulhamento) {
      patrulhamento = typeof req.body.patrulhamento === 'string' ? JSON.parse(req.body.patrulhamento) : req.body.patrulhamento;
    }

    if (objetos.cones?.quantidade) objetos.cones.quantidade = parseInt(objetos.cones.quantidade) || 0;

    console.log('OBJETOS RECEBIDOS:', objetos);
    console.log('PATRULHAMENTO RECEBIDO:', patrulhamento);

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
