import { BrowserRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import TradingDashboard from "./pages/TradingDashboard.jsx";
import DocsPage from "./pages/DocsPage.jsx";
import FormulasPage from "./pages/FormulasPage.jsx";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<TradingDashboard />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/formulas" element={<FormulasPage />} />
      </Routes>
    </BrowserRouter>
  );
}
