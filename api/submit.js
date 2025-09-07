const formidable = require('formidable');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const { Buffer } = require('buffer');

// Limite máximo do Gmail ~25MB
const MAX_EMAIL_SIZE = 25 * 1024 * 1024;

// Desativa o bodyParser padrão do Next/Vercel
exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Erro ao processar formulário:', err);
      return res.status(500).json({ error: 'Erro ao processar formulário' });
    }

    try {
      const nome = fields.nome || '';
      const matricula = fields.matricula || '';
      const dataInicio = fields.dataInicio || '';
      const horaInicio = fields.horaInicio || '';
      const dataSaida = fields.dataSaida || '';
      const horaSaida = fields.horaSaida || '';
      const observacoes = fields.observacoes || '';
      const objetos = JSON.parse(fields.objetos || '{}');
      const patrulhamento = JSON.parse(fields.patrulhamento || '{}');

      // Gerar PDF
      const pdfDoc = new PDFDocument();
      const pdfChunks = [];
      pdfDoc.on('data', (chunk) => pdfChunks.push(chunk));
      pdfDoc.fontSize(18).text('RELATÓRIO DE PLANTÃO', { align: 'center' });
      pdfDoc.moveDown();
      pdfDoc.fontSize(12).text(`NOME: ${nome}`);
      pdfDoc.text(`MATRÍCULA: ${matricula}`);
      pdfDoc.text(`DATA INÍCIO: ${dataInicio} - HORA: ${horaInicio}`);
      pdfDoc.text(`DATA SAÍDA: ${dataSaida} - HORA: ${horaSaida}`);
      pdfDoc.moveDown();
      pdfDoc.text('OBJETOS ENCONTRADOS NA BASE:');
      Object.keys(objetos).forEach((item) => { if (objetos[item]) pdfDoc.text(`- ${item}`); });
      pdfDoc.moveDown();
      pdfDoc.text('PATRULHAMENTO PREVENTIVO:');
      Object.keys(patrulhamento).forEach((distrito) => {
        const nomes = patrulhamento[distrito];
        pdfDoc.text(`- ${distrito}: ${nomes?.primeiro || ''}`);
      });
      pdfDoc.moveDown();
      pdfDoc.text('OBSERVAÇÕES:');
      pdfDoc.text(observacoes || '-');
      pdfDoc.end();

      await new Promise(resolve => pdfDoc.on('end', resolve));
      const pdfBuffer = Buffer.concat(pdfChunks);

      // Criar ZIP
      const zipChunks = [];
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('data', (chunk) => zipChunks.push(chunk));
      archive.on('error', (err) => { throw err; });
      archive.append(pdfBuffer, { name: 'RELATORIO.pdf' });

      if (files.fotos) {
        const fotosArray = Array.isArray(files.fotos) ? files.fotos : [files.fotos];
        fotosArray.forEach(f => archive.append(fs.readFileSync(f.filepath), { name: `FOTOS/${f.originalFilename}` }));
      }
      if (files.videos) {
        const videosArray = Array.isArray(files.videos) ? files.videos : [files.videos];
        videosArray.forEach(v => archive.append(fs.readFileSync(v.filepath), { name: `VIDEOS/${v.originalFilename}` }));
      }

      archive.finalize();
      await new Promise(resolve => archive.on('end', resolve));
      const zipBuffer = Buffer.concat(zipChunks);

      if (zipBuffer.length > MAX_EMAIL_SIZE) {
        return res.status(400).json({ error: 'Arquivo muito grande. Apenas PDF será enviado.' });
      }

      // Enviar e-mail
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'eviorforms@gmail.com',
          pass: 'lgni quba jihs zgox'
        }
      });

      await transporter.sendMail({
        from: '"RELATÓRIO AUTOMÁTICO" <eviorforms@gmail.com>',
        to: 'ruanmarcos1771@gmail.com',
        subject: `RELATÓRIO: ${nome || 'RELATORIO'}`,
        text: 'Segue em anexo o relatório em ZIP.',
        attachments: [{ filename: 'RELATORIO.zip', content: zipBuffer }]
      });

      return res.status(200).json({ message: 'Relatório enviado com sucesso!' });

    } catch (error) {
      console.error('Erro ao gerar/enviar relatório:', error);
      return res.status(500).json({ error: 'Erro ao gerar ou enviar o relatório' });
    }
  });
};
