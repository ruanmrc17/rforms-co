const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const { PassThrough } = require('stream');

const app = express();
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

// Armazenamento na memória
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function formatDateExtenso(dataStr) {
  if (!dataStr) return '';
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia} de ${meses[parseInt(mes, 10) - 1]} de ${ano}`;
}

async function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    // Cabeçalho
    pdfDoc.fontSize(12).text('INSPETORES GCM ATALAIA - AL / RELATÓRIOS DE PLANTÃO', { align: 'center' });
    pdfDoc.moveDown(2);

    const startX = 50;
    let cursorY = 150;
    const boxWidth = 500;

    function writeLine(label, value) {
      const maxWidth = boxWidth - 20;
      const labelHeight = pdfDoc.heightOfString(label + ':', { width: maxWidth });
      pdfDoc.font('Helvetica-Bold').fontSize(11)
            .text(label + ':', startX + 10, cursorY, { width: maxWidth });
      const textHeight = pdfDoc.heightOfString(value || '-', { width: maxWidth });
      pdfDoc.font('Helvetica').fontSize(11)
            .text(value || '-', startX + 10, cursorY + labelHeight, { width: maxWidth });
      cursorY += labelHeight + textHeight + 10;
      if (cursorY > 780) { pdfDoc.addPage(); cursorY = 50; }
    }

    writeLine('NOME', nome?.toUpperCase() || '-');
    writeLine('MATRÍCULA', matricula?.toUpperCase() || '-');
    writeLine('DATA INICIO', `${dataInicio || '-'}  HORA INÍCIO: ${horaInicio || '-'}`);
    writeLine('DATA SAÍDA', `${dataSaida || '-'}  HORA SAÍDA: ${horaSaida || '-'}`);

    // OBJETOS
    let algumObjeto = false;
    if (objetos) {
      if (objetos.cones?.marcado) {
        writeLine('OBJETOS ENCONTRADOS NA BASE', `${objetos.cones.quantidade || 1} CONE(S)`);
        algumObjeto = true;
      }
      Object.keys(objetos).forEach(key => {
        if (key !== 'cones' && key !== 'NENHUMA DAS OPÇÕES') {
          if (objetos[key] === true) {
            writeLine('OBJETOS ENCONTRADOS NA BASE', key.toUpperCase());
            algumObjeto = true;
          }
        }
      });
      if (objetos['NENHUMA DAS OPÇÕES']?.marcado) {
        const texto = objetos['NENHUMA DAS OPÇÕES'].outros?.trim();
        writeLine('OBJETOS ENCONTRADOS NA BASE', texto ? texto.toUpperCase() : 'NENHUMA DAS OPÇÕES');
        algumObjeto = true;
      }
    }
    if (!algumObjeto) writeLine('OBJETOS ENCONTRADOS NA BASE', 'NENHUMA DAS OPÇÕES');

    // Observações
    writeLine('OBSERVAÇÕES', observacoes?.toUpperCase() || '-');

    pdfDoc.end();
  });
}

// ZIP com arquivos em memória
async function generateZIP(pdfBuffer, arquivos, nomeArquivoPDF) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks = [];
    passthrough.on('data', chunk => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);
    archive.pipe(passthrough);

    archive.append(pdfBuffer, { name: `${nomeArquivoPDF}.pdf` });

    if (arquivos?.fotos) {
      arquivos.fotos.forEach(f => {
        if (f && f.buffer) archive.append(f.buffer, { name: `FOTOS/${f.originalname}` });
      });
    }
    if (arquivos?.videos) {
      arquivos.videos.forEach(v => {
        if (v && v.buffer) archive.append(v.buffer, { name: `VIDEOS/${v.originalname}` });
      });
    }

    archive.finalize();
  });
}

// Rota principal
app.post('/api/submit', upload.fields([{ name: 'fotos' }, { name: 'videos' }]), async (req, res) => {
  try {
    console.log('Arquivos recebidos:', req.files);

    const { nome = '', matricula = '', dataInicio = '', horaInicio = '', dataSaida = '', horaSaida = '', observacoes = '' } = req.body;
    let objetos = req.body.objetos ? JSON.parse(req.body.objetos) : {};
    let patrulhamento = req.body.patrulhamento ? JSON.parse(req.body.patrulhamento) : {};
    let ocorrencias = req.body.ocorrencias ? JSON.parse(req.body.ocorrencias) : {};

    if (objetos.cones?.quantidade) objetos.cones.quantidade = parseInt(objetos.cones.quantidade) || 0;

    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes });
    const nomeArquivoPDF = `${formatDateExtenso(dataInicio)} - ${nome}`;
    const zipBuffer = await generateZIP(pdfBuffer, req.files, nomeArquivoPDF);

    if (zipBuffer.length > MAX_EMAIL_SIZE) {
      return res.status(400).json({ error: 'Arquivo muito grande para envio por e-mail. Apenas PDF será enviado.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: 'enviorforms@gmail.com', pass: 'lgni quba jihs zgox' }
    });

    await transporter.sendMail({
      from: '"RELATÓRIO AUTOMÁTICO" <enviorforms@gmail.com>',
      to: 'ruanmarcos1771@gmail.com',
      subject: `RELATÓRIO: ${nomeArquivoPDF}`,
      text: 'Segue em anexo o relatório em ZIP.',
      attachments: [{ filename: `${nomeArquivoPDF}.zip`, content: zipBuffer }]
    });

    return res.status(200).json({ message: 'Relatório enviado por e-mail com sucesso!' });

  } catch (err) {
    console.error('Erro no backend:', err);
    return res.status(500).json({ error: 'Erro ao gerar ou enviar o relatório' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
