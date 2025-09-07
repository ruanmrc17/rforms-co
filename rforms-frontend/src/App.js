import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./components/Home.jsx";
import RelatorioPlantao from "./components/RelatorioPlantao.jsx";
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <span className="separator">|</span>
        <Link to="/relatorioPlantao">Relatorio de Plantão</Link>
      </nav>

      {/* Definição das rotas */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/relatorioPlantao" element={<RelatorioPlantao />} />
      </Routes>
    </BrowserRouter>
  );
}
