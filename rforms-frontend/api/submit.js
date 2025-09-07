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
function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  return new Promise((resolve) => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    // Logo
    const logoPath = path.join(__dirname, 'seglogoata.jpg');
    pdfDoc.image(logoPath, 450, 15, { width: 100 });

    // Títulos
    pdfDoc.fontSize(18).text('RELATÓRIO DIÁRIO DE PLANTÃO', { align: 'center' });
    pdfDoc.fontSize(10).text('INSPETORES GCM ATALAIA - AL', { align: 'center' });
    pdfDoc.fontSize(10).text('SECRETARIA DE DEFESA SOCIAL', { align: 'center' });
    pdfDoc.fontSize(10).text('GUARDA CIVIL MUNICIPAL DE ATALAIA - AL', { align: 'center' });
    pdfDoc.moveDown();

    // Informações principais
    pdfDoc.fontSize(12).text(`NOME: ${nome?.toUpperCase() || '-'}`);
    pdfDoc.text(`MATRÍCULA: ${matricula?.toUpperCase() || '-'}`);
    pdfDoc.text(`DATA INÍCIO: ${dataInicio || '-'} - HORA INÍCIO: ${horaInicio || '-'}`);
    pdfDoc.text(`DATA SAÍDA: ${dataSaida || '-'} - HORA SAÍDA: ${horaSaida || '-'}`);
    pdfDoc.moveDown();

    // Objetos
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

    // Patrulhamento
    pdfDoc.moveDown();
    pdfDoc.text('PATRULHAMENTO PREVENTIVO:');
    Object.keys(patrulhamento).forEach(item => {
      const detalhes = patrulhamento[item]?.primeiro || '';
      pdfDoc.text(`- ${item.toUpperCase()}: ${detalhes.toUpperCase()}`, { width: 450, lineGap: 2 });
    });

    // Ocorrências
    pdfDoc.moveDown();
    pdfDoc.text('OCORRÊNCIAS:');
    Object.keys(ocorrencias).forEach(item => {
      const detalhes = ocorrencias[item]?.detalhes || '';
      pdfDoc.text(`- ${item.toUpperCase()}: ${detalhes.toUpperCase()}`, { width: 450, lineGap: 2 });
    });

    // Observações
    pdfDoc.moveDown();
    pdfDoc.text('OBSERVAÇÕES:');
    pdfDoc.text(observacoes?.toUpperCase() || '-', { width: 450, lineGap: 2 });

    // --- Numeração de páginas ---
    pdfDoc.end(); // primeiro finaliza o PDF para que o bufferPages funcione
    pdfDoc.on('end', () => {
      const range = pdfDoc.bufferedPageRange(); // { start: 0, count: X }
      for (let i = 0; i < range.count; i++) {
        pdfDoc.switchToPage(i);
        pdfDoc.fontSize(10)
              .text(`Página ${i + 1} de ${range.count}`, 0, pdfDoc.page.height - 30, { align: 'center' });
      }
    });
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
