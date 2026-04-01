import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/ThemeContext';
import Layout from './components/Layout';
import LoginScreen, { hasSession } from './components/LoginScreen';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Subagents from './pages/Subagents';
import Managers from './pages/Managers';
import Specialists from './pages/Specialists';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';
import Handoffs from './pages/Handoffs';
import KnowledgeBase from './pages/KnowledgeBase';
import ModelCouncil from './pages/ModelCouncil';
import Approvals from './pages/Approvals';
import Runs from './pages/Runs';
import ActivityLog from './pages/ActivityLog';
import Backups from './pages/Backups';
import Settings from './pages/Settings';
import Memory from './pages/Memory';
import Schedules from './pages/Schedules';
import InvestigadorIndex from './pages/investigador/index';
import NuevoInvestigador from './pages/investigador/nuevo';
import InvestigadorDetalle from './pages/investigador/detalle';

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean>(hasSession);

  if (!authenticated) {
    return (
      <ThemeProvider>
        <LoginScreen onLogin={() => setAuthenticated(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/subagents" element={<Subagents />} />
            <Route path="/managers" element={<Managers />} />
            <Route path="/specialists" element={<Specialists />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:agentId" element={<Chat />} />
            <Route path="/handoffs" element={<Handoffs />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/council" element={<ModelCouncil />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/runs" element={<Runs />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="/backups" element={<Backups />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/investigador" element={<InvestigadorIndex />} />
            <Route path="/investigador/nuevo" element={<NuevoInvestigador />} />
            <Route path="/investigador/:id" element={<InvestigadorDetalle />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
