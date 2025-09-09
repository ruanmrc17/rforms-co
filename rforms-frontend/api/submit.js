const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { PassThrough } = require('stream');

const app = express();
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB por arquivo

// Armazenamento na memória
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function formatDateExtenso(dataStr) {
  if (!dataStr) return '';
  const meses = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro'
  ];
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia} de ${meses[parseInt(mes,10)-1]} de ${ano}`;
}

// Gera PDF
async function generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes }) {
  return new Promise(resolve => {
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));

    pdfDoc.fontSize(12).text('RELATÓRIO DE PLANTÃO', { align: 'center' });
    pdfDoc.moveDown();

    function writeLine(label, value){
      pdfDoc.font('Helvetica-Bold').fontSize(11).text(label + ':', { continued: true });
      pdfDoc.font('Helvetica').text(' ' + (value || '-'));
    }

    writeLine('NOME', nome?.toUpperCase());
    writeLine('MATRÍCULA', matricula?.toUpperCase());
    writeLine('DATA INÍCIO', `${dataInicio} HORA: ${horaInicio}`);
    writeLine('DATA SAÍDA', `${dataSaida} HORA: ${horaSaida}`);

    writeLine('OBJETOS', JSON.stringify(objetos));
    writeLine('PATRULHAMENTO', JSON.stringify(patrulhamento));
    writeLine('OCORRÊNCIAS', JSON.stringify(ocorrencias));
    writeLine('OBSERVAÇÕES', observacoes?.toUpperCase());

    pdfDoc.end();
  });
}

// Gera ZIP
async function generateZIP(pdfBuffer, arquivos, nomeArquivoPDF){
  return new Promise((resolve, reject)=>{
    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks = [];
    passthrough.on('data', chunk => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);
    archive.pipe(passthrough);

    archive.append(pdfBuffer, { name: `${nomeArquivoPDF}.pdf` });

    if (arquivos?.fotos) arquivos.fotos.forEach(f => f.buffer && archive.append(f.buffer, { name: `FOTOS/${f.originalname}` }));
    if (arquivos?.videos) arquivos.videos.forEach(v => v.buffer && archive.append(v.buffer, { name: `VIDEOS/${v.originalname}` }));

    archive.finalize();
  });
}

// Rota principal
app.post('/api/submit', upload.fields([{ name:'fotos', maxCount:10 }, { name:'videos', maxCount:5 }]), async (req,res)=>{
  try {
    const { nome='', matricula='', dataInicio='', horaInicio='', dataSaida='', horaSaida='', observacoes='' } = req.body;
    let objetos = req.body.objetos ? JSON.parse(req.body.objetos) : {};
    let patrulhamento = req.body.patrulhamento ? JSON.parse(req.body.patrulhamento) : {};
    let ocorrencias = req.body.ocorrencias ? JSON.parse(req.body.ocorrencias) : {};

    const pdfBuffer = await generatePDF({ nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, objetos, patrulhamento, ocorrencias, observacoes });
    const nomeArquivoPDF = `${formatDateExtenso(dataInicio)} - ${nome}`;
    const zipBuffer = await generateZIP(pdfBuffer, req.files, nomeArquivoPDF);

    if(zipBuffer.length > MAX_EMAIL_SIZE){
      return res.status(400).json({ error:'Arquivos somados muito grandes para envio por e-mail. Envie arquivos menores.' });
    }

    const transporter = nodemailer.createTransport({
      service:'gmail',
      auth:{ user:'enviorforms@gmail.com', pass:'lgni quba jihs zgox' }
    });

    await transporter.sendMail({
      from:'"RELATÓRIO AUTOMÁTICO" <enviorforms@gmail.com>',
      to:'ruanmarcos1771@gmail.com',
      subject:`RELATÓRIO: ${nomeArquivoPDF}`,
      text:'Segue em anexo o relatório em ZIP.',
      attachments:[{ filename:`${nomeArquivoPDF}.zip`, content:zipBuffer }]
    });

    res.status(200).json({ message:'Relatório enviado com sucesso!' });
  } catch(err){
    console.error(err);
    res.status(500).json({ error:'Erro ao gerar ou enviar o relatório' });
  }
});

const PORT = process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
