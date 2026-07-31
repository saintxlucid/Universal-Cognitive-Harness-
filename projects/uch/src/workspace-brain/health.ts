export interface HealthMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  unit: string;
  trend: 'improving' | 'stable' | 'degrading';
  higher_is_better: boolean;
}

export class WorkspaceHealth {
  private metrics: Map<string, HealthMetric> = new Map();
  private incidentLog: string[] = [];

  setMetric(name: string, value: number, threshold: number, unit: string, higher_is_better = true): void {
    const status = higher_is_better
      ? value >= threshold ? 'good' : value >= threshold * 0.7 ? 'warning' : 'critical'
      : value <= threshold ? 'good' : value <= threshold * 1.3 ? 'warning' : 'critical';
    const existing = this.metrics.get(name);
    const trend = existing
      ? value > existing.value ? 'improving' : value < existing.value ? 'degrading' : 'stable'
      : 'stable';

    this.metrics.set(name, { name, value, threshold, status, unit, trend, higher_is_better });
  }

  getMetric(name: string): HealthMetric | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): HealthMetric[] {
    return [...this.metrics.values()];
  }

  logIncident(description: string): void {
    this.incidentLog.push(`[${new Date().toISOString()}] ${description}`);
  }

  getIncidents(count = 10): string[] {
    return this.incidentLog.slice(-count);
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'critical' {
    const criticalCount = [...this.metrics.values()].filter((m) => m.status === 'critical').length;
    const warningCount = [...this.metrics.values()].filter((m) => m.status === 'warning').length;

    if (criticalCount > 0) return 'critical';
    if (warningCount > 2) return 'degraded';
    return 'healthy';
  }

  summary(): string {
    const metrics = [...this.metrics.values()];
    const good = metrics.filter((m) => m.status === 'good').length;
    const warning = metrics.filter((m) => m.status === 'warning').length;
    const critical = metrics.filter((m) => m.status === 'critical').length;

    return [
      `Status: ${this.getOverallStatus()}`,
      `Metrics: ${good} good, ${warning} warning, ${critical} critical`,
      `Incidents: ${this.incidentLog.length}`,
    ].join('\n');
  }
}
