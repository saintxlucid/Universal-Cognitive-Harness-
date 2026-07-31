import type { Concept, ConceptType } from '../types/concept.js';

export interface GeneMarker {
  locus: string;
  allele: string;
  chromosome: ConceptType;
  dominant: boolean;
  expressivity: number;
}

export interface ConceptDNA {
  genomeId: string;
  conceptId: string;
  geneSequence: GeneMarker[];
  parentIds: string[];
  mutationHistory: MutationEvent[];
  generation: number;
  fitness: number;
  compatibilityProfile: string[];
}

export interface MutationEvent {
  generation: number;
  locus: string;
  fromAllele: string;
  toAllele: string;
  cause: 'fusion' | 'drift' | 'environmental' | 'deliberate';
  timestamp: Date;
}

export interface FusionProposal {
  parentA: string;
  parentB: string;
  childDNA: ConceptDNA;
  compatibilityScore: number;
  predictedFitness: number;
}

export type GenomeComparison =
  | 'identical'
  | 'sibling'
  | 'cousin'
  | 'compatible'
  | 'incompatible';

export interface ConceptGenomeStats {
  encodedConcepts: number;
  averageGeneration: number;
  averageFitness: number;
  totalMutations: number;
  fusionCount: number;
  topFitness: { conceptId: string; fitness: number }[];
}

function hashString(str: string, max = 100000): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % max);
}

function conceptTypeCompatibility(a: ConceptType, b: ConceptType): number {
  const matrix: Record<string, Record<string, number>> = {
    entity: { entity: 1.0, relation: 0.5, process: 0.4, quality: 0.6, value: 0.3 },
    relation: { entity: 0.5, relation: 1.0, process: 0.6, quality: 0.4, value: 0.3 },
    process: { entity: 0.4, relation: 0.6, process: 1.0, quality: 0.5, value: 0.4 },
    quality: { entity: 0.6, relation: 0.4, process: 0.5, quality: 1.0, value: 0.7 },
    value: { entity: 0.3, relation: 0.3, process: 0.4, quality: 0.7, value: 1.0 },
  };
  return matrix[a]?.[b] ?? 0.3;
}

function dominance(concept: Concept, _key: string): boolean {
  const accessDominance = concept.access_count > 5;
  const confidenceDominance = concept.confidence.value > 0.7;
  const entrenchmentDominance = (concept.entrenchment as number) >= 4;
  return accessDominance || confidenceDominance || entrenchmentDominance;
}

function expressivity(concept: Concept): number {
  return (
    concept.importance * 0.3 +
    concept.prediction_value * 0.3 +
    (concept.entrenchment as number) / 5 * 0.2 +
    concept.confidence.value * 0.2
  );
}

export class ConceptGenome {
  private dnaRegistry: Map<string, ConceptDNA> = new Map();
  private fusionCount = 0;

