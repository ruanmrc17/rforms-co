const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const cors = require('cors');
const nodemailer = require('nodemailer');
const serverless = require('serverless-http');
module.exports = app;
module.exports.handler = serverless(app);


const app = express();
const PORT = 5000;

// Limite máximo do Gmail ~25MB
const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB

// Multer em memória
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/submit', upload.fields([{ name: 'fotos' }, { name: 'videos' }]), async (req, res) => {
  try {
    const { nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, observacoes } = req.body;
    const objetos = JSON.parse(req.body.objetos || '{}');
    const patrulhamento = JSON.parse(req.body.patrulhamento || '{}');

    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}_${date.getHours().toString().padStart(2,'0')}${date.getMinutes().toString().padStart(2,'0')}${date.getSeconds().toString().padStart(2,'0')}`;
    const safeNome = nome ? nome.replace(/\s+/g, '_') : 'relatorio';
    const zipFileName = `${safeNome}_${timestamp}.zip`;

    // ===== Criar PDF em memória =====
    const pdfDoc = new PDFDocument();
    const pdfChunks = [];
    pdfDoc.on('data', chunk => pdfChunks.push(chunk));
    pdfDoc.fontSize(18).text('Relatório de Plantão', { align: 'center' });
    pdfDoc.moveDown();
    pdfDoc.fontSize(12).text(`Nome: ${nome || '-'}`);
    pdfDoc.text(`Matrícula: ${matricula || '-'}`);
    pdfDoc.text(`Data Início: ${dataInicio || '-'} - Hora: ${horaInicio || '-'}`);
    pdfDoc.text(`Data Saída: ${dataSaida || '-'} - Hora: ${horaSaida || '-'}`);
    pdfDoc.moveDown();
    pdfDoc.text('Objetos encontrados na base:');
    Object.keys(objetos).forEach(item => { if (objetos[item]) pdfDoc.text(`- ${item}`); });
    pdfDoc.moveDown();
    pdfDoc.text('Patrulhamento Preventivo:');
    Object.keys(patrulhamento).forEach(distrito => {
      const nomes = patrulhamento[distrito];
      pdfDoc.text(`- ${distrito}: ${nomes?.primeiro || ''}`);
    });
    pdfDoc.moveDown();
    pdfDoc.text('Observações:');
    pdfDoc.text(observacoes || '-');
    pdfDoc.end();

    pdfDoc.on('end', async () => {
      const pdfBuffer = Buffer.concat(pdfChunks);

      // ===== Criar ZIP em memória =====
      const zipChunks = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', chunk => zipChunks.push(chunk));
      archive.on('error', err => {
        console.error('Erro ao criar ZIP:', err);
        return res.status(500).json({ error: 'Erro ao criar arquivo ZIP' });
      });

      archive.append(pdfBuffer, { name: `${safeNome}.pdf` });

      if (req.files['fotos']) {
        req.files['fotos'].forEach(file => archive.append(file.buffer, { name: `fotos/${file.originalname}` }));
      }
      if (req.files['videos']) {
        req.files['videos'].forEach(file => archive.append(file.buffer, { name: `videos/${file.originalname}` }));
      }

      archive.finalize();

      archive.on('end', async () => {
        const zipBuffer = Buffer.concat(zipChunks);

        // ===== Verificar tamanho antes de enviar =====
        if (zipBuffer.length > MAX_EMAIL_SIZE) {
          console.warn('Arquivo ZIP excede 25MB, não será enviado por e-mail.');
          return res.status(400).json({ error: 'Arquivo muito grande para envio por e-mail. Apenas PDF será enviado.' });
        }

        // ===== Enviar e-mail =====
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'enviorforms@gmail.com',      // substitua pelo seu e-mail
            pass: 'aocr ygzm gglb ifsk'         // use senha de app
          }
        });

        try {
          await transporter.sendMail({
            from: '"Relatório Automático" <ruanmarcos1771@gmail.com>',
            to: 'ruanmarcos1771@gmail.com',
            subject: `Relatório: ${safeNome}`,
            text: 'Segue em anexo o relatório em ZIP.',
            attachments: [{ filename: zipFileName, content: zipBuffer }]
          });

          res.json({ message: 'Relatório enviado por e-mail com sucesso!' });

        } catch (emailErr) {
          console.error('Erro ao enviar e-mail:', emailErr);
          res.status(500).json({ error: 'Erro ao enviar e-mail. Verifique usuário e senha do SMTP.' });
        }
      });
    });

  } catch (err) {
    console.error('Erro geral no backend:', err);
    res.status(500).json({ error: 'Erro ao gerar e enviar relatório' });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
