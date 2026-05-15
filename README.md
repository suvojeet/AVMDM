# Averio MDM — Enterprise Master Data Management Platform
### An Averio Company Product

> **The World's Most Advanced Enterprise MDM Solution**
> Built for Fortune 500 enterprises like JP Morgan Chase, Blue Cross Blue Shield, and global conglomerates.

---

## Overview

**Averio MDM** is a cloud-native, AI-powered Master Data Management platform that delivers real-time Golden Records, intelligent entity resolution, and comprehensive data governance across all enterprise data domains.

### Core Domains
| Domain | Description |
|--------|-------------|
| **Party** | Individual, Organization, Employee, Customer, Household |
| **Account** | Financial Accounts, Contract Accounts, Service Accounts |
| **Product** | Products, Services, Bundles, Catalogs |
| **Agreement** | Contracts, Policies, SLAs, Amendments |
| **Relationship** | Party-Party, Party-Account, Account-Product, and 50+ relationship types |
| **Reference Data** | Codes, Classifications, Taxonomies, Hierarchies |

---

## Key Capabilities

### Golden Record Engine
- Real-time golden record creation from multiple source systems
- Configurable survivorship rules (Source Priority, Most Recent, Most Frequent, ML-based)
- Supremacy rules for critical attribute overrides
- Confidence scoring with explainability

### AI-Powered Entity Resolution
- Probabilistic + Deterministic + ML matching
- Azure OpenAI LLM-based fuzzy matching
- Cross-domain deduplication at scale
- Unique Match ID generation across all party sources

### Graph Relationship Management
- Neo4j-powered relationship graph (Party-to-Party, Party-to-Account, etc.)
- Visual relationship explorer with D3.js
- Relationship lineage and impact analysis
- Complex hierarchy management

### Timeline & Point-in-Time Recovery
- Complete audit trail of every entity change
- Visual party journey timeline
- One-click point-in-time restore to any historical state
- Change delta visualization

### Data Governance Console
- Policy definition and enforcement
- Data quality rules and monitoring
- Compliance dashboards (GDPR, CCPA, HIPAA)
- Data lineage tracking

### Data Steward Console
- Task management and workflow approvals
- Exception queue management
- Merge/Unmerge operations
- Data quality remediation workflows

### AI Assistant
- Natural language data queries ("Show me all parties related to JP Morgan")
- Anomaly detection and alerting
- Smart match recommendations
- Data quality scoring predictions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure App Service                           │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │   ReactJS UI     │    │    Mobile HTML5 (iPad/Phone)      │  │
│  │  (TypeScript)    │    │    Progressive Web App            │  │
│  └────────┬─────────┘    └──────────────┬───────────────────┘  │
│           │ REST/GraphQL                 │                       │
│  ┌────────▼─────────────────────────────▼───────────────────┐  │
│  │              Spring Boot API Gateway                      │  │
│  │    (Spring Security / Azure AD / OAuth2 / JWT)            │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │                  Microservices Layer                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   │  │
│  │  │  Party   │ │ Account  │ │ Product  │ │  Agreement │   │  │
│  │  │ Service  │ │ Service  │ │ Service  │ │  Service   │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   │  │
│  │  │ Matching │ │Survivor- │ │Governance│ │  Steward   │   │  │
│  │  │ Engine   │ │  ship    │ │ Service  │ │  Service   │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   │  │
│  │  │ Timeline │ │   AI     │ │  Search  │ │  Ref Data  │   │  │
│  │  │ Service  │ │ Service  │ │ Service  │ │  Service   │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │   Neo4j Graph   │  │  Cosmos DB   │  │  Azure OpenAI /    │ │
│  │   Database      │  │  (Audit/     │  │  Cognitive Search  │ │
│  │  (Relations)    │  │  Timeline)   │  │  (AI/ML)           │ │
│  └─────────────────┘  └──────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21, Spring Boot 3.x, Spring Security |
| Graph DB | Neo4j 5.x (Aura Enterprise) |
| Document DB | Azure Cosmos DB |
| Frontend | React 18, TypeScript, Tailwind CSS, D3.js |
| Mobile | HTML5, PWA, Responsive Design |
| AI/ML | Azure OpenAI GPT-4, Azure Cognitive Services |
| Search | Azure Cognitive Search |
| Messaging | Azure Service Bus |
| Auth | Azure AD, OAuth2, JWT |
| Deployment | Azure App Service, Azure Container Registry |
| CI/CD | Azure DevOps Pipelines |
| API | OpenAPI 3.0, REST, GraphQL |

---

## Quick Start

### Prerequisites
- Java 21+
- Node.js 20+
- Docker Desktop
- Azure CLI
- Neo4j 5.x

### Local Development
```bash
# Clone the repository
git clone https://github.com/averio/averio-mdm.git
cd averio-mdm

# Start all services with Docker Compose
docker-compose up -d

# Backend
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# Frontend
cd frontend
npm install
npm start
```

### Access
- **Web UI**: http://localhost:3000
- **API Docs (Swagger)**: http://localhost:8080/swagger-ui.html
- **Neo4j Browser**: http://localhost:7474
- **Mobile UI**: http://localhost:3000/mobile

---

## Deployment to Azure

```bash
# Login to Azure
az login

# Deploy infrastructure
cd infrastructure/azure
az deployment group create \
  --resource-group averio-mdm-prod \
  --template-file main.bicep \
  --parameters @params.prod.json

# Deploy application
az webapp deploy \
  --resource-group averio-mdm-prod \
  --name averio-mdm-api \
  --src-path target/averio-mdm.jar
```

---

## Enterprise Licensing

Contact: sales@averiomdm.org | www.averiomdm.org

© 2026 Averio Company. All rights reserved.
"# AVMDM" 
