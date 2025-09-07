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
const fs = require('fs'); // opcional se quiser salvar
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fetch = require('node-fetch'); // para carregar imagens do filesystem ou URL

async function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  // Cria um novo PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Função para adicionar uma página com conteúdo
  function addPage(contentLines = []) {
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;

    // Logo (precisa converter em Uint8Array)
    try {
      const logoPath = path.join(__dirname, 'seglogoata.jpg');
      const logoBytes = fs.readFileSync(logoPath);
      const image = pdfDoc.embedJpg(logoBytes);
      const imageDims = image.scale(0.2); // ajusta tamanho
      page.drawImage(image, { x: width - imageDims.width - 50, y: height - imageDims.height - 30, width: imageDims.width, height: imageDims.height });
    } catch (err) {
      console.log('Logo não encontrada ou erro:', err.message);
    }

    // Adiciona cada linha de conteúdo
    const lineHeight = 14;
    contentLines.forEach(line => {
      if (y < 50) {
        // Nova página
        y = height - 50;
        addPage(contentLines.slice(contentLines.indexOf(line)));
        return;
      }
      page.drawText(line, { x: 50, y, size: 12, font });
      y -= lineHeight;
    });

    return page;
  }

  // Prepara conteúdo em linhas
  const lines = [];
  lines.push('RELATÓRIO DIÁRIO DE PLANTÃO');
  lines.push('INSPETORES GCM ATALAIA - AL');
  lines.push('SECRETARIA DE DEFESA SOCIAL');
  lines.push('GUARDA CIVIL MUNICIPAL DE ATALAIA - AL');
  lines.push('');
  lines.push(`NOME: ${nome?.toUpperCase() || '-'}`);
  lines.push(`MATRÍCULA: ${matricula?.toUpperCase() || '-'}`);
  lines.push(`DATA INÍCIO: ${dataInicio || '-'} - HORA INÍCIO: ${horaInicio || '-'}`);
  lines.push(`DATA SAÍDA: ${dataSaida || '-'} - HORA SAÍDA: ${horaSaida || '-'}`);
  lines.push('');
  lines.push('OBJETOS ENCONTRADOS NA BASE:');

  if (objetos.cones?.marcado) {
    const qtd = parseInt(objetos.cones.quantidade) || 0;
    lines.push(`- ${qtd} CONE(S)`);
  }
  Object.keys(objetos).forEach(item => {
    if (item !== 'cones' && item !== 'NENHUMA DAS OPÇÕES' && objetos[item]) {
      lines.push(`- ${item.toUpperCase()}`);
    }
  });
  if (objetos['NENHUMA DAS OPÇÕES']?.marcado && objetos['NENHUMA DAS OPÇÕES'].outros) {
    lines.push(`- ${objetos['NENHUMA DAS OPÇÕES'].outros.toUpperCase()}`);
  }

  lines.push('');
  lines.push('PATRULHAMENTO PREVENTIVO:');
  Object.keys(patrulhamento).forEach(item => {
    const detalhes = patrulhamento[item]?.primeiro || '';
    lines.push(`- ${item.toUpperCase()}: ${detalhes.toUpperCase()}`);
  });

  lines.push('');
  lines.push('OCORRÊNCIAS:');
  Object.keys(ocorrencias).forEach(item => {
    const detalhes = ocorrencias[item]?.detalhes || '';
    lines.push(`- ${item.toUpperCase()}: ${detalhes.toUpperCase()}`);
  });

  lines.push('');
  lines.push('OBSERVAÇÕES:');
  lines.push(observacoes?.toUpperCase() || '-');

  // Adiciona página com todas as linhas
  const page = await addPage(lines);

  // Numeração de páginas
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    const { width } = p.getSize();
    p.drawText(`Página ${idx + 1} de ${pages.length}`, { x: 0, y: 20, size: 10, font, color: rgb(0,0,0), width, align: 'center' });
  });

  // Retorna buffer em memória
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
