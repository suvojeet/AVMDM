# Averio-Skills — Developer Agent Guide

**Agent name: Averio-Skills**

Averio MDM is a commercial Enterprise Master Data Management (MDM) SaaS platform built to sell to Fortune 500 clients (e.g. JP Morgan Chase, Blue Cross Blue Shield). Treat all code as production-quality — not a demo or prototype.

---

## Project Layout

```
averio-mdm/
├── backend/          Java 21 · Spring Boot 3.x · Maven
├── frontend/         React 18 · TypeScript · Vite · Tailwind CSS
├── infrastructure/
│   ├── docker/       Dockerfiles + nginx.conf
│   ├── azure/        Bicep IaC (main.bicep + params.prod.json)
│   └── neo4j/init/   schema.cypher (graph schema + seed data)
├── docker-compose.yml
├── build.bat / build.sh
├── start-backend.bat / start-backend.sh
├── start-frontend.bat / start-frontend.sh
├── start-local.bat / start-local.sh
├── stop-*.bat / stop-*.sh
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.2.5, Spring Security, OAuth2/JWT |
| Graph DB | Neo4j 5.x (Spring Data Neo4j) |
| Document DB | Azure Cosmos DB (timeline, audit, governance docs) |
| Cache | Redis 7 (Spring Cache) |
| AI/ML | Anthropic Claude (claude-sonnet-4-6) + Azure OpenAI GPT-4 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, react-router-dom v6 |
| Auth | Azure AD / OAuth2 / JWT — **disabled in local dev** (`application-local.yml`) |
| Deployment | Azure App Service, Azure Container Registry, Bicep IaC |

---

## Local Development

### Quick start
```bash
# 1. Start infrastructure (Neo4j, Redis, Cosmos emulator)
docker-compose up -d

# 2. Backend — runs on port 8080
cd backend
mvnw spring-boot:run -Dspring-boot.run.profiles=local

# 3. Frontend — runs on port 5173
cd frontend
npm install && npm run dev
```

### Convenience scripts
- `build.bat` / `build.sh` — build both backend and frontend (flags: `--backend-only`, `--frontend-only`, `--with-tests`, `--clean`)
- `start-backend.bat` / `start-backend.sh` — build + start Spring Boot (profile: local)
- `start-frontend.bat` / `start-frontend.sh` — install deps + start Vite dev server
- `start-local.bat` / `start-local.sh` — start everything including Docker infra
- `stop-local.bat` / `stop-local.sh` — stop all services

### Local URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Neo4j Browser | http://localhost:7474 (neo4j / averio@MDM2026) |
| Health check | http://localhost:8080/actuator/health |

Default login: `admin` / `admin`

### Key config files
- `backend/src/main/resources/application.yml` — production config (env-var driven)
- `backend/src/main/resources/application-local.yml` — local overrides (**gitignored** — contains live keys)
- `frontend/src/services/api.ts` — all API calls; base URL is `http://localhost:8080`

---

## Backend Architecture

### Package structure (`com.averio.mdm`)
```
config/           SecurityConfig, SwaggerConfig, AzureAIConfig, CacheConfig,
                  WebMvcConfig, GlobalExceptionHandler, CosmosContainerInitializer
controller/       PartyController, GovernanceController, StewardController,
                  AIController, DashboardController, AccountController,
                  ProductController, AgreementController, AuditController,
                  EnterpriseViewController, NLPSearchController,
                  PartyHierarchyController, LicenseController
domain/
  entity/         Party, Account, Product, Agreement, PartyRelationship,
                  Address, EmailAddress, Phone  (Neo4j nodes)
  cosmos/         PartyDoc, AccountDoc, ProductDoc, AgreementDoc  (Cosmos docs)
  golden/         GoldenRecord, GoldenAttribute, SourceRecord, MergeEvent
  governance/     SurvivorshipRule, MatchingRule, DataPolicy, EnterpriseView
  timeline/       TimelineEvent
  steward/        StewardTask
  audit/          SystemLog, TransactionLog
  ml/             MatchingFeedback, SoftMatchResult
  reference/      ReferenceCategory, ReferenceDataItem
engine/
  matching/       MatchingEngine, DeterministicMatcher, ProbabilisticMatcher,
                  AIEnhancedMatcher, SimilarityFunctions, BlockingKeyService,
                  NameNormalizerService, EMAlgorithmService, ClusterMergeService
  survivorship/   SurvivorshipEngine, SourcePriorityStrategy,
                  MostRecentStrategy, MostFrequentStrategy
license/          LicenseTier (STANDARD/ADVANCED/FULL), LicenseService,
                  LicenseInterceptor, LicenseController
repository/
  neo4j/          PartyRepository, AccountRepository, ProductRepository,
                  PartyAddressRepository
  cosmos/         TimelineRepository, StewardTaskRepository,
                  SurvivorshipRuleRepository, MatchingRuleRepository,
                  DataPolicyRepository, MatchingFeedbackRepository,
                  MLMatchModelRepository, TransactionLogRepository,
                  SystemLogRepository, EnterpriseViewRepository,
                  ReferenceDataRepository, ReferenceCategoryRepository,
                  AccountDocRepository, ProductDocRepository, AgreementDocRepository
service/          PartyService, GoldenRecordService, TimelineService,
                  GovernanceService, StewardService, AIAssistantService,
                  SearchService, ClaudeNLPService, PartyPhotoService,
                  PartyHierarchyService, EnterpriseViewService, GdprService,
                  DataSeeder, ProductService
service/audit/    TransactionLogService, SystemLogService
service/ml/       MLMatchingService, FeatureExtractorService
testing/          TestLab suites (Matching, Survivorship, Timeline, GoldenRecord,
                  Blocking, ApiHealth, RegressionScenario)
```

