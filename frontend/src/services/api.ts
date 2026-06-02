import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL ?? "") + "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ---- Party API ----
export const partyApi = {
  search: (q: string, page = 0, size = 20) =>
    api.get(`/parties/search`, { params: { q, page, size } }).then((r) => r.data),
  getById: (globalId: string) => api.get(`/parties/${globalId}`).then((r) => r.data),
  getGoldenRecord: (globalId: string, viewId?: string) =>
    api.get(`/parties/${globalId}/golden-record`, { params: viewId ? { viewId } : {} }).then((r) => r.data),
  getSources: (globalId: string) => api.get(`/parties/${globalId}/sources`).then((r) => r.data),
  getTimeline: (globalId: string) => api.get(`/parties/${globalId}/timeline`).then((r) => r.data),
  getSimilar: (globalId: string) => api.get(`/parties/${globalId}/similar`).then((r) => r.data),
  create: (party: Record<string, unknown>) => api.post(`/parties`, party).then((r) => r.data),
  update: (globalId: string, updates: Record<string, unknown>) =>
    api.put(`/parties/${globalId}`, updates).then((r) => r.data),
  merge: (survivingId: string, mergedId: string, reason?: string) =>
    api.post(`/parties/merge`, null, { params: { survivingGoldenId: survivingId, mergedGoldenId: mergedId, reason } }).then((r) => r.data),
  restore: (globalId: string, timestamp: string) =>
    api.post(`/parties/${globalId}/restore`, null, { params: { timestamp } }).then((r) => r.data),
  generateGoldenId: (globalId: string, customGoldenId?: string) =>
    api.post(`/parties/${globalId}/generate-golden-id`, null, {
      params: customGoldenId ? { customGoldenId } : {},
    }).then((r) => r.data),
  ingest: (party: Record<string, unknown>) => api.post(`/parties/ingest`, party).then((r) => r.data),
  getGoldenRecords: () => api.get(`/parties/golden`).then((r) => r.data),
  uploadPhoto: (globalId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/parties/${globalId}/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data as { photoUrl: string });
  },
  getPhoto: (globalId: string) =>
    api.get(`/parties/${globalId}/photo`).then((r) => r.data as { photoUrl: string }),
  deletePhoto: (globalId: string) =>
    api.delete(`/parties/${globalId}/photo`).then((r) => r.data),
  suggest: (q: string, limit = 10) =>
    api.get(`/parties/suggest`, { params: { q, limit } }).then((r) => r.data as PartySuggestion[]),
};

export interface PartySuggestion {
  globalId: string;
  displayName: string;
  partyType: string;
  taxId?: string;
  status?: string;
  sourceSystem?: string;
  addressSnippet?: string;
}

// ---- Dashboard API ----
export const dashboardApi = {
  getMetrics: () => api.get(`/dashboard/metrics`).then((r) => r.data),
};

// ---- Governance API ----
export const governanceApi = {
  getDashboard: () => api.get(`/governance/dashboard`).then((r) => r.data),
  getSurvivorshipRules: (entityType = "PARTY", viewId?: string) =>
    api.get(`/governance/survivorship-rules`, { params: { entityType, viewId } }).then((r) => r.data),
  saveSurvivorshipRule: (rule: unknown) => api.post(`/governance/survivorship-rules`, rule).then((r) => r.data),
  deleteSurvivorshipRule: (ruleId: string) => api.delete(`/governance/survivorship-rules/${ruleId}`).then((r) => r.data),
  getMatchingRules: (entityType = "PARTY", viewId?: string) =>
    api.get(`/governance/matching-rules`, { params: { entityType, viewId } }).then((r) => r.data),
  saveMatchingRule: (rule: unknown) => api.post(`/governance/matching-rules`, rule).then((r) => r.data),
  deleteMatchingRule: (ruleId: string) => api.delete(`/governance/matching-rules/${ruleId}`).then((r) => r.data),
  getPolicies: (entityType?: string, viewId?: string) =>
    api.get(`/governance/policies`, { params: { entityType, viewId } }).then((r) => r.data),
  savePolicy: (policy: unknown) => api.post(`/governance/policies`, policy).then((r) => r.data),
  deletePolicy: (policyId: string) => api.delete(`/governance/policies/${policyId}`).then((r) => r.data),
};

