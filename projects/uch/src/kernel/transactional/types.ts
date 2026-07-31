export type Clock = () => Date;

export interface GateVerdict {
  gateId: string;
  pass: boolean;
  reason?: string;
}

export interface VerificationGate {
  id: string;
  verify(proposal: unknown): GateVerdict;
}

export type TransactionStatus = 'proposed' | 'committed' | 'rolled-back';

export interface Transaction {
  id: string;
  proposal: unknown;
  status: TransactionStatus;
  openedAt: Date;
  committedAt?: Date;
  verdicts: GateVerdict[];
}