  encode(concept: Concept): ConceptDNA {
    const existing = this.dnaRegistry.get(concept.id);
    if (existing) return existing;

    const markers: GeneMarker[] = [];
    let locusIdx = 0;

    markers.push({
      locus: `type_${locusIdx++}`,
      allele: concept.concept_type,
      chromosome: concept.concept_type,
      dominant: true,
      expressivity: 1.0,
    });

    for (const rel of concept.is_a) {
      markers.push({
        locus: `is_a_${locusIdx++}`,
        allele: rel,
        chromosome: concept.concept_type,
        dominant: dominance(concept, 'is_a'),
        expressivity: expressivity(concept),
      });
    }

    for (const rel of concept.part_of) {
      markers.push({
        locus: `part_of_${locusIdx++}`,
        allele: rel,
        chromosome: concept.concept_type,
        dominant: dominance(concept, 'part_of'),
        expressivity: expressivity(concept),
      });
    }

    for (const rel of concept.causes) {
      markers.push({
        locus: `causes_${locusIdx++}`,
        allele: rel,
        chromosome: concept.concept_type,
        dominant: dominance(concept, 'causes'),
        expressivity: expressivity(concept),
      });
    }

    for (const rel of concept.contradicts) {
      markers.push({
        locus: `contradicts_${locusIdx++}`,
        allele: rel,
        chromosome: concept.concept_type,
        dominant: true,
        expressivity: expressivity(concept),
      });
    }

    const nameMarker: GeneMarker = {
      locus: `name_${locusIdx++}`,
      allele: `${hashString(concept.name)}`,
      chromosome: concept.concept_type,
      dominant: true,
      expressivity: 1.0,
    };
    markers.push(nameMarker);

    const definitionChunks = concept.definition.match(/.{1,50}/g) ?? [concept.definition];
    for (const chunk of definitionChunks) {
      markers.push({
        locus: `def_${locusIdx++}`,
        allele: `${hashString(chunk)}`,
        chromosome: concept.concept_type,
        dominant: false,
        expressivity: expressivity(concept),
      });
    }

    const embeddingMarker: GeneMarker = {
      locus: `embedding_${locusIdx}`,
      allele: concept.embedding.length > 0
        ? `${concept.embedding.reduce((a, b) => a + Math.abs(b), 0).toFixed(4)}`
        : '0',
      chromosome: concept.concept_type,
      dominant: concept.embedding.length > 0,
      expressivity: concept.embedding.length > 0 ? expressivity(concept) : 0,
    };
    markers.push(embeddingMarker);

    const compatProfile = [
      concept.concept_type,
      ...concept.is_a,
      ...concept.part_of,
      concept.epistemic_status,
    ];

    const dna: ConceptDNA = {
      genomeId: `genome:${concept.id}`,
      conceptId: concept.id,
      geneSequence: markers,
      parentIds: [],
      mutationHistory: [],
      generation: 0,
      fitness: concept.importance * 0.4 + expressivity(concept) * 0.3 + concept.prediction_value * 0.3,
      compatibilityProfile: compatProfile,
    };

    this.dnaRegistry.set(concept.id, dna);
    return dna;
  }

  getDNA(conceptId: string): ConceptDNA | undefined {
    return this.dnaRegistry.get(conceptId);
  }

  similarity(a: ConceptDNA, b: ConceptDNA): number {
    const aLoci = new Set(a.geneSequence.map((g) => g.locus));
    const bLoci = new Set(b.geneSequence.map((g) => g.locus));

    const allLoci = new Set([...aLoci, ...bLoci]);
    const aMap = new Map(a.geneSequence.map((g) => [g.locus, g.allele]));
    const bMap = new Map(b.geneSequence.map((g) => [g.locus, g.allele]));

    let matches = 0;
    let total = 0;

    for (const locus of allLoci) {
      const aAllele = aMap.get(locus);
      const bAllele = bMap.get(locus);
      if (aAllele !== undefined && bAllele !== undefined) {
        total++;
        if (aAllele === bAllele) matches++;
      }
    }

    const typeCompat = conceptTypeCompatibility(
      a.geneSequence[0]?.allele as ConceptType,
      b.geneSequence[0]?.allele as ConceptType,
    );

    const profileOverlap = a.compatibilityProfile.filter((p) =>
      b.compatibilityProfile.includes(p),
    ).length / Math.max(a.compatibilityProfile.length, b.compatibilityProfile.length, 1);

    const jaccard = total > 0 ? matches / total : 0;

    return jaccard * 0.5 + typeCompat * 0.3 + profileOverlap * 0.2;
  }

  compare(conceptA: Concept, conceptB: Concept): GenomeComparison {
    const dnaA = this.encode(conceptA);
    const dnaB = this.encode(conceptB);

    if (dnaA.conceptId === dnaB.conceptId) return 'identical';

    const sim = this.similarity(dnaA, dnaB);
    const sharedParent = dnaA.parentIds.some((p) => dnaB.parentIds.includes(p));

    if (sim > 0.85) return 'sibling';
    if (sim > 0.65) return 'cousin';
    if (sharedParent || sim > 0.4) return 'compatible';

    return 'incompatible';
  }

