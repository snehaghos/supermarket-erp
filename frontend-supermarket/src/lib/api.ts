const API_BASE = '/api'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

function getAuthHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' }
}

// ── Generic CRUD helpers ────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: getAuthHeaders() })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

async function del<T = void>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  return handleResponse<T>(res)
}

// ──── Types ─────────────────────────────────────────────────────────

export interface UnitRow {
  id: string
  name: string
  symbol: string
  type: 'Packaging' | 'Quantity' | 'Weight' | 'Volume' | 'Length'
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface CreateUnitInput {
  name: string
  symbol: string
  type: UnitRow['type']
}

export interface UpdateUnitInput {
  name?: string
  symbol?: string
  type?: UnitRow['type']
}

export interface ConversionRow {
  id: string
  parentUnitId: string
  childUnitId: string
  factor: number
  parentUnitName: string
  parentUnitSymbol: string
  childUnitName: string
  childUnitSymbol: string
  createdAt: string
}

export interface CreateConversionInput {
  parentUnitId: string
  childUnitId: string
  factor: number
}

export interface UpdateConversionInput {
  parentUnitId?: string
  childUnitId?: string
  factor?: number
}

export interface ConversionStep {
  unitId: string
  unitName: string
  unitSymbol: string
  quantity: number
}

export interface PreviewResult {
  steps: ConversionStep[]
}

export interface HealthCheck {
  status: string
  timestamp: string
  uptime: number
}

// ──── Units API ─────────────────────────────────────────────────────

export const unitsApi = {
  getAll: () => get<UnitRow[]>('/units'),
  getById: (id: string) => get<UnitRow>(`/units/${id}`),
  create: (input: CreateUnitInput) => post<UnitRow>('/units', input),
  update: (id: string, input: UpdateUnitInput) => patch<UnitRow>(`/units/${id}`, input),
  delete: (id: string) => del(`/units/${id}`),
}

// ──── Conversions API ───────────────────────────────────────────────

export const conversionsApi = {
  getAll: () => get<ConversionRow[]>('/conversions'),
  getById: (id: string) => get<ConversionRow>(`/conversions/${id}`),
  create: (input: CreateConversionInput) => post<ConversionRow>('/conversions', input),
  update: (id: string, input: UpdateConversionInput) => patch<ConversionRow>(`/conversions/${id}`, input),
  delete: (id: string) => del(`/conversions/${id}`),
  preview: (quantity: number, unitId: string) =>
    post<PreviewResult>('/conversions/preview', { quantity, unitId }),
}

// ──── Health API ────────────────────────────────────────────────────

export const healthApi = {
  check: () => get<HealthCheck>('/health'),
}
