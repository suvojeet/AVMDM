import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { LicenseProvider, useLicense, Module } from "./context/LicenseContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PartyList from "./pages/party/PartyList";
import PartyDetail from "./pages/party/PartyDetail";
import GoldenRecordView from "./pages/party/GoldenRecordView";
import GoldenView from "./pages/party/GoldenView";
import CreateParty from "./pages/party/CreateParty";
import PartyHierarchy from "./pages/party/PartyHierarchy";
import RelationshipGraph from "./pages/relationship/RelationshipGraph";
import ManageRelationships from "./pages/relationship/ManageRelationships";
import PartyTimeline from "./pages/timeline/PartyTimeline";
import GovernanceConsole from "./pages/governance/GovernanceConsole";
import StewardConsole from "./pages/steward/StewardConsole";
import EntityModeling from "./pages/steward/EntityModeling";
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
import GoldenIdDocs from "./pages/docs/GoldenIdDocs";
import TimelineDocs from "./pages/docs/TimelineDocs";
import MatchingDocs from "./pages/docs/MatchingDocs";
import TestLabDocs from "./pages/docs/TestLabDocs";
import TestLab from "./pages/testlab/TestLab";
import HelpDocs from "./pages/help/HelpDocs";
import Webhooks from "./pages/settings/Webhooks";
import ExtensionDocs from "./pages/docs/ExtensionDocs";
import PlatformAdminRoute from "./components/layout/PlatformAdminRoute";
import PlatformLayout from "./components/layout/PlatformLayout";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import TenantManagement from "./pages/platform/TenantManagement";
import LicenseManagement from "./pages/platform/LicenseManagement";
import FeatureFlags from "./pages/platform/FeatureFlags";
import SystemConfig from "./pages/platform/SystemConfig";
import UserManagement from "./pages/platform/UserManagement";
import ReleaseManagement from "./pages/platform/ReleaseManagement";
import UsageAnalytics from "./pages/platform/UsageAnalytics";

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
    <MemoryRouter>
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
            <Route path="relationships">
              <Route index element={<Navigate to="/relationships/manage" replace />} />
              <Route path="manage" element={
                <ModuleRoute module="RELATIONSHIP"><ManageRelationships /></ModuleRoute>
              } />
              <Route path="graph" element={
                <ModuleRoute module="RELATIONSHIP"><RelationshipGraph /></ModuleRoute>
              } />
            </Route>

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

            <Route path="golden-view" element={
              <ModuleRoute module="PARTY"><GoldenView /></ModuleRoute>
            } />

            {/* ── Platform features — always available ── */}
            <Route path="governance"          element={<GovernanceConsole />} />
            <Route path="steward"                    element={<StewardConsole />} />
            <Route path="steward/entity-modeling"   element={<EntityModeling />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="nlp-search"   element={<NLPSearchPage />} />
            <Route path="studio"        element={<StudioAssistant />} />
            <Route path="ml-matching"  element={<MLMatchInsights />} />
            <Route path="audit-logs"       element={<SystemLogs />} />
            <Route path="reference-data"   element={<ReferenceData />} />
            <Route path="docs/golden-id"   element={<GoldenIdDocs />} />
            <Route path="docs/timeline"    element={<TimelineDocs />} />
            <Route path="docs/matching"    element={<MatchingDocs />} />
            <Route path="docs/test-lab"    element={<TestLabDocs />} />
            <Route path="test-lab"         element={<TestLab />} />
            <Route path="help"             element={<HelpDocs />} />
            <Route path="settings/webhooks" element={<Webhooks />} />
            <Route path="docs/extensions"  element={<ExtensionDocs />} />
          </Route>
        </Route>
        {/* ── Averio Control Plane — PLATFORM_ADMIN only ── */}
        <Route element={<PlatformAdminRoute />}>
          <Route path="/platform" element={<PlatformLayout />}>
            <Route index element={<PlatformDashboard />} />
            <Route path="tenants"   element={<TenantManagement />} />
            <Route path="licenses"  element={<LicenseManagement />} />
            <Route path="flags"     element={<FeatureFlags />} />
            <Route path="config"    element={<SystemConfig />} />
            <Route path="users"     element={<UserManagement />} />
            <Route path="releases"  element={<ReleaseManagement />} />
            <Route path="analytics" element={<UsageAnalytics />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MemoryRouter>
  );
}
