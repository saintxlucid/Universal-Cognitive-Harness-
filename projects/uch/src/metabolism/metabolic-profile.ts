export interface MetabolicCost {
  cpu: number;
  memory: number;
  tokens: number;
  latency: number;
  storage: number;
  network: number;
}

export type EnergyUnit = 'cycles' | 'bytes' | 'tokens' | 'ms' | 'kb';

export interface EnergyAllocation {
  cpu: number;
  memory: number;
  tokens: number;
  latency: number;
  storage: number;
  network: number;
}

export interface ComponentBudget {
  componentId: string;
  allocated: EnergyAllocation;
  consumed: EnergyAllocation;
  remaining: EnergyAllocation;
}

export function zeroAllocation(): EnergyAllocation {
  return { cpu: 0, memory: 0, tokens: 0, latency: 0, storage: 0, network: 0 };
}

export function subtractAllocation(
  a: EnergyAllocation,
  b: EnergyAllocation,
): EnergyAllocation {
  return {
    cpu: Math.max(0, a.cpu - b.cpu),
    memory: Math.max(0, a.memory - b.memory),
    tokens: Math.max(0, a.tokens - b.tokens),
    latency: Math.max(0, a.latency - b.latency),
    storage: Math.max(0, a.storage - b.storage),
    network: Math.max(0, a.network - b.network),
  };
}

export function canAfford(
  budget: EnergyAllocation,
  cost: EnergyAllocation,
): boolean {
  return (
    budget.cpu >= cost.cpu &&
    budget.memory >= cost.memory &&
    budget.tokens >= cost.tokens &&
    budget.latency >= cost.latency &&
    budget.storage >= cost.storage &&
    budget.network >= cost.network
  );
}