  fuse(a: Concept, b: Concept): FusionProposal {
    const dnaA = this.encode(a);
    const dnaB = this.encode(b);
    const sim = this.similarity(dnaA, dnaB);
    const compat = conceptTypeCompatibility(a.concept_type, b.concept_type);

    const combinedScore = (sim + compat) / 2;
    const isCompatible = combinedScore > 0.3;

    if (!isCompatible) {
      const minFitness = Math.min(
        a.importance * 0.4 + expressivity(a) * 0.3 + a.prediction_value * 0.3,
        b.importance * 0.4 + expressivity(b) * 0.3 + b.prediction_value * 0.3,
      );
      return {
        parentA: a.id,
        parentB: b.id,
        childDNA: {
          genomeId: `genome:fusion:failed:${a.id}:${b.id}`,
          conceptId: '',
          geneSequence: [],
          parentIds: [a.id, b.id],
          mutationHistory: [{
            generation: 0,
            locus: 'fusion',
            fromAllele: 'incompatible',
            toAllele: 'incompatible',
            cause: 'fusion',
            timestamp: new Date(),
          }],
          generation: 0,
          fitness: minFitness * 0.1,
          compatibilityProfile: [],
        },
        compatibilityScore: combinedScore,
        predictedFitness: minFitness * 0.1,
      };
    }

    this.fusionCount++;

    const childMarkers: GeneMarker[] = [];
    const aMap = new Map(dnaA.geneSequence.map((g) => [g.locus, g]));
    const bMap = new Map(dnaB.geneSequence.map((g) => [g.locus, g]));

    const uniqueLoci = new Set([
      ...dnaA.geneSequence.map((g) => g.locus),
      ...dnaB.geneSequence.map((g) => g.locus),
    ]);

    const mutationHistory: MutationEvent[] = [];

    for (const locus of uniqueLoci) {
      const markerA = aMap.get(locus);
      const markerB = bMap.get(locus);

      if (markerA && markerB && markerA.allele !== markerB.allele) {
        const useDominant = markerA.dominant !== markerB.dominant;
        if (useDominant) {
          const dominant = markerA.dominant ? markerA : markerB;
          childMarkers.push({
            ...dominant,
            expressivity: (markerA.expressivity + markerB.expressivity) / 2,
          });
          mutationHistory.push({
            generation: dnaA.generation + 1,
            locus,
            fromAllele: markerB.allele,
            toAllele: markerA.allele,
            cause: 'fusion',
            timestamp: new Date(),
          });
        } else {
          const expressivityA = markerA.expressivity;
          const expressivityB = markerB.expressivity;
          const chosen = expressivityA >= expressivityB ? markerA : markerB;
          childMarkers.push({
            ...chosen,
            expressivity: (expressivityA + expressivityB) / 2,
          });
          mutationHistory.push({
            generation: dnaA.generation + 1,
            locus,
            fromAllele: markerB.allele,
            toAllele: chosen.allele,
            cause: 'fusion',
            timestamp: new Date(),
          });
        }
      } else if (markerA && markerB) {
        childMarkers.push({
          ...markerA,
          expressivity: (markerA.expressivity + markerB.expressivity) / 2,
        });
      } else {
        childMarkers.push((markerA ?? markerB)!);
      }
    }

    const childCompatProfile = [
      ...new Set([...dnaA.compatibilityProfile, ...dnaB.compatibilityProfile]),
    ];

    const aFitness = a.importance * 0.4 + expressivity(a) * 0.3 + a.prediction_value * 0.3;
    const bFitness = b.importance * 0.4 + expressivity(b) * 0.3 + b.prediction_value * 0.3;
    const heterosisBoost = isCompatible ? 0.1 : -0.3;
    const childFitness = ((aFitness + bFitness) / 2) + heterosisBoost;

    const childDNA: ConceptDNA = {
      genomeId: `genome:fusion:${a.id}:${b.id}:gen:${dnaA.generation + 1}`,
      conceptId: '',
      geneSequence: childMarkers,
      parentIds: [a.id, b.id],
      mutationHistory: [...dnaA.mutationHistory, ...dnaB.mutationHistory, ...mutationHistory],
      generation: Math.max(dnaA.generation, dnaB.generation) + 1,
      fitness: Math.max(0.01, childFitness),
      compatibilityProfile: childCompatProfile,
    };

    return {
      parentA: a.id,
      parentB: b.id,
      childDNA,
      compatibilityScore: combinedScore,
      predictedFitness: childFitness,
    };
  }