### Backend conventions
- All controllers return `ResponseEntity<?>` with proper HTTP status codes
- Services use `@Transactional` where appropriate; Neo4j and Cosmos writes are separate transactions
- Cosmos DB is the store for all time-series and audit data; Neo4j for graph/relational entity data
- Redis is used via `@Cacheable` / `@CacheEvict` on service methods — cache names are defined in `CacheConfig`
- `GlobalExceptionHandler` handles all exceptions — do not catch and swallow exceptions in services
- `LicenseInterceptor` gates endpoints by `LicenseTier`; use `@RequiresLicense(LicenseTier.ADVANCED)` on controllers
- Auth is JWT/Azure AD in prod; in local dev `SecurityConfig` permits all requests when `jwk-set-uri` is empty
- All new Cosmos containers must be registered in `CosmosContainerInitializer`
- Log at `DEBUG` for diagnostic detail, `INFO` for lifecycle events, `WARN`/`ERROR` for failures

### Adding a new backend feature
1. Domain entity in `domain/` (Neo4j node or Cosmos document)
2. Repository interface in `repository/neo4j/` or `repository/cosmos/`
3. Service in `service/` — business logic only, no HTTP concerns
4. Controller in `controller/` — thin, delegates to service
5. Register any new Cosmos container in `CosmosContainerInitializer`

---

## Frontend Architecture

### Directory structure (`frontend/src/`)
```
App.tsx                      Route definitions + license gate
components/
  layout/                    Layout, ProtectedRoute, PlatformAdminRoute, PlatformLayout
  ui/                        Shared UI primitives
context/
  LicenseContext.tsx          LicenseProvider + useLicense hook + Module type
pages/
  Dashboard.tsx
  Login.tsx
  party/                     PartyList, PartyDetail, GoldenRecordView, GoldenView,
                             CreateParty, PartyHierarchy, GoldenRecordsList
  account/                   AccountList, AccountDetail
  product/                   ProductList, ProductDetail
  agreement/                 AgreementList, AgreementDetail
  relationship/              RelationshipGraph, ManageRelationships
  timeline/                  PartyTimeline
  governance/                GovernanceConsole, EnterpriseViews
  steward/                   StewardConsole, EntityModeling
  ai/                        AIAssistant, NLPSearchPage
  studio/                    StudioAssistant
  ml/                        MLMatchInsights
  audit/                     SystemLogs
  reference-data/            ReferenceData
  testlab/                   TestLab
  platform/                  PlatformDashboard, TenantManagement, LicenseManagement,
                             FeatureFlags, SystemConfig, UserManagement,
                             ReleaseManagement, UsageAnalytics  (PLATFORM_ADMIN only)
  settings/                  Webhooks
  license/                   LockedModulePage
  help/                      HelpDocs
  docs/                      GoldenIdDocs, TimelineDocs, MatchingDocs,
                             TestLabDocs, ExtensionDocs, LoggingDocs
services/
  api.ts                     All API calls — Axios client, base URL http://localhost:8080
```

### Frontend conventions
- All API calls go through `services/api.ts` — never call `fetch` directly in components
- Data fetching uses `@tanstack/react-query` (`useQuery`, `useMutation`)
- Routing: `MemoryRouter` with `react-router-dom` v6; routes defined in `App.tsx`
- License gating: wrap routes in `<ModuleRoute module="MODULE_NAME">` in `App.tsx`
- Design system: Tailwind CSS with custom `aq-*` color tokens (defined in `tailwind.config.js`)
  - `aq-text`, `aq-dim`, `aq-border`, `aq-dark`, `aq-blue`, `aq-blue-2`, `aq-surface`
- Icons: `lucide-react` — Lucide icons do **not** accept a `title` prop; use `<span title="..."><Icon /></span>` for tooltips
- Component props: always include `children: React.ReactNode` when a component accepts children
- `clsx` for conditional classnames
- Platform control plane (`/platform/*`) is only accessible to `PLATFORM_ADMIN` role — guarded by `PlatformAdminRoute`

