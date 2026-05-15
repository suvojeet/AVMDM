// ============================================================
// Averio MDM — Azure Infrastructure (Bicep)
// Deploys all Azure resources for production deployment
// ============================================================

@description("Environment: prod, staging, dev")
param environment string = "prod"
param location string = resourceGroup().location
param appName string = "averio-mdm"
param neo4jAuraUri string = ""
param neo4jPassword string
@secure()
param cosmosKey string = ""
param azureOpenAiEndpoint string = ""
@secure()
param azureOpenAiKey string = ""

var prefix = "${appName}-${environment}"

// ---- Azure Container Registry ----
resource acr "Microsoft.ContainerRegistry/registries@2023-06-01-preview" = {
  name: replace("${prefix}acr", "-", "")
  location: location
  sku: { name: "Standard" }
  properties: { adminUserEnabled: true, publicNetworkAccess: "Enabled" }
}

// ---- App Service Plan ----
resource appServicePlan "Microsoft.Web/serverfarms@2022-09-01" = {
  name: "${prefix}-plan"
  location: location
  sku: { name: "P2v3", tier: "PremiumV3", capacity: 2 }
  kind: "linux"
  properties: { reserved: true }
}

// ---- Backend App Service ----
resource backendApp "Microsoft.Web/sites@2022-09-01" = {
  name: "${prefix}-api"
  location: location
  kind: "app,linux,container"
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: "DOCKER|${acr.properties.loginServer}/${appName}:latest"
      httpLoggingEnabled: true
      minTlsVersion: "1.2"
      ftpsState: "Disabled"
      alwaysOn: true
      appSettings: [
        { name: "SPRING_PROFILES_ACTIVE", value: "azure" }
        { name: "NEO4J_URI", value: neo4jAuraUri }
        { name: "NEO4J_PASSWORD", value: neo4jPassword }
        { name: "COSMOS_ENDPOINT", value: cosmosAccount.properties.documentEndpoint }
        { name: "COSMOS_KEY", value: cosmosKey }
        { name: "REDIS_HOST", value: redisCache.properties.hostName }
        { name: "AI_ENABLED", value: "true" }
        { name: "AZURE_OPENAI_ENDPOINT", value: azureOpenAiEndpoint }
        { name: "AZURE_OPENAI_KEY", value: azureOpenAiKey }
        { name: "WEBSITES_PORT", value: "8080" }
      ]
    }
    httpsOnly: true
  }
}

// ---- Frontend App Service ----
resource frontendApp "Microsoft.Web/sites@2022-09-01" = {
  name: "${prefix}-ui"
  location: location
  kind: "app,linux,container"
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: "DOCKER|${acr.properties.loginServer}/${appName}-ui:latest"
      httpLoggingEnabled: true
      minTlsVersion: "1.2"
      alwaysOn: true
    }
    httpsOnly: true
  }
}

// ---- Azure Cosmos DB ----
resource cosmosAccount "Microsoft.DocumentDB/databaseAccounts@2023-04-15" = {
  name: "${prefix}-cosmos"
  location: location
  kind: "GlobalDocumentDB"
  properties: {
    consistencyPolicy: { defaultConsistencyLevel: "Session" }
    locations: [{ locationName: location, failoverPriority: 0 }]
    databaseAccountOfferType: "Standard"
    enableAutomaticFailover: true
    capabilities: [{ name: "EnableServerless" }]
  }
}

// ---- Azure Cache for Redis ----
resource redisCache "Microsoft.Cache/redis@2023-04-01" = {
  name: "${prefix}-redis"
  location: location
  properties: {
    sku: { name: "Standard", family: "C", capacity: 1 }
    enableNonSslPort: false
    minimumTlsVersion: "1.2"
  }
}

// ---- Application Insights ----
resource appInsights "Microsoft.Insights/components@2020-02-02" = {
  name: "${prefix}-insights"
  location: location
  kind: "web"
  properties: {
    Application_Type: "web"
    Flow_Type: "Bluefield"
    Request_Source: "rest"
    RetentionInDays: 90
  }
}

// ---- Outputs ----
output backendUrl string = "https://${backendApp.properties.defaultHostName}"
output frontendUrl string = "https://${frontendApp.properties.defaultHostName}"
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output acrLoginServer string = acr.properties.loginServer
output appInsightsKey string = appInsights.properties.InstrumentationKey
