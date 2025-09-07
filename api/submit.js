const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const cors = require('cors');
const nodemailer = require('nodemailer');
const serverless = require('serverless-http');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/submit', upload.fields([{ name: 'fotos' }, { name: 'videos' }]), async (req, res) => {
  try {
    const { nome, matricula, dataInicio, horaInicio, dataSaida, horaSaida, observacoes } = req.body;
    const objetos = JSON.parse(req.body.objetos || '{}');
    const patrulhamento = JSON.parse(req.body.patrulhamento || '{}');

    // ... restante da lógica do PDF/ZIP/E-mail
    res.json({ message: 'Relatório enviado com sucesso!' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao processar o relatório' });
  }
});

// NÃO usa app.listen() no Vercel
// Exporta para serverless
module.exports.handler = serverless(app);
