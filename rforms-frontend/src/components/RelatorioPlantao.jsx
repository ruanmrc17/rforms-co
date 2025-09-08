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
  objetos: {
    cones: { marcado: false, quantidade: 1 },
    'NENHUMA DAS OPÇÕES': { marcado: false, outros: '' },
  },
  patrulhamento: {},
  ocorrencias: {}, // <-- inicializa aqui
  observacoes: '',
  fotos: null,
  videos: null,
});


  const objetosList = [
    'CELULAR',
    'CARREGADOR DO CELULAR',
    'CAMÊRA CORPORAL',
    'CARREGADOR DE CAMÊRA CORPORAL',
    'OUTROS / TIRAR FOTO OU VÍDEO',
  ];

  const patrulhamentoList = [
    'DISTRITO BOCA DA MATA',
    "POVOADO OLHOS D’ÁGUA",
    'DISTRITO SANTO ANTÔNIO',
    'VILA JOSÉ PAULINO',
    'CENTRO',
    'USINA BRASILEIRA',
    'POVOADO SAPUCAIA',
    'POVOADO BOA FÉ',
    'DISTRITO BRANCA DE ATALAIA',
    'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI',
    'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA',
  ];

  const patrulhamentoTextos = {
    'DISTRITO BOCA DA MATA': 'DISTRITO BOCA DA MATA',
    "POVOADO OLHOS D’ÁGUA": "POVOADO OLHOS D'ÁGUA",
    'DISTRITO SANTO ANTÔNIO': 'PATRULHAMENTO PREVENTIVO: DISTRITO SANTO ANTÔNIO',
    'VILA JOSÉ PAULINO': 'PATRULHAMENTO PREVENTIVO: VILA JOSÉ PAULINO',
    'CENTRO': 'PATRULHAMENTO PREVENTIVO: CENTRO',
    'USINA BRASILEIRA': 'PATRULHAMENTO PREVENTIVO: USINA BRASILEIRA',
    'POVOADO SAPUCAIA': 'PATRULHAMENTO PREVENTIVO: POVOADO SAPUCAIA',
    'POVOADO BOA FÉ': 'PATRULHAMENTO PREVENTIVO: POVOADO BOA FÉ',
    'DISTRITO BRANCA DE ATALAIA': 'PATRULHAMENTO PREVENTIVO: DISTRITO BRANCA DE ATALAIA',
    'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI': 'PATRULHAMENTO PREVENTIVO: POVOADO OURICURI',
    'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA': 'PATRULHAMENTO PREVENTIVO: POVOADO PORONGABA',
  };

  const ocorrenciasList = [
    'VIOLÊNCIA DOMÉSTICA',
    'AUX. PACIENTE PSIQUIÁTRICO',
    'ACIDENTE DE TRÂNSITO COM VITIMAS',
    'ACIDENTE DE TRÂNSITO SEM VITIMAS',
    'HOMICÍDIO',
    'TENTATIVA DE HOMICÍDIO',
    'LESÃO CORPORAL',
    'ESTUPRO / VULNERÁVEL',
    'ROUBO / FURTO',
    'CRIME CONTRA CRIANÇA / ADOLESCENTE',
    'PESSOAS DESAPARECIDAS',
    'SUICÍDIO',
    'MAUS TRATOS CONTRA ANIMAIS',
    'ROUBO A RESIDENCIA',
    'CRIME CONTRA O IDOSO',
    'DESACATO',
    'OUTROS'
  ]

 const handleChange = (e) => {
  const { name, value, type, checked, files } = e.target;

  // Objetos específicos
  if (type === 'checkbox' && name === 'CONE(S)') {
    setData(prev => ({
      ...prev,
      objetos: { ...prev.objetos, cones: { ...prev.objetos.cones, marcado: checked } },
    }));
  } else if (type === 'number' && name === 'quantidadeCones') {
    setData(prev => ({
      ...prev,
      objetos: { ...prev.objetos, cones: { ...prev.objetos.cones, quantidade: value } },
    }));
  } else if (type === 'checkbox' && name === 'NENHUMA DAS OPÇÕES') {
    setData(prev => ({
      ...prev,
      objetos: { ...prev.objetos, [name]: { ...prev.objetos[name], marcado: checked } },
    }));
  } else if (type === 'textarea' && name === 'NENHUMA_OUTROS') {
    setData(prev => ({
      ...prev,
      objetos: { ...prev.objetos, 'NENHUMA DAS OPÇÕES': { ...prev.objetos['NENHUMA DAS OPÇÕES'], outros: value } },
    }));
  } else if (type === 'checkbox') {
    setData(prev => ({ ...prev, objetos: { ...prev.objetos, [name]: checked } }));
  } else if (type === 'file') {
    setData(prev => ({ ...prev, [name]: files }));
  } 
  // Patrulhamento
  else if (name.startsWith('patrulhamento')) {
    const [, item, field] = name.split('-');
    setData(prev => ({
      ...prev,
      patrulhamento: {
        ...prev.patrulhamento,
        [item]: { ...prev.patrulhamento[item], [field]: value },
      },
    }));
  }
  // Ocorrências
  else if (name.startsWith('ocorrencias|')) {
  const [, item, field] = name.split('|');
  setData(prev => ({
    ...prev,
    ocorrencias: {
      ...prev.ocorrencias,
      [item]: { ...prev.ocorrencias[item], [field]: value },
    },
  }));
}



else {
      setData(prev => ({ ...prev, [name]: value }));
  }
};

  const handleSubmit = async (e) => {
  e.preventDefault();

  const formDataToSend = new FormData();

  Object.keys(data).forEach(key => {
    if (key === 'objetos' || key === 'patrulhamento' || key === 'ocorrencias') {
      formDataToSend.append(key, JSON.stringify(data[key]));
      console.log(data[key])
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
    const res = await fetch('https://rforms-co.vercel.app/api/submit', {
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
    alert(`Erro desconhecido: ${err.message}`);
  }
};

  return (
    <div className="form-container">
      <img src="/seglogoata.jpg" alt="Logo" className="site-logo" />

      <h2>SECRETARIA DE DEFESA SOCIAL</h2>
      <h3>GUARDA CIVIL MUNICIPAL DE ATALAIA - AL</h3>
      <h3>INSPETORES GCM ATALAIA - AL</h3>
      <h3>RELATÓRIO DIÁRIO DE PLANTÃO</h3>

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
          <label>
            <input type="checkbox" name="CONE(S)" checked={data.objetos.cones.marcado} onChange={handleChange} />
            CONE(S)
            {data.objetos.cones.marcado && (
              <input
                type="number"
                name="quantidadeCones"
                value={data.objetos.cones.quantidade}
                onChange={handleChange}
                placeholder="Quantidade"
                min="1"
                style={{ marginLeft: '10px', width: '80px' }}
              />
            )}
          </label>

          {objetosList.map(item => (
            <label key={item}>
              <input type="checkbox" name={item} checked={!!data.objetos[item]} onChange={handleChange} />
              {item}
            </label>
          ))}

          <label>
            <input
              type="checkbox"
              name="NENHUMA DAS OPÇÕES"
              checked={data.objetos['NENHUMA DAS OPÇÕES'].marcado}
              onChange={handleChange}
            />
            NENHUMA DAS OPÇÕES
          </label>

          {data.objetos['NENHUMA DAS OPÇÕES'].marcado && (
            <textarea
              name="NENHUMA_OUTROS"
              placeholder="Quais materiais foram encontrados?"
              value={data.objetos['NENHUMA DAS OPÇÕES'].outros}
              onChange={handleChange}
              style={{ marginLeft: '10px', width: '300px', minHeight: '100px' }}
            />
          )}
        </fieldset>

        <fieldset className="radio-group">
          <legend>PATRULHAMENTO PREVENTIVO:</legend>
          {patrulhamentoList.map((item) => (
            <div key={item} className="patrulhamento-item">
              <strong>{item}</strong>
              <textarea
                name={`patrulhamento-${item}-primeiro`}
                placeholder="Detalhes do patrulhamento"
                value={data.patrulhamento[item]?.primeiro || ''}
                onChange={handleChange}
  rows={5} // maior altura inicial
  style={{ width: '100%', resize: 'vertical', marginTop: '5px', minHeight: '100px' }}
              />
              <p className="patrulhamento-texto">{patrulhamentoTextos[item]}</p>
            </div>
          ))}
        </fieldset>

<fieldset className="radio-group">
  <legend>OCORRÊNCIAS:</legend>
  {ocorrenciasList.map((item) => (
    <div key={item} className="patrulhamento-item">
      <strong>{item}</strong>
      <textarea
        placeholder="Detalhes da ocorrência"
  name={`ocorrencias|${item}|detalhes`}
  value={data.ocorrencias[item]?.detalhes || ''}
  onChange={handleChange}

        rows={5}
        style={{
          width: '100%',
          resize: 'vertical',
          marginTop: '5px',
          minHeight: '100px'
        }}
      />
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
  rows={5} // maior altura inicial
  style={{ width: '90%', resize: 'vertical', marginTop: '5px', minHeight: '100px' }}
          />
        </fieldset>

        <fieldset>
          <legend style={{ marginTop: '20px' }}>IMPORTAR FOTOS</legend>
          <label htmlFor="fotos" className="upload-label">📷 Selecionar Fotos</label>
          <input id="fotos" type="file" name="fotos" accept="image/*" multiple onChange={handleChange} />
          {data.fotos && data.fotos.length > 0 && (
            <p className="upload-info">{data.fotos.length} foto(s) selecionada(s)</p>
          )}

          <legend>IMPORTAR VÍDEOS</legend>
          <label htmlFor="videos" className="upload-label">🎥 Selecionar Vídeos</label>
          <input id="videos" type="file" name="videos" accept="video/*" multiple onChange={handleChange} />
          {data.videos && data.videos.length > 0 && (
            <p className="upload-info">{data.videos.length} vídeo(s) selecionado(s)</p>
          )}
        </fieldset>

        <button type="submit" className="form-button">ENVIAR RELATÓRIO</button>
      </form>
    </div>
  );
}