// ---- Enterprise Views API ----
export const enterpriseViewApi = {
  getAll: () => api.get(`/enterprise-views`).then((r) => r.data),
  getById: (viewId: string) => api.get(`/enterprise-views/${viewId}`).then((r) => r.data),
  save: (view: unknown) => api.post(`/enterprise-views`, view).then((r) => r.data),
  delete: (viewId: string) => api.delete(`/enterprise-views/${viewId}`).then((r) => r.data),
  getStats: (viewId: string) => api.get(`/enterprise-views/${viewId}/stats`).then((r) => r.data),
  getAllStats: () => api.get(`/enterprise-views/stats/all`).then((r) => r.data),
};

// ---- Steward API ----
export const stewardApi = {
  getTasks: (priority?: string) => api.get(`/steward/tasks`, { params: { priority } }).then((r) => r.data),
  getMyTasks: () => api.get(`/steward/tasks/my`).then((r) => r.data),
  getTask: (taskId: string) => api.get(`/steward/tasks/${taskId}`).then((r) => r.data),
  assignTask: (taskId: string, assignee: string) =>
    api.post(`/steward/tasks/${taskId}/assign`, null, { params: { assignee } }).then((r) => r.data),
  resolveTask: (taskId: string, resolution: string, notes?: string) =>
    api.post(`/steward/tasks/${taskId}/resolve`, null, { params: { resolution, notes } }).then((r) => r.data),
  escalateTask: (taskId: string) => api.post(`/steward/tasks/${taskId}/escalate`).then((r) => r.data),
  getQueueSummary: () => api.get(`/steward/queue-summary`).then((r) => r.data),
  forceMatchReview: (sourceId1: string, sourceId2: string, priority = "MEDIUM") =>
    api.post(`/steward/force-match-review`, null, {
      params: { sourceId1, sourceId2, priority },
    }).then((r) => r.data),
  seedDemoTasks: () => api.post(`/steward/demo/seed`).then((r) => r.data),
  getMatchDetail: (taskId: string) => api.get(`/steward/tasks/${taskId}/match-detail`).then((r) => r.data),
};

// ---- AI API ----
export const aiApi = {
  chat: (message: string, history: Array<{ role: string; content: string }>) =>
    api.post(`/ai/chat`, { message, history }).then((r) => r.data),
  analyzeQuality: (entityId: string) => api.get(`/ai/quality-analysis/${entityId}`).then((r) => r.data),
  getRecommendations: (goldenRecordId: string) =>
    api.get(`/ai/match-recommendations/${goldenRecordId}`).then((r) => r.data),
};

// ---- Account API ----
export const accountApi = {
  list: (page = 0, size = 20) => api.get(`/accounts`, { params: { page, size } }).then((r) => r.data),
  search: (q: string, page = 0, size = 20) => api.get(`/accounts/search`, { params: { q, page, size } }).then((r) => r.data),
  getById: (id: string) => api.get(`/accounts/${id}`).then((r) => r.data),
  getByParty: (partyId: string) => api.get(`/accounts/party/${partyId}`).then((r) => r.data),
  create: (account: Record<string, unknown>) => api.post(`/accounts`, account).then((r) => r.data),
  update: (id: string, updates: Record<string, unknown>) => api.put(`/accounts/${id}`, updates).then((r) => r.data),
};

// ---- Product API ----
export const productApi = {
  list: (page = 0, size = 20) => api.get(`/products`, { params: { page, size } }).then((r) => r.data),
  search: (q: string, page = 0, size = 20) => api.get(`/products/search`, { params: { q, page, size } }).then((r) => r.data),
  getById: (id: string) => api.get(`/products/${id}`).then((r) => r.data),
  getByType: (type: string) => api.get(`/products/type/${type}`).then((r) => r.data),
  create: (product: Record<string, unknown>) => api.post(`/products`, product).then((r) => r.data),
  update: (id: string, updates: Record<string, unknown>) => api.put(`/products/${id}`, updates).then((r) => r.data),
};

