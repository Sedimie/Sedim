// src/sedim/health/health-check.ts
// Stamped by Sedim minimal-module example

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error'
  uptime: number
  timestamp: string
}

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }
}

export function healthHandler(_req: unknown, res: any): void {
  const data = getHealthStatus()
  if (typeof res?.json === 'function') {
    res.json(data)
  } else if (typeof res?.send === 'function') {
    res.send(data)
  }
}
