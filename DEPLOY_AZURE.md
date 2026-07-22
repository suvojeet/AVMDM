# Averio MDM — Azure Deployment Guide

## What gets deployed where

| Component | Azure Resource | Status |
|---|---|---|
| React frontend | Azure Static Web App — averio-data-studio | ✅ Created |
| Spring Boot API | Azure App Service — averio-mdm-prod-api | ✅ Created |
| Cosmos DB | averio-mdmdb (averio-mdmrg) | ✅ Exists |
| Redis | averiomdmcache (averio-mdmrg) | ✅ Exists |
| Container Registry | averiomdmprodacr (averio-mdmrg) | ✅ Created |
| Neo4j | Neo4j AuraDB | ✅ Created — URI needed |

Local dev is unaffected — it still uses application-local.yml and localhost.

---

## ⚠️ One remaining item before App Service is complete

You need the **Neo4j AuraDB connection URI**:
- Go to https://console.neo4j.io
- Click your instance → copy the **Connection URI** (looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`)
- Add it as `NEO4J_URI` in App Service → Configuration (see Step 6 below)

---

## Step 6 — App Service environment variables (READY TO ENTER)

Portal → **averio-mdm-prod-api** → Configuration → Application settings → + New application setting

Enter each row below exactly as shown:

| Name | Value |
|---|---|
| SPRING_PROFILES_ACTIVE | azure |
| NEO4J_URI | neo4j+s://d3f3a6bd.databases.neo4j.io |
| NEO4J_USERNAME | neo4j |
| NEO4J_PASSWORD | *your Neo4j AuraDB password from console.neo4j.io* |
| COSMOS_ENDPOINT | https://averio-mdmdb.documents.azure.com:443/ |
| COSMOS_KEY | *your Cosmos DB primary key from portal → averio-mdmdb → Keys* |
| COSMOS_DATABASE | averiodb |
| REDIS_HOST | averiomdmcache.redis.cache.windows.net |
| REDIS_PORT | 6380 |
| REDIS_PASSWORD | *your Redis primary key from portal → averiomdmcache → Access keys* |
| CLAUDE_API_KEY | ⚠️ YOUR-ANTHROPIC-API-KEY ← paste your Claude API key |
| CLAUDE_ENABLED | true |
| AVERIO_LICENSE_TIER | FULL |
| CORS_ORIGINS | https://averio-data-studio.azurestaticapps.net |
| LOG_LEVEL_APP | INFO |
| WEBSITES_PORT | 8080 |

After entering all rows → click **Save** at the top → click **Continue** → then **Restart** the app.

---

## Step 7 — Static Web App (averio-data-studio) — already created ✅

The Static Web App was created connected to GitHub repo `suvojeet/AVMDM`.

**Get the deployment token:**
Portal → **averio-data-studio** → Overview → Manage deployment token → copy it

**Update the GitHub Actions workflow** with the correct app name — already done in `.github/workflows/azure-deploy.yml`.

**Update the frontend API URL** to point to the backend:
Portal → **averio-data-studio** → Configuration → Add:

| Name | Value |
|---|---|
| VITE_API_BASE_URL | https://averio-mdm-prod-api-d6a4fxbdh8b9hnd2.canadacentral-01.azurewebsites.net |

---

## Step 8 — Add GitHub Secrets

Go to https://github.com/suvojeet/AVMDM → Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Value |
|---|---|
| AZURE_CREDENTIALS | (JSON from Step 9 below) |
| AZURE_STATIC_WEB_APPS_TOKEN | token copied from averio-data-studio above |

---

## Step 9 — Create Azure service principal for GitHub Actions

Click the **Cloud Shell** icon (>_) at the top of the Azure portal, then run:

```bash
az ad sp create-for-rbac \
  --name "averio-mdm-github-deploy" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/averio-mdmrg \
  --sdk-auth
```

Copy the **entire JSON block** that appears → paste it as the `AZURE_CREDENTIALS` secret in GitHub.

---

## Step 10 — Push to trigger first deployment

Once secrets are added, push any change to `main`:

```powershell
cd "C:\Users\Rakhi Chatterjee\Documents\averio-mdm"
git add .
git commit -m "Add Azure deployment pipeline"
git push origin main
```

GitHub Actions will run automatically — watch it at:
https://github.com/suvojeet/AVMDM/actions

---

## Verify deployment

| Check | URL |
|---|---|
| Frontend | https://mango-hill-0f79a0d0f.7.azurestaticapps.net |
| Backend health | https://averio-mdm-prod-api-d6a4fxbdh8b9hnd2.canadacentral-01.azurewebsites.net/actuator/health |
| Swagger UI | https://averio-mdm-prod-api-d6a4fxbdh8b9hnd2.canadacentral-01.azurewebsites.net/swagger-ui.html |
| Neo4j Browser | https://console.neo4j.io |

---

## After go-live — rotate secrets

Once live and verified, replace these in App Service Configuration:
- `COSMOS_KEY` — regenerate in Portal → averio-mdmdb → Keys
- `REDIS_PASSWORD` — regenerate in Portal → averiomdmcache → Access keys
- `NEO4J_PASSWORD` — reset in Neo4j AuraDB console
