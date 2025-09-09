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
    ocorrencias: {},
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
  ];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalSize, setTotalSize] = useState(95795); // soma dos arquivos

  // função para atualizar o tamanho total
  const calculateTotalSize = (fotos, videos) => {
    let size = 95795;
    if (fotos) {
      for (let i = 0; i < fotos.length; i++) {
        size += fotos[i].size;
      }
    }
    if (videos) {
      for (let i = 0; i < videos.length; i++) {
        size += videos[i].size;
      }
    }

    setTotalSize(size);
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === 'file') {
      setData(prev => {
        const newData = { ...prev, [name]: files };
        calculateTotalSize(
          name === "fotos" ? files : prev.fotos,
          name === "videos" ? files : prev.videos
        );
        return newData;
      });
    } else if (type === 'checkbox' && name === 'CONE(S)') {
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
    } else if (name.startsWith('patrulhamento')) {
      const [, item, field] = name.split('-');
      setData(prev => ({
        ...prev,
        patrulhamento: {
          ...prev.patrulhamento,
          [item]: { ...prev.patrulhamento[item], [field]: value },
        },
      }));
    } else if (name.startsWith('ocorrencias|')) {
      const [, item, field] = name.split('|');
      setData(prev => ({
        ...prev,
        ocorrencias: {
          ...prev.ocorrencias,
          [item]: { ...prev.ocorrencias[item], [field]: value },
        },
      }));
    } else {
      setData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalSize >= 25 * 1024 * 1024) {
      alert("O tamanho total dos arquivos não pode ultrapassar 25MB.");
      return;
    }
    setIsSubmitting(true);

    const formDataToSend = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'objetos' || key === 'patrulhamento' || key === 'ocorrencias') {
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
      const res = await fetch('https://backapi-rd6w.onrender.com/api/submit', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await res.json().catch(() => ({ error: res.statusText }));

      if (!res.ok) {
        alert(`Erro do servidor: ${result.error}`);
      } else {
        alert(result.message || 'Relatório enviado com sucesso!');
      }
    } catch (err) {
      alert(`Erro desconhecido: ${err.message}`);
    } finally {
      setIsSubmitting(false);
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
        {/* NOME E MATRÍCULA */}
        <div className="field-group">
          <label>Nome:</label>
          <input type="text" name="nome" value={data.nome} onChange={handleChange} disabled={isSubmitting} required />
        </div>
        <div className="field-group">
          <label>Matrícula:</label>
          <input type="text" name="matricula" value={data.matricula} onChange={handleChange} disabled={isSubmitting} required />
        </div>

        {/* DATAS E HORAS */}
        <div className="field-group">
          <label>Data Início:</label>
          <input type="date" name="dataInicio" value={data.dataInicio} onChange={handleChange} disabled={isSubmitting} required />
          <label>Hora Início:</label>
          <input type="time" name="horaInicio" value={data.horaInicio} onChange={handleChange} disabled={isSubmitting} required />
        </div>
        <div className="field-group">
          <label>Data Saída:</label>
          <input type="date" name="dataSaida" value={data.dataSaida} onChange={handleChange} disabled={isSubmitting} required />
          <label>Hora Saída:</label>
          <input type="time" name="horaSaida" value={data.horaSaida} onChange={handleChange} disabled={isSubmitting} required />
        </div>

        {/* OBJETOS */}
        <fieldset className="checkbox-group">
          <legend>OBJETOS ENCONTRADOS NA BASE:</legend>

          <label className="checkbox-item">
            <input type="checkbox" name="CONE(S)" checked={data.objetos.cones.marcado} onChange={handleChange} disabled={isSubmitting} />
            <span>CONE(S)</span>
            {data.objetos.cones.marcado && (
              <input
                type="number"
                name="quantidadeCones"
                value={data.objetos.cones.quantidade}
                onChange={handleChange}
                placeholder="Quantidade"
                min="1"
                style={{ marginLeft: '10px', width: '80px' }}
                disabled={isSubmitting}
              />
            )}
          </label>

          {objetosList.map(item => (
            <label key={item} className="checkbox-item">
              <input type="checkbox" name={item} checked={!!data.objetos[item]} onChange={handleChange} disabled={isSubmitting} />
              <span>{item}</span>
            </label>
          ))}

          <label className="checkbox-item">
            <input
              type="checkbox"
              name="NENHUMA DAS OPÇÕES"
              checked={data.objetos['NENHUMA DAS OPÇÕES'].marcado}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <span>NENHUMA DAS OPÇÕES</span>
          </label>

          {data.objetos['NENHUMA DAS OPÇÕES'].marcado && (
            <textarea
              name="NENHUMA_OUTROS"
              placeholder="Quais materiais foram encontrados?"
              value={data.objetos['NENHUMA DAS OPÇÕES'].outros}
              onChange={handleChange}
              style={{ marginLeft: '10px', width: '200px', minHeight: '100px' }}
              disabled={isSubmitting}
            />
          )}
        </fieldset>

        {/* PATRULHAMENTO */}
        <fieldset className="radio-group">
          <legend>PATRULHAMENTO PREVENTIVO:</legend>
          {patrulhamentoList.map(item => (
            <div key={item} className="patrulhamento-item">
              <strong>{item}</strong>
              <textarea
                name={`patrulhamento-${item}-primeiro`}
                placeholder="Detalhes do patrulhamento"
                value={data.patrulhamento[item]?.primeiro || ''}
                onChange={handleChange}
                rows={5}
                style={{ width: '94%', resize: 'vertical', marginTop: '5px', minHeight: '100px' }}
                disabled={isSubmitting}
              />
              <p className="patrulhamento-texto">{patrulhamentoTextos[item]}</p>
            </div>
          ))}
        </fieldset>

        {/* OCORRÊNCIAS */}
        <fieldset className="radio-group">
          <legend>OCORRÊNCIAS:</legend>
          {ocorrenciasList.map(item => (
            <div key={item} className="patrulhamento-item">
              <strong>{item}</strong>
              <textarea
                placeholder="Detalhes da ocorrência"
                name={`ocorrencias|${item}|detalhes`}
                value={data.ocorrencias[item]?.detalhes || ''}
                onChange={handleChange}
                rows={5}
                style={{ width: '94%', resize: 'vertical', marginTop: '5px', minHeight: '100px' }}
                disabled={isSubmitting}
              />
            </div>
          ))}
        </fieldset>

        {/* OBSERVAÇÕES */}
        <fieldset className="observacoes-group">
          <legend>Observações:</legend>
          <textarea
            name="observacoes"
            placeholder="Escreva suas observações aqui"
            value={data.observacoes}
            onChange={handleChange}
            rows={5}
            style={{ width: '87%', resize: 'vertical', marginTop: '5px', minHeight: '100px' }}
            disabled={isSubmitting}
          />
        </fieldset>

         <fieldset>
        <legend style={{ marginTop: '20px' }}>IMPORTAR FOTOS</legend>
        <label htmlFor="fotos" className="upload-label">📷 Selecionar Fotos</label>
        <input id="fotos" type="file" name="fotos" accept="image/*" multiple onChange={handleChange} disabled={isSubmitting} />
        {data.fotos && data.fotos.length > 0 && (
          <ul>
            {Array.from(data.fotos).map((file, i) => (
              <li className='arq' key={i}>{file.name} - {(file.size / 1024).toFixed(2)} KB</li>
            ))}
          </ul>
        )}

        <legend>IMPORTAR VÍDEOS</legend>
        <label htmlFor="videos" className="upload-label">🎥 Selecionar Vídeos</label>
        <input id="videos" type="file" name="videos" accept="video/*" multiple onChange={handleChange} disabled={isSubmitting} />
        {data.videos && data.videos.length > 0 && (
          <ul>
            {Array.from(data.videos).map((file, i) => (
              <li className='arq' key={i}>{file.name} - {(file.size / 1024).toFixed(2)} KB</li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* Mostra tamanho total */}
      <p style={{ marginTop: '10px', fontWeight: 'bold', color: totalSize >= 25 * 1024 * 1024 ? 'red' : 'black' }}>
        Tamanho total: {(totalSize / (1024 * 1024)).toFixed(2)} MB / 25 MB
      </p>

      <button
        type="submit"
        className="form-button"
        disabled={isSubmitting || totalSize >= 25 * 1024 * 1024}
      >
        {isSubmitting ? 'ENVIANDO...' : 'ENVIAR RELATÓRIO'}
      </button>
      </form>
    </div>
  );
}
