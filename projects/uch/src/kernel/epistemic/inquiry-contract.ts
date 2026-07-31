/**
 * Inquiry Contract — the cross-cutting evidentiary metadata contract
 * (blueprint §4). Any organ producing an evidentiary claim (Etiology
 * Engine root causes, Frontier Mapper gaps, Decision Router selections)
 * must attach a populated contract; organ outputs without one cannot be
 * promoted past the Information tier by the Epistemic Elevation Engine.
 *
 * Encodes the 5-stage Research Methodology (design → collection →
 * analysis → sampling → ethics) as a required struct rather than a
 * parallel "Research Methodology organ" — enforcing Law 12 (Reversibility)
 * and the Constitution's evidentiary posture structurally.
 */

export type InquiryDesign =
  | 'qualitative'
  | 'quantitative'
  | 'mixed'
  | 'log-derived'
  | 'static-analysis';

export interface InquiryContract {
  /** Why this design fits the question (DYC). */
  design_justification: string;
  /** Where the evidence came from, reproducibly. */
  data_collection_method: string;
  /** How conclusions were derived from the evidence. */
  analysis_method: string;
  /** What population/codebase-slice this covers — and what it does not. */
  sample_scope: string;
  /** Privacy, blast-radius, what was NOT touched. */
  ethics_and_scope_limits: string;
  /** Confidence (0-1) from the Epistemic Immune System gate. */
  confidence: number;
  design: InquiryDesign;
}

const EMPTY_FIELDS: (keyof InquiryContract)[] = [
  'design_justification',
  'data_collection_method',
  'analysis_method',
  'sample_scope',
  'ethics_and_scope_limits',
];

export function createInquiryContract(
  input: Omit<InquiryContract, 'confidence'> & { confidence?: number },
): InquiryContract {
  return {
    design: input.design,
    design_justification: input.design_justification,
    data_collection_method: input.data_collection_method,
    analysis_method: input.analysis_method,
    sample_scope: input.sample_scope,
    ethics_and_scope_limits: input.ethics_and_scope_limits,
    confidence: input.confidence ?? 0.5,
  };
}

export type InquiryContractValidation =
  | { valid: true; missing: string[] }
  | { valid: false; missing: string[] };

/**
 * Structural validation: every field must be a non-empty string (or a
 * valid confidence number). Empty required fields mean the contract was
 * not populated — the claim cannot be promoted.
 */
export function validateInquiryContract(
  contract: InquiryContract | null | undefined,
): InquiryContractValidation {
  if (!contract) {
    return { valid: false, missing: ['(entire contract missing)'] };
  }

  const missing: string[] = [];
  for (const field of EMPTY_FIELDS) {
    const value = contract[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      missing.push(field);
    }
  }
  if (
    typeof contract.confidence !== 'number' ||
    Number.isNaN(contract.confidence) ||
    contract.confidence < 0 ||
    contract.confidence > 1
  ) {
    missing.push('confidence');
  }
  if (!contract.design) {
    missing.push('design');
  }

  return { valid: missing.length === 0, missing };
}

/**
 * A claim is eligible for the Knowledge tier and above only when the
 * contract is fully populated — this is the mechanism that makes the
 * evidentiary trail a structural guarantee, not a hope.
 */
export function isInquiryEligible(
  contract: InquiryContract | null | undefined,
): boolean {
  const result = validateInquiryContract(contract);
  return result.valid;
}