  mutate(concept: Concept, cause: MutationEvent['cause'] = 'drift'): ConceptDNA {
    const dna = this.encode(concept);
    const mutationRate = 0.15 + (1 - concept.confidence.value) * 0.3;

    const mutatedMarkers: GeneMarker[] = dna.geneSequence.map((marker) => {
      if (marker.dominant && Math.random() > mutationRate) return marker;

      const shouldMutate = Math.random() < mutationRate;
      if (!shouldMutate) return marker;

      const newAllele = `${hashString(marker.allele + Date.now().toString(36))}`;
      return { ...marker, allele: newAllele, expressivity: Math.max(0.1, marker.expressivity * (0.8 + Math.random() * 0.4)) };
    });

    const mutationEvent: MutationEvent = {
      generation: dna.generation + 1,
      locus: 'genome-wide',
      fromAllele: 'original',
      toAllele: 'mutated',
      cause,
      timestamp: new Date(),
    };

    const mutatedDNA: ConceptDNA = {
      ...dna,
      geneSequence: mutatedMarkers,
      mutationHistory: [...dna.mutationHistory, mutationEvent],
      generation: dna.generation + 1,
      fitness: Math.max(0.01, dna.fitness * (0.85 + Math.random() * 0.3)),
    };

    this.dnaRegistry.set(concept.id, mutatedDNA);
    return mutatedDNA;
  }

  geneSequence(concept: Concept): GeneMarker[] {
    const dna = this.encode(concept);
    return [...dna.geneSequence];
  }

  decode(dna: ConceptDNA): Record<string, unknown> {
    const traits: Record<string, unknown> = {};
    for (const marker of dna.geneSequence) {
      if (marker.locus.startsWith('type_')) {
        traits.conceptType = marker.allele;
      } else if (marker.locus.startsWith('name_')) {
        traits.nameHash = parseInt(marker.allele, 10);
      } else if (marker.locus.startsWith('is_a_')) {
        if (!traits.is_a) traits.is_a = [];
        (traits.is_a as string[]).push(marker.allele);
      } else if (marker.locus.startsWith('part_of_')) {
        if (!traits.part_of) traits.part_of = [];
        (traits.part_of as string[]).push(marker.allele);
      } else if (marker.locus.startsWith('causes_')) {
        if (!traits.causes) traits.causes = [];
        (traits.causes as string[]).push(marker.allele);
      } else if (marker.locus.startsWith('contradicts_')) {
        if (!traits.contradicts) traits.contradicts = [];
        (traits.contradicts as string[]).push(marker.allele);
      } else if (marker.locus.startsWith('def_')) {
        if (!traits.definitionHashes) traits.definitionHashes = [];
        (traits.definitionHashes as number[]).push(parseInt(marker.allele, 10));
      }
    }
    traits.generation = dna.generation;
    traits.fitness = dna.fitness;
    traits.parentIds = dna.parentIds;
    return traits;
  }

  getStats(): ConceptGenomeStats {
    const allDNA = [...this.dnaRegistry.values()];
    if (allDNA.length === 0) {
      return { encodedConcepts: 0, averageGeneration: 0, averageFitness: 0, totalMutations: 0, fusionCount: 0, topFitness: [] };
    }

    const totalGen = allDNA.reduce((s, d) => s + d.generation, 0);
    const totalFit = allDNA.reduce((s, d) => s + d.fitness, 0);
    const totalMutations = allDNA.reduce((s, d) => s + d.mutationHistory.length, 0);
    const sorted = [...allDNA].sort((a, b) => b.fitness - a.fitness).slice(0, 5);

    return {
      encodedConcepts: allDNA.length,
      averageGeneration: totalGen / allDNA.length,
      averageFitness: totalFit / allDNA.length,
      totalMutations,
      fusionCount: this.fusionCount,
      topFitness: sorted.map((d) => ({ conceptId: d.conceptId, fitness: d.fitness })),
    };
  }

  clear(): void {
    this.dnaRegistry.clear();
    this.fusionCount = 0;
  }
}