// ---- Agreement API ----
export const agreementApi = {
  list: (page = 0, size = 20) => api.get(`/agreements`, { params: { page, size } }).then((r) => r.data),
  search: (q: string, page = 0, size = 20) => api.get(`/agreements/search`, { params: { q, page, size } }).then((r) => r.data),
  getById: (id: string) => api.get(`/agreements/${id}`).then((r) => r.data),
  getByParty: (partyId: string) => api.get(`/agreements/party/${partyId}`).then((r) => r.data),
  create: (agreement: Record<string, unknown>) => api.post(`/agreements`, agreement).then((r) => r.data),
  update: (id: string, updates: Record<string, unknown>) => api.put(`/agreements/${id}`, updates).then((r) => r.data),
};

// ---- NLP Search API (Claude AI) ----
export const nlpApi = {
  search: (query: string) => api.post(`/nlp/search`, { query }).then((r) => r.data),
};

// ---- Party Hierarchy API ----
export const hierarchyApi = {
  getRoots: () =>
    api.get(`/parties/hierarchy/roots`).then((r) => r.data),
  getTree: (globalId: string, maxDepth = 8) =>
    api.get(`/parties/${globalId}/hierarchy`, { params: { maxDepth } }).then((r) => r.data),
  getSummary: (globalId: string) =>
    api.get(`/parties/${globalId}/hierarchy/summary`).then((r) => r.data),
  getAncestors: (globalId: string) =>
    api.get(`/parties/${globalId}/ancestors`).then((r) => r.data),
  getUltimateParent: (globalId: string) =>
    api.get(`/parties/${globalId}/ultimate-parent`).then((r) => r.data),
  addChild: (parentId: string, childId: string, params: Record<string, unknown>) =>
    api.post(`/parties/${parentId}/hierarchy/children/${childId}`, null, { params }).then((r) => r.data),
  removeChild: (parentId: string, childId: string) =>
    api.delete(`/parties/${parentId}/hierarchy/children/${childId}`).then((r) => r.data),
};

// ---- ML Matching API ----
export const mlApi = {
  getModelInfo:    (entityType = "PARTY") =>
    api.get(`/ml/matching/model`, { params: { entityType } }).then((r) => r.data),
  getFeedbackStats:(entityType = "PARTY") =>
    api.get(`/ml/matching/feedback`, { params: { entityType } }).then((r) => r.data),
  getSuggestions:  (entityType = "PARTY", limit = 50) =>
    api.get(`/ml/matching/suggestions`, { params: { entityType, limit } }).then((r) => r.data),
  retrain:         (entityType = "PARTY") =>
    api.post(`/ml/matching/retrain`, null, { params: { entityType } }).then((r) => r.data),
  getAllModels:    () =>
    api.get(`/ml/matching/models`).then((r) => r.data),
  deleteModel:     (entityType = "PARTY") =>
    api.delete(`/ml/matching/model`, { params: { entityType } }).then((r) => r.data),
};

// ---- Audit API ----
export const auditApi = {
  getTransactionLogs: (entityType?: string, entityId?: string, performedBy?: string, status?: string) =>
    api.get(`/audit/transaction-logs`, { params: { entityType, entityId, performedBy, status } }).then((r) => r.data),
  getSystemLogs: (level?: string) =>
    api.get(`/audit/system-logs`, { params: { level } }).then((r) => r.data),
  getStats: () =>
    api.get(`/audit/stats`).then((r) => r.data),
};

