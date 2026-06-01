# Averio MDM — Azure Cloud Deployment Guide

## Architecture

```
Azure App Service (Java 21)
  └── averio-mdm.jar
        ├── Spring Boot API  (/api/v1/*)
        └── Static frontend  (/index.html, /assets/*)

Azure Cache for Redis       ← session + query cache
Azure Cosmos DB (NoSQL)     ← steward tasks, governance, audit logs
Neo4j AuraDB (or Azure VM)  ← party graph + golden records
Azure Active Directory      ← JWT authentication
Azure Blob Storage          ← party photos
```

---

## 1. Build

### Build frontend into the JAR (same-origin deployment)

```bash
# 1. Build the React frontend
cd frontend
npm ci
npm run build          # outputs to frontend/dist/

# 2. Copy dist into Spring Boot's static resources
cp -r dist/* ../backend/src/main/resources/static/

# 3. Build the fat JAR
cd ../backend
mvn clean package -DskipTests

# Result: backend/target/averio-mdm-1.0.0.jar
```

The JAR serves `index.html` for any non-API path automatically — no extra Spring MVC controller needed.

### Separate frontend deployment (Azure Static Web Apps)

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://<your-api>.azurewebsites.net npm run build
# Deploy frontend/dist/ to Azure Static Web Apps
```

---

## 2. Azure Resources Required

| Resource | SKU | Notes |
|---|---|---|
| App Service Plan | B2 or higher | Java 21, Linux |
| Azure App Service | — | Deploy the JAR |
| Azure Cache for Redis | C1 Standard | SSL on port 6380 |
| Azure Cosmos DB | Serverless | Database: `averiodb` |
| Neo4j AuraDB | Free/Professional | bolt+s:// URI |
| Azure Active Directory | — | App registration for JWT |
| Azure Blob Storage | LRS | Container: `party-photos` |

---

## 3. App Service — Application Settings (Environment Variables)

Set all of the following under **App Service → Configuration → Application Settings**.

### Required

| Setting | Value |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `azure` |
| `NEO4J_URI` | `bolt+s://<id>.databases.neo4j.io` |
| `NEO4J_USERNAME` | `neo4j` |
| `NEO4J_PASSWORD` | *(AuraDB password)* |
| `COSMOS_ENDPOINT` | `https://averio-mdmdb.documents.azure.com:443/` |
| `COSMOS_KEY` | *(Cosmos DB primary key — keep secret)* |
| `COSMOS_DATABASE` | `averiodb` |
| `REDIS_HOST` | `<name>.redis.cache.windows.net` |
| `REDIS_PORT` | `6380` |
| `REDIS_PASSWORD` | *(Redis access key)* |
| `AZURE_AD_JWK_URI` | `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys` |
| `CORS_ORIGINS` | `https://mdm.averiomdm.org` *(or your SWA URL)* |
| `CLAUDE_API_KEY` | *(Anthropic API key)* |

### Optional

| Setting | Default | Notes |
|---|---|---|
| `AI_AGENT_ENABLED` | `true` | Set `false` to disable AI features |
| `AI_AGENT_PROVIDER` | `ANTHROPIC` | Or `AZURE_OPENAI` |
| `AZURE_OPENAI_ENDPOINT` | *(blank)* | Only if using Azure OpenAI |
| `AZURE_OPENAI_KEY` | *(blank)* | Only if using Azure OpenAI |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4` | Only if using Azure OpenAI |
| `AZURE_STORAGE_CONNECTION_STRING` | *(blank)* | For party photo uploads |
| `AVERIO_LICENSE_TIER` | `FULL` | `STANDARD` / `ADVANCED` / `FULL` |

---

## 4. App Service — Startup Command

In **App Service → Configuration → General Settings → Startup Command**:

```
java -jar /home/site/wwwroot/averio-mdm-1.0.0.jar
```

Or with explicit memory tuning (recommended for B2+):

```
java -Xms512m -Xmx1g -jar /home/site/wwwroot/averio-mdm-1.0.0.jar
```

---

## 5. Deploy

Using Azure CLI:

```bash
az webapp deploy \
  --resource-group averio-rg \
  --name averio-mdm-api \
  --src-path backend/target/averio-mdm-1.0.0.jar \
  --type jar
```

Or drag-and-drop the JAR in the Azure Portal (App Service → Advanced Tools → Kudu → ZIP Deploy).

---

## 6. Health Check

Configure **App Service → Health Check** to ping:

```
/actuator/health/readiness
```

The `azure` Spring profile enables liveness and readiness probes. The endpoint returns:

```json
{ "status": "UP", "components": { "redis": {...}, "neo4j": {...} } }
```

---

## 7. Azure AD — App Registration

1. Azure Portal → Azure Active Directory → App registrations → New
2. Set **Redirect URI** to your App Service / SWA URL
3. Under **Expose an API**, add scope `api://<client-id>/access_as_user`
4. Copy the **tenant ID** → build `AZURE_AD_JWK_URI`:
   ```
   https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys
   ```
5. Set this as `AZURE_AD_JWK_URI` in App Service Application Settings

The frontend stores the JWT in `localStorage` under `auth_token` and sends it as `Authorization: Bearer <token>` on every API request.

---

## 8. Neo4j — AuraDB Setup

1. Go to [console.neo4j.io](https://console.neo4j.io) → New Instance → Free or Professional
2. Copy the **Connection URI** (format: `bolt+s://<id>.databases.neo4j.io`)
3. Set as `NEO4J_URI` in App Service settings
4. Username is always `neo4j`; password is shown once at creation — save it as `NEO4J_PASSWORD`

Alternatively, self-host Neo4j Community on an Azure Linux VM and expose bolt port 7687 (restrict to App Service outbound IPs via NSG).

---

## 9. Notes

- **Cosmos DB key**: Set only as `COSMOS_KEY` environment variable on App Service. Never commit it to `application.yml`.
- **Redis SSL**: The `azure` profile sets `ssl.enabled: true` and port `6380`. Local dev uses port `6379` (no SSL) via the `local` profile — no conflict.
- **MemoryRouter**: The frontend uses React MemoryRouter so the browser URL bar always shows the App Service root URL. No server-side SPA fallback routing is needed.
- **Static file serving**: Spring Boot auto-serves `src/main/resources/static/` as the root. `index.html` is returned for `/` and any non-API, non-actuator path that has no explicit mapping.
