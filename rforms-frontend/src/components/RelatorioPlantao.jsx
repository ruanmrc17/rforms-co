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
    '15 Cones',
    '20 Cones',
    '25 Cones',
    '30 Cones',
    '39 Cones',
    'Celular',
    'Carregador do celular',
    'Outros / tirar foto',
    'Nenhuma das opções',
  ];

  const patrulhamentoList = [
    'Distrito Boca da Mata'.toUpperCase(),
    'Povoado Olhos d’Água'.toUpperCase(),
    'Distrito Santo Antônio'.toUpperCase(),
    'Vila José Paulino'.toUpperCase(),
    'Centro'.toUpperCase(),
    'Usina Brasileira'.toUpperCase(),
    'Povoado Sapucaia'.toUpperCase(),
    'Povoado Boa Fé'.toUpperCase(),
    'Distrito Branca de Atalaia'.toUpperCase(),
    'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI',
    'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA'
  ];

  // 🔥 Nova lista de textos extras para cada patrulhamento
  const patrulhamentoTextos = {
    'Distrito Boca da Mata': 'DISTRITO BOCA DA MATA',
    'Povoado Olhos d’Água': "POVOADO OLHOS D'ÁGUA",
    'Distrito Santo Antônio': "PATRULHAMENTO PREVENTIVO: DISTRITO OLHOS D'ÁGUA",
    'Vila José Paulino': 'PATRULHAMENTO PREVENTIVO: VILA JOSÉ PAULINO',
    'Centro': 'PATRULHAMENTO PREVENTIVO: CENTRO',
    'Usina Brasileira': 'PATRULHAMENTO PREVENTIVO: BRASILEIRA',
    'Povoado Sapucaia': 'PATRULHAMENTO PREVENTIVO: POVOADO SAPUCAIA',
    'Povoado Boa Fé': 'PATRULHAMENTO PREVENTIVO: POVOADO BOA FÉ',
    'Distrito Branca de Atalaia': 'PATRULHAMENTO PREVENTIVO: DISTRITO BRANCA DE ATALAIA',
    'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI':'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI',
    'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA':'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA'
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
      // name ex: patrulhamento-Distrito Boca da Mata-primeiro
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
    const res = await fetch('/api/submit', { // 🔥 relativo ao domínio do Vercel
      method: 'POST',
      body: formDataToSend,
    });


    if (!res.ok) {
      const errorData = await res.json();
      alert(`Erro do servidor: ${errorData.error || res.statusText}`);
      return;
    }

    const result = await res.json();
    alert(result.message || 'Relatório enviado com sucesso!');

  } catch (err) {
    console.error(err);
    if (err.message.includes('Failed to fetch')) {
      alert('Não foi possível conectar ao servidor. Verifique se ele está rodando na porta 5000.');
    } else {
      alert(`Erro desconhecido: ${err.message}`);
    }
  }
};

  return (
    <div className="form-container">
      <h1>INSPETORES GCM ATALAIA - AL</h1>
      <h2>Relatório de Plantão</h2>
      <form onSubmit={handleSubmit} className="form-base">
        {/* --- outros campos --- */}
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
          <legend>Objetos encontrados na base:</legend>
          {objetosList.map(item => (
            <label key={item}>
              <input type="checkbox" name={item} checked={!!data.objetos[item]} onChange={handleChange} />
              {item}
            </label>
          ))}
        </fieldset>
        <fieldset className="radio-group">
          <legend>Patrulhamento Preventivo:</legend>
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
              {/* Texto dinâmico que aparece embaixo */}
              <p className="patrulhamento-texto">
                {patrulhamentoTextos[item]}
              </p>
            </div>
          ))}
        </fieldset>

        {/* --- resto do formulário --- */}

        <fieldset className="observacoes-group">
          <legend>Observações:</legend>
          <textarea
            name="observacoes"
            placeholder="Escreva suas observações aqui"
            value={data.observacoes}
            onChange={handleChange}
            rows={4}
          />
          <legend style={{ 'marginTop': '50px' }}>Importar Fotos</legend>
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

        <legend>Importar Vídeos</legend>
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

        <button type="submit" className="form-button">Enviar Relatório</button>
      </form>
    </div>
  );
}