// ---- Reference Data API ----
export const referenceDataApi = {
  getAllGrouped:   () => api.get(`/reference-data`).then((r) => r.data),
  getAllGroupedActive: () => api.get(`/reference-data/active`).then((r) => r.data),
  getCategories:  () => api.get(`/reference-data/categories`).then((r) => r.data),
  getByCategory:  (category: string) => api.get(`/reference-data/${category}`).then((r) => r.data),
  getActiveByCategory: (category: string) => api.get(`/reference-data/${category}/active`).then((r) => r.data),
  resolveCode:    (category: string, code: number) =>
    api.get(`/reference-data/${category}/resolve/${code}`).then((r) => r.data),
  save:       (item: unknown) => api.post(`/reference-data`, item).then((r) => r.data),
  update:     (item: unknown) => api.post(`/reference-data`, item).then((r) => r.data),
  delete:     (id: string)    => api.delete(`/reference-data/${id}`).then((r) => r.data),
  reactivate: (id: string)    => api.post(`/reference-data/${id}/reactivate`).then((r) => r.data),
  reseed:     ()              => api.post(`/reference-data/reseed`).then((r) => r.data),
};

// ---- Dynamic Entity Modeling API ----
export type FieldDefinition = {
  fieldKey: string; label: string; fieldType: string;
  referenceCategory?: string; required?: boolean;
  survivable?: boolean; matchable?: boolean;
  placeholder?: string; helpText?: string; defaultValue?: string;
  validationRegex?: string; displayOrder?: number; maxLength?: number;
};

export type DynamicSchema = {
  id?: string; domain: string; schemaKey: string; displayName: string;
  description?: string; schemaType: string; allowMultiple?: boolean;
  isActive?: boolean; displayOrder?: number; colorHint?: string;
  partyTypes?: string[];          // null/empty = all; otherwise INDIVIDUAL|ORGANIZATION|HOUSEHOLD|EMPLOYEE
  isReferenceData?: boolean;      // schema is backed by a reference data category
  referenceDataCategory?: string; // category key when isReferenceData = true
  coreObjectType?: string;        // null = custom; otherwise extends IDENTIFIER|ADDRESS|PHONE|EMAIL|etc.
  fields?: FieldDefinition[];
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
};

export type DynamicAttributeValue = {
  id?: string; entityId?: string; domain?: string; schemaKey?: string;
  instanceId?: string; values: Record<string, unknown>;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
};

export const dynamicSchemaApi = {
  getAll:              ()                         => api.get(`/entity-modeling/schemas`).then((r) => r.data),
  getAllForDomain:     (domain: string)            => api.get(`/entity-modeling/schemas/${domain}`).then((r) => r.data),
  getActiveForDomain:  (domain: string)           => api.get(`/entity-modeling/schemas/${domain}/active`).then((r) => r.data),
  getFieldDescriptors: (domain: string)           => api.get(`/entity-modeling/schemas/${domain}/field-descriptors`).then((r) => r.data),
  save:                (schema: DynamicSchema)    => api.post(`/entity-modeling/schemas`, schema).then((r) => r.data),
  toggle:              (id: string)               => api.post(`/entity-modeling/schemas/${id}/toggle`).then((r) => r.data),
  delete:              (id: string)               => api.delete(`/entity-modeling/schemas/${id}`).then((r) => r.data),
};

export const dynamicAttributeApi = {
  getForEntity:    (domain: string, entityId: string)                          => api.get(`/entity-modeling/attributes/${domain}/${entityId}`).then((r) => r.data),
  saveSchemaValues: (domain: string, entityId: string, schemaKey: string, values: DynamicAttributeValue[]) =>
    api.post(`/entity-modeling/attributes/${domain}/${entityId}/${schemaKey}`, values).then((r) => r.data),
  deleteInstance:  (id: string)                                                => api.delete(`/entity-modeling/attributes/${id}`).then((r) => r.data),
};

// ---- Address API ----
export type PartyAddress = {
  addressId?: string;
  addressType?: string;
  isPrimary?: boolean;
  isVerified?: boolean;
  line1?: string; line2?: string; line3?: string;
  city?: string; stateProvince?: string; postalCode?: string;
  county?: string; country?: string; countryCode?: string;
  effectiveStartDate?: string; effectiveEndDate?: string;
  endDate?: string; gdprPurgeDate?: string; endReason?: string;
  createdAt?: string; updatedAt?: string; createdBy?: string; updatedBy?: string;
};

