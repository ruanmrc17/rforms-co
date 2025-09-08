const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');

const app = express();
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

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
  const [ano, mes, dia] = dataStr.split('-'); // esperado "YYYY-MM-DD"
  return `${dia} de ${meses[parseInt(mes, 10) - 1]} de ${ano}`;
}

// Função para gerar o PDF
async function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    // === Inserir Logo (topo direito) ===
    const logoPath = path.join(__dirname, 'seglogoata.jpg');
    if (fs.existsSync(logoPath)) {
      pdfDoc.image(logoPath, 480, 30, { width: 80 }); // canto direito superior
    }

    // Cabeçalho (menor e abaixo da logo)
    pdfDoc.fontSize(12).text('INSPETORES GCM ATALAIA - AL / RELATÓRIOS DE PLANTÃO', 0, 90, {
      align: 'center'
    });
    pdfDoc.moveDown(2);

    // Criar "quadrado" com informações
    const startX = 50;
    const startY = 150; // abaixado para não bater na logo/título
    const boxWidth = 500;
    let cursorY = startY;

    pdfDoc.rect(startX, startY, boxWidth, 600).stroke();

    function writeLine(label, value) {
      pdfDoc.font('Helvetica-Bold')
        .fontSize(11)
        .text(`${label}: `, startX + 10, cursorY + 10, { continued: true });

      pdfDoc.font('Helvetica')
        .fontSize(11)
        .text(value || '-');

      cursorY += 25;
    }

    function writeSectionLine(label, value) {
      pdfDoc.font('Helvetica-Bold')
        .fontSize(11)
        .text(`${label}: `, startX + 10, cursorY + 10, { continued: true });

      pdfDoc.font('Helvetica')
        .fontSize(11)
        .text(value || '-');

      // Desenhar linha separadora logo abaixo
      pdfDoc.moveTo(startX + 10, cursorY + 28)
        .lineTo(startX + boxWidth - 10, cursorY + 28)
        .strokeColor('#999')
        .lineWidth(0.5)
        .stroke();

      cursorY += 35;
    }

    // Campos principais
    writeLine('NOME', nome?.toUpperCase() || '-');
    writeLine('MATRÍCULA', matricula?.toUpperCase() || '-');
    writeLine('DATA INICIO', `${dataInicio || '-'}  HORA INÍCIO: ${horaInicio || '-'}`);
    writeLine('DATA SAÍDA', `${dataSaida || '-'}  HORA SAÍDA: ${horaSaida || '-'}`);

    // Objetos
    let objetosArray = [];
    if (objetos?.cones?.marcado) {
      objetosArray.push(`${objetos.cones.quantidade || 0} CONE(S)`);
    }
    Object.keys(objetos || {}).forEach(item => {
      if (item !== 'cones' && objetos[item]?.marcado) {
        objetosArray.push(item.toUpperCase());
      }
    });
    if (objetos['NENHUMA DAS OPÇÕES']?.marcado) {
      objetosArray.push(objetos['NENHUMA DAS OPÇÕES'].outros?.toUpperCase() || 'NENHUMA DAS OPÇÕES');
    }
    writeSectionLine('OBJETOS ENCONTRADOS NA BASE', objetosArray.join(', ') || 'NENHUMA DAS OPÇÕES');

    // Patrulhamentos
    let patrulhamentoArray = [];
    Object.keys(patrulhamento || {}).forEach(item => {
      const detalhes = patrulhamento[item]?.primeiro || '';
      patrulhamentoArray.push(`${item.toUpperCase()} ${detalhes.toUpperCase()}`.trim());
    });
    writeSectionLine('PATRULHAMENTO PREVENTIVO', patrulhamentoArray.join('; ') || '-');

    // Ocorrências
    let ocorrenciasArray = [];
    Object.keys(ocorrencias || {}).forEach(item => {
      const detalhes = ocorrencias[item]?.detalhes || '';
      ocorrenciasArray.push(`${item.toUpperCase()}: ${detalhes.toUpperCase()}`.trim());
    });
    writeSectionLine('OCORRÊNCIA', ocorrenciasArray.join('; ') || '-');

    // Observações
    writeLine('OBSERVAÇÕES', observacoes?.toUpperCase() || '-');

    cursorY += 20;
    writeLine('Added Time', `${dataInicio} ${horaInicio}`);
    writeLine('Task Owner', 'gcmatalaiaal@gmail.com');

    pdfDoc.moveDown(2);
    pdfDoc.fontSize(14).fillColor('gray').text('RForms', { align: 'center' }).fillColor('black');

    pdfDoc.end();
  });
}


// Função para gerar ZIP
function generateZIP(pdfBuffer, arquivos, nomeArquivoPDF) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks = [];

    passthrough.on('data', chunk => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);

    archive.pipe(passthrough);

    archive.append(pdfBuffer, { name: `${nomeArquivoPDF}.pdf` });

    if (arquivos?.fotos) arquivos.fotos.forEach(f => archive.append(f.buffer, { name: `FOTOS/${f.originalname}` }));
    if (arquivos?.videos) arquivos.videos.forEach(v => archive.append(v.buffer, { name: `VIDEOS/${v.originalname}` }));

    archive.finalize();
  });
}

// Rota principal
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

    let objetos = req.body.objetos ? (typeof req.body.objetos === 'string' ? JSON.parse(req.body.objetos) : req.body.objetos) : {};
    let patrulhamento = req.body.patrulhamento ? (typeof req.body.patrulhamento === 'string' ? JSON.parse(req.body.patrulhamento) : req.body.patrulhamento) : {};
    let ocorrencias = req.body.ocorrencias ? (typeof req.body.ocorrencias === 'string' ? JSON.parse(req.body.ocorrencias) : req.body.ocorrencias) : {};

    if (objetos.cones?.quantidade) objetos.cones.quantidade = parseInt(objetos.cones.quantidade) || 0;

    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes });

    const nomeArquivoPDF = `${formatDateExtenso(dataInicio)} - ${nome}`;
    const zipBuffer = await generateZIP(pdfBuffer, req.files, nomeArquivoPDF);

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

module.exports = app;