### Adding a new frontend page
1. Create the page component in the appropriate `pages/` subdirectory
2. Import and add the route in `App.tsx`
3. If license-gated, wrap in `<ModuleRoute module="...">` — modules: `PARTY`, `ACCOUNT`, `PRODUCT`, `AGREEMENT`, `RELATIONSHIP`
4. Add all API calls to `services/api.ts`
5. Add a nav link in `components/layout/Layout.tsx` if it needs sidebar navigation

---

## Data Domains & License Tiers

| Module | License Tier | Notes |
|---|---|---|
| PARTY | STANDARD+ | Core MDM entity |
| ACCOUNT | STANDARD+ | |
| RELATIONSHIP | STANDARD+ | |
| AGREEMENT | ADVANCED+ | |
| PRODUCT | FULL only | |

---

## AI / Claude Integration

- **AverioAI Chatbot**: `AIAssistantService` → Claude `claude-sonnet-4-6`
- **NLP Search**: `ClaudeNLPService` → converts natural language to MDM query
- **Matching**: `AIEnhancedMatcher` → optional GPT-4 augmentation for probabilistic matching
- Config in `application.yml` under `averio.claude.*` and `averio.ai.*`
- In local dev: `claude.enabled=true`, API key set in `application-local.yml` (gitignored)
- Credits must exist on the Anthropic account tied to the API key

---

## Secrets & Security

- `application-local.yml` is **gitignored** — never commit it
- All secrets in prod are injected as environment variables (see `application.yml` `${VAR:default}` pattern)
- Do not hardcode credentials anywhere in code
- In local dev, JWT auth is fully disabled — all API requests are permitted

---

## Production Environment Variables

```
NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
CLAUDE_API_KEY, CLAUDE_MODEL, CLAUDE_ENABLED
AI_ENABLED, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT
AZURE_AD_JWK_URI
CORS_ORIGINS
AVERIO_LICENSE_TIER
AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_ACCOUNT_NAME
LOG_LEVEL_APP
```

---

## What Still Needs Building

- Azure DevOps CI/CD pipeline YAML
- Unit and integration tests (JUnit 5 / Mockito on backend; Vitest on frontend)
- GraphQL schema file
- WebSocket for real-time steward notifications
- Pagination on PartyList and other list pages (backend cursor-based, frontend infinite scroll)

---

## Patent Maintenance (AVERIO-001-US)

**Docket:** AVERIO-001-US  
**Applicant:** Suvojeet Pal (Individual)  
**Inventor:** Suvojeet Pal  
**Entity:** Individual (Micro Entity)

### Patent Document Paths

| File | Path |
|---|---|
| Source (Markdown) | `docs/patent/USPTO_PATENT_APPLICATION.md` |
| Export (DOCX) | `docs/patent/USPTO_PATENT_APPLICATION.docx` |
| Export (PDF) | `docs/patent/USPTO_PATENT_APPLICATION.pdf` |
| DOCX Builder | `docs/patent/build_docx_with_figures.py` |
| Figures Generator | `docs/patent/generate_figures.py` |
| PDF Converter | `docs/patent/convert_to_pdf.py` |
| Patent Knowledge Model | `docs/patent/PATENT_AGENT.md` |

### MANDATORY: After Any Edit to `USPTO_PATENT_APPLICATION.md`

**Always regenerate both exports immediately after saving the `.md` file:**

```powershell
cd "C:\Users\Rakhi Chatterjee\Documents\averio-mdm\docs\patent"
python build_docx_with_figures.py
python convert_to_pdf.py
```

This overwrites `USPTO_PATENT_APPLICATION.docx` and `USPTO_PATENT_APPLICATION.pdf`. Never deliver a patent update without running both scripts.

### When Adding New Features / Enhancements

Every new software feature should be evaluated for patent coverage:

1. Open `docs/patent/PATENT_AGENT.md` → Innovation Inventory section
2. Classify: Already Covered / Partially Covered / Not Covered
3. If not covered: add an embodiment paragraph to the relevant `§` section in `USPTO_PATENT_APPLICATION.md` and draft new dependent claim language
4. Update the Change Log in `PATENT_AGENT.md`
5. Regenerate DOCX + PDF (run both scripts above)

### Current Patent Coverage Summary

- **5 Independent Claims** covering: nine-strategy blocking, cluster drift detection, EM self-calibration, human-in-loop ML, provisional golden identity
- **10 Dependent Claims** covering: AI/LLM matching stage, nickname expansion, dual hash map index, timeline schema, log-space EM, query-time survivorship, feature capture at decision time, provisional ID format, Union-Find clustering, 20+ similarity algorithms
- **Innovations NOT YET covered** (backlog for continuation or amendment): Golden Record Explorer multi-panel UI, session-persistent search, name-to-golden-ID typeahead, attribute filter panel, in-application test laboratory (disclosed but unclaimed)