export const addressApi = {
  list:        (globalId: string) =>
    api.get(`/parties/${globalId}/addresses`).then((r) => r.data as PartyAddress[]),
  add:         (globalId: string, addr: Partial<PartyAddress>) =>
    api.post(`/parties/${globalId}/addresses`, addr).then((r) => r.data as PartyAddress),
  update:      (globalId: string, addressId: string, addr: Partial<PartyAddress>) =>
    api.put(`/parties/${globalId}/addresses/${addressId}`, addr).then((r) => r.data as PartyAddress),
  softDelete:  (globalId: string, addressId: string, reason?: string) =>
    api.delete(`/parties/${globalId}/addresses/${addressId}`, { params: reason ? { reason } : {} }).then((r) => r.data),
  restore:     (globalId: string, addressId: string) =>
    api.post(`/parties/${globalId}/addresses/${addressId}/restore`).then((r) => r.data),
};

// ---- Phone API ----
export type PartyPhone = {
  phoneId?: string;
  phoneType?: string;
  countryDialCode?: string;
  areaCode?: string;
  exchange?: string;
  phoneNumber?: string;
  extension?: string;
  isPrimary?: boolean;
  isVerified?: boolean;
  startDate?: string;
  endDate?: string;
  endReason?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export const phoneApi = {
  list:       (globalId: string) =>
    api.get(`/parties/${globalId}/phones`).then((r) => r.data as PartyPhone[]),
  add:        (globalId: string, phone: Partial<PartyPhone>) =>
    api.post(`/parties/${globalId}/phones`, phone).then((r) => r.data as PartyPhone),
  update:     (globalId: string, phoneId: string, phone: Partial<PartyPhone>) =>
    api.put(`/parties/${globalId}/phones/${phoneId}`, phone).then((r) => r.data as PartyPhone),
  softDelete: (globalId: string, phoneId: string, reason?: string) =>
    api.delete(`/parties/${globalId}/phones/${phoneId}`, { params: reason ? { reason } : {} }).then((r) => r.data),
  restore:    (globalId: string, phoneId: string) =>
    api.post(`/parties/${globalId}/phones/${phoneId}/restore`).then((r) => r.data),
};

// ---- Email API ----
export type PartyEmail = {
  emailId?: string;
  emailType?: string;
  email?: string;
  isPrimary?: boolean;
  isVerified?: boolean;
  startDate?: string;
  endDate?: string;
  endReason?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export const emailApi = {
  list:       (globalId: string) =>
    api.get(`/parties/${globalId}/emails`).then((r) => r.data as PartyEmail[]),
  add:        (globalId: string, email: Partial<PartyEmail>) =>
    api.post(`/parties/${globalId}/emails`, email).then((r) => r.data as PartyEmail),
  update:     (globalId: string, emailId: string, email: Partial<PartyEmail>) =>
    api.put(`/parties/${globalId}/emails/${emailId}`, email).then((r) => r.data as PartyEmail),
  softDelete: (globalId: string, emailId: string, reason?: string) =>
    api.delete(`/parties/${globalId}/emails/${emailId}`, { params: reason ? { reason } : {} }).then((r) => r.data),
  restore:    (globalId: string, emailId: string) =>
    api.post(`/parties/${globalId}/emails/${emailId}/restore`).then((r) => r.data),
};

// ---- Reference Category (Schema) API ----
export const referenceCategoryApi = {
  getAll:   ()                       => api.get(`/reference-data/schema`).then((r) => r.data),
  getOne:   (key: string)            => api.get(`/reference-data/schema/${key}`).then((r) => r.data),
  save:     (category: unknown)      => api.post(`/reference-data/schema`, category).then((r) => r.data),
  update:   (key: string, cat: unknown) => api.put(`/reference-data/schema/${key}`, cat).then((r) => r.data),
  delete:   (key: string)            => api.delete(`/reference-data/schema/${key}`).then((r) => r.data),
};

// ---- License API ----
export const licenseApi = {
  getInfo: () => api.get(`/license`).then((r) => r.data),
};

// ---- AverioAI Chatbot API (Claude tool use) ----
export const chatbotApi = {
  chat: (message: string, history: Array<{ role: string; content: string }>) =>
    api.post(`/chatbot/chat`, { message, history }, { timeout: 60000 }).then((r) => r.data),
  suggestions: () => api.get(`/chatbot/suggestions`).then((r) => r.data),
};

// ---- Demo / Seed API ----
export const demoApi = {
  seedParties: () => api.post(`/demo/seed-parties`).then((r) => r.data),
};

// ---- Webhook Extension API ----

export type WebhookRegistration = {
  id?: string;
  tenantId?: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  isActive?: boolean;
  timeoutSeconds?: number;
  maxRetries?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WebhookDeliveryLog = {
  id?: string;
  webhookId?: string;
  eventId?: string;
  eventType?: string;
  entityId?: string;
  domain?: string;
  attemptNumber?: number;
  status?: string;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  durationMs?: number;
  attemptedAt?: string;
};

export type TenantApiKey = {
  id?: string;
  tenantId?: string;
  name?: string;
  keyPrefix?: string;
  isActive?: boolean;
  createdAt?: string;
  lastUsedAt?: string;
};

export type DerivedAttributeValue = {
  id?: string;
  entityId?: string;
  domain?: string;
  schemaKey?: string;
  instanceId?: string;
  values?: Record<string, unknown>;
  source?: string;
  sourceRef?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const ALL_WEBHOOK_EVENTS = [
  { group: "Party",        events: ["PARTY_CREATED",        "PARTY_UPDATED",        "PARTY_DELETED"]        },
  { group: "Account",      events: ["ACCOUNT_CREATED",      "ACCOUNT_UPDATED",      "ACCOUNT_DELETED"]      },
  { group: "Agreement",    events: ["AGREEMENT_CREATED",    "AGREEMENT_UPDATED",    "AGREEMENT_DELETED"]    },
  { group: "Relationship", events: ["RELATIONSHIP_CREATED", "RELATIONSHIP_UPDATED", "RELATIONSHIP_DELETED"] },
  { group: "Product",      events: ["PRODUCT_CREATED",      "PRODUCT_UPDATED",      "PRODUCT_DELETED"]      },
  { group: "Attributes",   events: ["DYNAMIC_ATTRIBUTE_UPDATED"]                                            },
];

export const webhookApi = {
  list:     ()                                 => api.get(`/extensions/webhooks`).then((r) => r.data as WebhookRegistration[]),
  create:   (reg: WebhookRegistration)         => api.post(`/extensions/webhooks`, reg).then((r) => r.data as WebhookRegistration),
  update:   (id: string, reg: WebhookRegistration) => api.put(`/extensions/webhooks/${id}`, reg).then((r) => r.data as WebhookRegistration),
  delete:   (id: string)                       => api.delete(`/extensions/webhooks/${id}`),
  toggle:   (id: string)                       => api.post(`/extensions/webhooks/${id}/toggle`).then((r) => r.data as WebhookRegistration),
  test:     (id: string)                       => api.post(`/extensions/webhooks/${id}/test`),
  getLogs:  (id: string)                       => api.get(`/extensions/webhooks/${id}/logs`).then((r) => r.data as WebhookDeliveryLog[]),
};

export const apiKeyApi = {
  list:     ()                => api.get(`/extensions/api-keys`).then((r) => r.data as TenantApiKey[]),
  generate: (name: string)    => api.post(`/extensions/api-keys`, { name }).then((r) => r.data as { apiKey: string; meta: TenantApiKey }),
  revoke:   (id: string)      => api.delete(`/extensions/api-keys/${id}`),
};

export const derivedAttributeApi = {
  getForEntity: (domain: string, entityId: string) =>
    api.get(`/extensions/derived/${domain}/${entityId}`).then((r) => r.data as DerivedAttributeValue[]),
};

export default api;
