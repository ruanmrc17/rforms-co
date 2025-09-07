import React, { useState } from 'react';
import '../styles/RelatorioPlantao.css';

export default function RelatorioPlantao() {
  const [data, setData] = useState({
    nome: '',
    matricula: '',
    dataInicio: '',
    horaInicio: '',
    dataSaida: '',
    horaSaida: '',
    objetos: {},
    patrulhamento: {}, 
    observacoes: '',
    fotos: null,
    videos: null,
  });

  const objetosList = [
    '15 CONES',
    '20 CONES',
    '25 CONES',
    '30 CONES',
    '39 CONES',
    'CELULAR',
    'CARREGADOR DO CELULAR',
    'OUTROS / TIRAR FOTO',
    'NENHUMA DAS OPÇÕES',
  ];

  const patrulhamentoList = [
    'DISTRITO BOCA DA MATA',
    'POVOADO OLHOS D’ÁGUA',
    'DISTRITO SANTO ANTÔNIO',
    'VILA JOSÉ PAULINO',
    'CENTRO',
    'USINA BRASILEIRA',
    'POVOADO SAPUCAIA',
    'POVOADO BOA FÉ',
    'DISTRITO BRANCA DE ATALAIA',
    'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI',
    'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA'
  ];

  const patrulhamentoTextos = {
    'DISTRITO BOCA DA MATA': 'DISTRITO BOCA DA MATA',
    'POVOADO OLHOS D’ÁGUA': "POVOADO OLHOS D'ÁGUA",
    'DISTRITO SANTO ANTÔNIO': "PATRULHAMENTO PREVENTIVO: DISTRITO SANTO ANTÔNIO",
    'VILA JOSÉ PAULINO': 'PATRULHAMENTO PREVENTIVO: VILA JOSÉ PAULINO',
    'CENTRO': 'PATRULHAMENTO PREVENTIVO: CENTRO',
    'USINA BRASILEIRA': 'PATRULHAMENTO PREVENTIVO: USINA BRASILEIRA',
    'POVOADO SAPUCAIA': 'PATRULHAMENTO PREVENTIVO: POVOADO SAPUCAIA',
    'POVOADO BOA FÉ': 'PATRULHAMENTO PREVENTIVO: POVOADO BOA FÉ',
    'DISTRITO BRANCA DE ATALAIA': 'PATRULHAMENTO PREVENTIVO: DISTRITO BRANCA DE ATALAIA',
    'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI':'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI',
    'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA':'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA'
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === 'checkbox') {
      setData(prev => ({
        ...prev,
        objetos: { ...prev.objetos, [name]: checked },
      }));
    } else if (type === 'file') {
      setData(prev => ({
        ...prev,
        [name]: files,
      }));
    } else if (type === 'text' && name.startsWith('patrulhamento')) {
      const [, distrito, field] = name.split('-');
      setData(prev => ({
        ...prev,
        patrulhamento: {
          ...prev.patrulhamento,
          [distrito]: {
            ...prev.patrulhamento[distrito],
            [field]: value,
          }
        }
      }));
    } else {
      setData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'objetos' || key === 'patrulhamento') {
        formDataToSend.append(key, JSON.stringify(data[key]));
      } else if (key === 'fotos' || key === 'videos') {
        if (data[key]) {
          for (let i = 0; i < data[key].length; i++) {
            formDataToSend.append(key, data[key][i]);
          }
        }
      } else {
        formDataToSend.append(key, data[key]);
      }
    });

    try {
      const res = await fetch('https://seu-projeto.vercel.app/api/submit', { 
        method: 'POST',
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        alert(`Erro do servidor: ${errorData.error}`);
        return;
      }

      const result = await res.json();
      alert(result.message || 'Relatório enviado com sucesso!');

    } catch (err) {
      console.error(err);
      if (err.message.includes('Failed to fetch')) {
        alert('Não foi possível conectar ao servidor. Verifique se ele está rodando.');
      } else {
        alert(`Erro desconhecido: ${err.message}`);
      }
    }
  };

  return (
    <div className="form-container">
      <h1>INSPETORES GCM ATALAIA - AL</h1>
      <h2>RELATÓRIO DE PLANTÃO</h2>
      <form onSubmit={handleSubmit} className="form-base">

        <div className="field-group">
          <label>Nome:</label>
          <input type="text" name="nome" value={data.nome} onChange={handleChange} required />
        </div>

        <div className="field-group">
          <label>Matrícula:</label>
          <input type="text" name="matricula" value={data.matricula} onChange={handleChange} required />
        </div>

        <div className="field-group">
          <label>Data Início:</label>
          <input type="date" name="dataInicio" value={data.dataInicio} onChange={handleChange} required />
          <label>Hora Início:</label>
          <input type="time" name="horaInicio" value={data.horaInicio} onChange={handleChange} required />
        </div>

        <div className="field-group">
          <label>Data Saída:</label>
          <input type="date" name="dataSaida" value={data.dataSaida} onChange={handleChange} required />
          <label>Hora Saída:</label>
          <input type="time" name="horaSaida" value={data.horaSaida} onChange={handleChange} required />
        </div>

        <fieldset className="checkbox-group">
          <legend>OBJETOS ENCONTRADOS NA BASE:</legend>
          {objetosList.map(item => (
            <label key={item}>
              <input type="checkbox" name={item} checked={!!data.objetos[item]} onChange={handleChange} />
              {item}
            </label>
          ))}
        </fieldset>

        <fieldset className="radio-group">
          <legend>PATRULHAMENTO PREVENTIVO:</legend>
          {patrulhamentoList.map((item) => (
            <div key={item} className="patrulhamento-item">
              <strong>{item}</strong>
              <input
                type="text"
                name={`patrulhamento-${item}-primeiro`}
                placeholder="Primeiro nome"
                value={data.patrulhamento[item]?.primeiro || ''}
                onChange={handleChange}
              />
              <p className="patrulhamento-texto">{patrulhamentoTextos[item]}</p>
            </div>
          ))}
        </fieldset>

        <fieldset className="observacoes-group">
          <legend>Observações:</legend>
          <textarea
            name="observacoes"
            placeholder="Escreva suas observações aqui"
            value={data.observacoes}
            onChange={handleChange}
            rows={4}
          />
        </fieldset>

        <fieldset>
          <legend style={{ marginTop: '20px' }}>IMPORTAR FOTOS</legend>
          <label htmlFor="fotos" className="upload-label">📷 Selecionar Fotos</label>
          <input
            id="fotos"
            type="file"
            name="fotos"
            accept="image/*"
            multiple
            onChange={handleChange}
          />
          {data.fotos && data.fotos.length > 0 && (
            <p className="upload-info">{data.fotos.length} foto(s) selecionada(s)</p>
          )}

          <legend>IMPORTAR VÍDEOS</legend>
          <label htmlFor="videos" className="upload-label">🎥 Selecionar Vídeos</label>
          <input
            id="videos"
            type="file"
            name="videos"
            accept="video/*"
            multiple
            onChange={handleChange}
          />
          {data.videos && data.videos.length > 0 && (
            <p className="upload-info">{data.videos.length} vídeo(s) selecionado(s)</p>
          )}
        </fieldset>

        <button type="submit" className="form-button">ENVIAR RELATÓRIO</button>
      </form>
    </div>
  );
}
