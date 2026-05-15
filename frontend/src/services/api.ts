import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
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
  getGoldenRecord: (globalId: string) => api.get(`/parties/${globalId}/golden-record`).then((r) => r.data),
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
};

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
  getCategories:  () => api.get(`/reference-data/categories`).then((r) => r.data),
  getByCategory:  (category: string) => api.get(`/reference-data/${category}`).then((r) => r.data),
  resolveCode:    (category: string, code: number) =>
    api.get(`/reference-data/${category}/resolve/${code}`).then((r) => r.data),
  save:   (item: unknown) => api.post(`/reference-data`, item).then((r) => r.data),
  delete: (id: string)    => api.delete(`/reference-data/${id}`).then((r) => r.data),
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

export default api;
