import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { LicenseProvider, useLicense, Module } from "./context/LicenseContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PartyList from "./pages/party/PartyList";
import PartyDetail from "./pages/party/PartyDetail";
import GoldenRecordView from "./pages/party/GoldenRecordView";
import GoldenRecordsList from "./pages/party/GoldenRecordsList";
import CreateParty from "./pages/party/CreateParty";
import PartyHierarchy from "./pages/party/PartyHierarchy";
import RelationshipGraph from "./pages/relationship/RelationshipGraph";
import PartyTimeline from "./pages/timeline/PartyTimeline";
import GovernanceConsole from "./pages/governance/GovernanceConsole";
import EnterpriseViews from "./pages/governance/EnterpriseViews";
import StewardConsole from "./pages/steward/StewardConsole";
import AIAssistant from "./pages/ai/AIAssistant";
import NLPSearchPage from "./pages/ai/NLPSearchPage";
import StudioAssistant from "./pages/studio/StudioAssistant";
import MLMatchInsights from "./pages/ml/MLMatchInsights";
import AccountList from "./pages/account/AccountList";
import AccountDetail from "./pages/account/AccountDetail";
import ProductList from "./pages/product/ProductList";
import ProductDetail from "./pages/product/ProductDetail";
import AgreementList from "./pages/agreement/AgreementList";
import AgreementDetail from "./pages/agreement/AgreementDetail";
import LockedModulePage from "./pages/license/LockedModulePage";
import SystemLogs from "./pages/audit/SystemLogs";
import ReferenceData from "./pages/reference-data/ReferenceData";

// ── License gate wrapper ───────────────────────────────────────────────────

function ModuleRoute({ module, children }: { module: Module; children: React.ReactNode }) {
  const { hasModule, isLoading } = useLicense();
  if (isLoading) return null;
  if (!hasModule(module)) return <LockedModulePage module={module} />;
  return <>{children}</>;
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={
            <LicenseProvider>
              <Layout />
            </LicenseProvider>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* ── Licensed: Standard+ ── */}
            <Route path="parties" element={
              <ModuleRoute module="PARTY"><PartyList /></ModuleRoute>
            } />
            <Route path="parties/new" element={
              <ModuleRoute module="PARTY"><CreateParty /></ModuleRoute>
            } />
            <Route path="parties/hierarchy" element={
              <ModuleRoute module="PARTY"><PartyHierarchy /></ModuleRoute>
            } />
            <Route path="parties/golden-records" element={
              <ModuleRoute module="PARTY"><GoldenRecordsList /></ModuleRoute>
            } />
            <Route path="parties/:globalId" element={
              <ModuleRoute module="PARTY"><PartyDetail /></ModuleRoute>
            } />
            <Route path="parties/:globalId/golden-record" element={
              <ModuleRoute module="PARTY"><GoldenRecordView /></ModuleRoute>
            } />
            <Route path="parties/:globalId/timeline" element={
              <ModuleRoute module="PARTY"><PartyTimeline /></ModuleRoute>
            } />
            <Route path="accounts" element={
              <ModuleRoute module="ACCOUNT"><AccountList /></ModuleRoute>
            } />
            <Route path="accounts/:globalAccountId" element={
              <ModuleRoute module="ACCOUNT"><AccountDetail /></ModuleRoute>
            } />
            <Route path="relationships" element={
              <ModuleRoute module="RELATIONSHIP"><RelationshipGraph /></ModuleRoute>
            } />

            {/* ── Licensed: Advanced+ ── */}
            <Route path="agreements" element={
              <ModuleRoute module="AGREEMENT"><AgreementList /></ModuleRoute>
            } />
            <Route path="agreements/:globalAgreementId" element={
              <ModuleRoute module="AGREEMENT"><AgreementDetail /></ModuleRoute>
            } />

            {/* ── Licensed: Full only ── */}
            <Route path="products" element={
              <ModuleRoute module="PRODUCT"><ProductList /></ModuleRoute>
            } />
            <Route path="products/:globalProductId" element={
              <ModuleRoute module="PRODUCT"><ProductDetail /></ModuleRoute>
            } />

            {/* ── Platform features — always available ── */}
            <Route path="governance"          element={<GovernanceConsole />} />
            <Route path="enterprise-views"    element={<EnterpriseViews />} />
            <Route path="steward"      element={<StewardConsole />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="nlp-search"   element={<NLPSearchPage />} />
            <Route path="studio"        element={<StudioAssistant />} />
            <Route path="ml-matching"  element={<MLMatchInsights />} />
            <Route path="audit-logs"       element={<SystemLogs />} />
            <Route path="reference-data"   element={<ReferenceData />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
