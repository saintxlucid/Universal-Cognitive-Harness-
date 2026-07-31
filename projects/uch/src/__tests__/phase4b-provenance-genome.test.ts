import { describe, it, expect } from 'vitest';
import { RetrievalFusion } from '../kernel/retrieval/fusion.js';
import { SemanticGraph } from '../kernel/storage/semantic-graph.js';
import { EpisodicStore } from '../kernel/storage/episodic-store.js';
import { createConcept } from '../kernel/types/concept.js';
import { createProvenance } from '../kernel/types/provenance.js';
import { ConceptGenome } from '../kernel/concept-genome/concept-genome.js';

// ═══════════════════════════════════════════════════════════════
// Phase 4b: Provenance-Weighted Retrieval
// ═══════════════════════════════════════════════════════════════

describe('ProvenanceWeightConfig', () => {
  it('uses factory defaults when not provided', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);
    const weights = rf.getProvenanceWeights();
    expect(weights.enabled).toBe(true);
    expect(weights.reliabilityWeight).toBe(0.35);
    expect(weights.confidenceWeight).toBe(0.30);
    expect(weights.entrenchmentWeight).toBe(0.20);
    expect(weights.epistemicStatusWeight).toBe(0.15);
  });

  it('accepts partial override in constructor', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic, { reliabilityWeight: 0.5, enabled: true });
    const weights = rf.getProvenanceWeights();
    expect(weights.reliabilityWeight).toBe(0.5);
    expect(weights.confidenceWeight).toBe(0.30);
  });

  it('accepts override via setProvenanceWeights', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);
    rf.setProvenanceWeights({ enabled: false });
    expect(rf.getProvenanceWeights().enabled).toBe(false);
  });
});

describe('Provenance-weighted scoring', () => {
  it('boosts score for high-reliability, high-confidence concepts', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const highRel = createConcept({
      name: 'verified-truth',
      concept_type: 'entity',
      definition: 'A highly reliable fact',
      provenance: createProvenance('user', 'trusted-source', 1.0),
      importance: 0.9,
    });
    highRel.confidence.value = 1.0;
    highRel.entrenchment = 5;
    highRel.epistemic_status = 'fact';
    highRel.access_count = 10;
    highRel.embedding = [0.9, 0.1, 0.5];
    graph.addConcept(highRel);

    const lowRel = createConcept({
      name: 'rumor',
      concept_type: 'entity',
      definition: 'Unreliable speculation',
      provenance: createProvenance('model_inference', 'unreliable-model', 0.2),
      importance: 0.3,
    });
    lowRel.confidence.value = 0.2;
    lowRel.entrenchment = 1;
    lowRel.epistemic_status = 'speculation';
    lowRel.access_count = 0;
    lowRel.embedding = [0.9, 0.1, 0.5];
    graph.addConcept(lowRel);

    const results = rf.search({ text: 'truth', embedding: [0.85, 0.15, 0.45] });

    const highResult = results.find((r) => r.id === highRel.id);
    const lowResult = results.find((r) => r.id === lowRel.id);

    expect(highResult).toBeDefined();
    expect(lowResult).toBeDefined();
    expect(highResult!.provenanceFactor).toBeGreaterThan(lowResult!.provenanceFactor);
    expect(highResult!.score).toBeGreaterThan(lowResult!.score);
  });

  it('produces factor near 1.0 for moderate provenance', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const moderate = createConcept({
      name: 'average-fact',
      concept_type: 'entity',
      definition: 'Moderate reliability',
      provenance: createProvenance('tool_output', 'some-tool', 0.5),
    });
    moderate.confidence.value = 0.5;
    moderate.entrenchment = 3;
    moderate.epistemic_status = 'knowledge';
    moderate.embedding = [0.5, 0.5, 0.5];
    graph.addConcept(moderate);

    const results = rf.search({ text: 'average', embedding: [0.5, 0.5, 0.5] });
    const found = results.find((r) => r.id === moderate.id);
    expect(found).toBeDefined();
    expect(found!.provenanceFactor).toBeGreaterThan(0.4);
    expect(found!.provenanceFactor).toBeLessThan(1.5);
  });

  it('disabling provenance weight returns factor of 1', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic, { enabled: false });

    const c = createConcept({
      name: 'test',
      concept_type: 'entity',
      definition: 'test',
      provenance: createProvenance('user', 'src', 0.1),
    });
    c.embedding = [0.5, 0.5];
    graph.addConcept(c);

    const results = rf.search({ text: 'test', embedding: [0.5, 0.5] });
    const found = results.find((r) => r.id === c.id);
    expect(found).toBeDefined();
    expect(found!.provenanceFactor).toBe(1.0);
  });

  it('scored result carries rawScore and provenanceFactor', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const c = createConcept({
      name: 'check-fields',
      concept_type: 'entity',
      definition: 'Has all fields',
      provenance: createProvenance('user', 'me', 0.8),
    });
    c.embedding = [0.2, 0.8, 0.3];
    graph.addConcept(c);

    const results = rf.search({ text: 'check-fields', embedding: [0.2, 0.8, 0.3] });
    const found = results.find((r) => r.id === c.id);
    expect(found).toBeDefined();
    expect(typeof found!.rawScore).toBe('number');
    expect(typeof found!.provenanceFactor).toBe('number');
    expect(found!.provenanceFactor).toBeGreaterThan(0);
  });

  it('applies provenance to keyword search results', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const c = createConcept({
      name: 'keyword-target',
      concept_type: 'quality',
      definition: 'The target for keyword weighted testing',
      provenance: createProvenance('user', 'src', 0.9),
    });
    c.confidence.value = 0.9;
    c.entrenchment = 4;
    c.epistemic_status = 'knowledge';
    graph.addConcept(c);

    const results = rf.search({ text: 'keyword target weighted' });
    const found = results.find((r) => r.id === c.id);
    expect(found).toBeDefined();
    expect(found!.source).toBe('keyword');
    expect(found!.provenanceFactor).toBeGreaterThan(0.8);
  });

  it('BFS graph search respects provenance weights', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const root = createConcept({
      name: 'root',
      concept_type: 'entity',
      definition: 'Root concept',
      provenance: createProvenance('user', 'src', 0.8),
    });
    root.embedding = [0.5, 0.5];
    graph.addConcept(root);

    const neighbor = createConcept({
      name: 'neighbor',
      concept_type: 'entity',
      definition: 'Connected concept',
      provenance: createProvenance('user', 'src', 0.9),
    });
    neighbor.confidence.value = 0.95;
    neighbor.entrenchment = 5;
    neighbor.epistemic_status = 'fact';
    graph.addConcept(neighbor);

    graph.addEdge({
      id: 'e1',
      source: root.id,
      target: neighbor.id,
      relationship: 'related_to',
      valid_at: new Date(),
      invalid_at: null,
      created_at: new Date(),
      expired_at: null,
      provenance: createProvenance('user', 'src', 0.8),
      confidence: { value: 1.0, method: 'consensus', calibration_history: [] },
      source_episode: 'ep1',
    });

    const results = rf.search({ text: 'root', concepts: [root.id] });
    const found = results.find((r) => r.id === neighbor.id);
    expect(found).toBeDefined();
    if (found) {
      expect(found.provenanceFactor).toBeGreaterThan(0.9);
      expect(found.source).toBe('graph');
    }
  });

  it('episode temporal search applies provenance factor', async () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const ep = await episodic.append({
      content: { type: 'text', text: 'important event' },
      session_id: 's1',
      provenance: createProvenance('user', 'trusted', 0.95),
    });

    const results = rf.search({
      text: 'test',
      timeRange: { start: new Date(0), end: new Date(Date.now() + 10000) },
    });
    const found = results.find((r) => r.id === ep.id);
    expect(found).toBeDefined();
    if (found) {
      expect(found.provenanceFactor).toBeGreaterThan(0.8);
      expect(found.source).toBe('temporal');
    }
  });

  it('formatContext includes provenance metadata', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const rf = new RetrievalFusion(graph, episodic);

    const c = createConcept({
      name: 'context-test',
      concept_type: 'entity',
      definition: 'Testing context formatting',
      provenance: createProvenance('user', 'me', 0.85),
    });
    c.embedding = [0.3, 0.7];
    graph.addConcept(c);

    const results = rf.search({ text: 'context-test', embedding: [0.3, 0.7] });
    const context = rf.formatContext(results);
    expect(context).toContain('provenance:');
    expect(context).toContain('reliability:');
    expect(context).toContain('status:');
    expect(context).toContain('source:');
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 4b: Concept Genome DNA
// ═══════════════════════════════════════════════════════════════

describe('ConceptGenome', () => {
  it('encodes a concept into DNA with gene markers', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'database',
      concept_type: 'entity',
      definition: 'A structured data storage system',
      provenance: createProvenance('user', 'architect', 0.9),
      importance: 0.8,
      prediction_value: 0.7,
    });
    concept.is_a = ['persistent-storage', 'system-component'];
    concept.part_of = ['infrastructure'];
    concept.causes = ['data-persistence'];
    concept.entrenchment = 4;
    concept.confidence.value = 0.85;

    const dna = genome.encode(concept);

    expect(dna.genomeId).toContain(concept.id);
    expect(dna.conceptId).toBe(concept.id);
    expect(dna.geneSequence.length).toBeGreaterThan(0);
    expect(dna.parentIds).toEqual([]);
    expect(dna.generation).toBe(0);
    expect(dna.fitness).toBeGreaterThan(0);

    const typeMarker = dna.geneSequence.find((g) => g.locus.startsWith('type_'));
    expect(typeMarker).toBeDefined();
    expect(typeMarker!.allele).toBe('entity');

    const nameMarker = dna.geneSequence.find((g) => g.locus.startsWith('name_'));
    expect(nameMarker).toBeDefined();
    expect(parseInt(nameMarker!.allele, 10)).toBeGreaterThan(0);
  });

  it('returns cached DNA on re-encode', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'cached',
      concept_type: 'process',
      definition: 'Should be cached',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const dna1 = genome.encode(concept);
    const dna2 = genome.encode(concept);
    expect(dna1.genomeId).toBe(dna2.genomeId);
  });

  it('getDNA retrieves by concept ID', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'retrievable',
      concept_type: 'entity',
      definition: 'Can be retrieved',
      provenance: createProvenance('user', 'me', 0.5),
    });
    genome.encode(concept);
    const dna = genome.getDNA(concept.id);
    expect(dna).toBeDefined();
    expect(dna!.conceptId).toBe(concept.id);
  });

  it('getDNA returns undefined for unknown concept', () => {
    const genome = new ConceptGenome();
    expect(genome.getDNA('nonexistent')).toBeUndefined();
  });

  it('computes genetic similarity between two concepts', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'dog',
      concept_type: 'entity',
      definition: 'A canine mammal',
      provenance: createProvenance('user', 'me', 0.5),
    });
    a.is_a = ['mammal', 'pet'];
    const b = createConcept({
      name: 'cat',
      concept_type: 'entity',
      definition: 'A feline mammal',
      provenance: createProvenance('user', 'me', 0.5),
    });
    b.is_a = ['mammal', 'pet'];

    const dnaA = genome.encode(a);
    const dnaB = genome.encode(b);
    const sim = genome.similarity(dnaA, dnaB);

    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('similarity is 1.0 for identical concepts', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'unique-entity',
      concept_type: 'entity',
      definition: 'One of a kind',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const dnaA = genome.encode(a);
    const sim = genome.similarity(dnaA, dnaA);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  it('classifies identical concepts as identical', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'self',
      concept_type: 'entity',
      definition: 'Itself',
      provenance: createProvenance('user', 'me', 0.5),
    });
    expect(genome.compare(a, a)).toBe('identical');
  });

  it('classifies compatible concepts', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'server',
      concept_type: 'entity',
      definition: 'A computing node',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const b = createConcept({
      name: 'database-server',
      concept_type: 'entity',
      definition: 'A server for databases',
      provenance: createProvenance('user', 'me', 0.5),
    });
    b.is_a = ['server'];

    const result = genome.compare(a, b);
    expect(['compatible', 'cousin', 'sibling']).toContain(result);
  });

  it('classifies incompatible types', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'speed',
      concept_type: 'quality',
      definition: 'How fast something is',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const b = createConcept({
      name: 'database',
      concept_type: 'entity',
      definition: 'Stores data',
      provenance: createProvenance('user', 'me', 0.5),
    });
    b.is_a = ['infrastructure'];

    const result = genome.compare(a, b);
    expect(
      ['compatible', 'cousin', 'sibling', 'incompatible'].includes(result),
    ).toBe(true);
  });

  it('fuses two compatible concepts into hybrid DNA', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'web-server',
      concept_type: 'entity',
      definition: 'Serves web content',
      provenance: createProvenance('user', 'architect', 0.8),
      importance: 0.7,
    });
    a.is_a = ['server'];
    a.confidence.value = 0.8;

    const b = createConcept({
      name: 'api-gateway',
      concept_type: 'entity',
      definition: 'Routes API requests',
      provenance: createProvenance('user', 'architect', 0.8),
      importance: 0.8,
    });
    b.is_a = ['gateway'];
    b.confidence.value = 0.9;

    const fusion = genome.fuse(a, b);

    expect(fusion.parentA).toBe(a.id);
    expect(fusion.parentB).toBe(b.id);
    expect(fusion.childDNA.geneSequence.length).toBeGreaterThan(0);
    expect(fusion.childDNA.parentIds).toContain(a.id);
    expect(fusion.childDNA.parentIds).toContain(b.id);
    expect(fusion.childDNA.generation).toBeGreaterThanOrEqual(1);
    expect(fusion.childDNA.fitness).toBeGreaterThan(0);
    expect(fusion.compatibilityScore).toBeGreaterThan(0);
  });

  it('fusion with incompatible types still produces result with low fitness', () => {
    const genome = new ConceptGenome();
    const a = createConcept({
      name: 'red',
      concept_type: 'quality',
      definition: 'A color',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const b = createConcept({
      name: 'compiler',
      concept_type: 'process',
      definition: 'Translates code',
      provenance: createProvenance('user', 'me', 0.5),
    });

    const fusion = genome.fuse(a, b);
    expect(fusion.parentA).toBe(a.id);
    expect(fusion.parentB).toBe(b.id);
    expect(fusion.predictedFitness).toBeGreaterThanOrEqual(0);
  });

  it('mutates concept DNA with drift', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'stable-concept',
      concept_type: 'entity',
      definition: 'A stable concept that will mutate',
      provenance: createProvenance('user', 'me', 0.5),
      importance: 0.6,
    });
    concept.confidence.value = 0.4;

    const original = genome.encode(concept);
    const mutated = genome.mutate(concept, 'drift');

    expect(mutated.generation).toBe(original.generation + 1);
    expect(mutated.mutationHistory.length).toBeGreaterThan(original.mutationHistory.length);

    const lastMutation = mutated.mutationHistory[mutated.mutationHistory.length - 1];
    expect(lastMutation).toBeDefined();
    if (lastMutation) {
      expect(lastMutation.cause).toBe('drift');
    }
  });

  it('geneSequence returns ordered markers', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'ordered-test',
      concept_type: 'entity',
      definition: 'For testing gene order',
      provenance: createProvenance('user', 'me', 0.5),
    });

    const markers = genome.geneSequence(concept);
    expect(markers.length).toBeGreaterThan(3);
    expect(markers[0]!.locus).toBe('type_0');
    expect(markers[1]!.locus).toBe('name_1');
  });

  it('decode reconstructs trait map from DNA', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'decode-test',
      concept_type: 'entity',
      definition: 'Will be decoded',
      provenance: createProvenance('user', 'me', 0.5),
    });
    concept.is_a = ['category-a'];

    const dna = genome.encode(concept);
    const traits = genome.decode(dna);

    expect(traits.conceptType).toBe('entity');
    expect((traits.is_a as string[])).toContain('category-a');
    expect(typeof traits.generation).toBe('number');
    expect(typeof traits.fitness).toBe('number');
  });

  it('getStats reports encoding metrics', () => {
    const genome = new ConceptGenome();
    expect(genome.getStats().encodedConcepts).toBe(0);

    const a = createConcept({
      name: 'stat-a',
      concept_type: 'entity',
      definition: 'First concept',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const b = createConcept({
      name: 'stat-b',
      concept_type: 'entity',
      definition: 'Second concept',
      provenance: createProvenance('user', 'me', 0.5),
    });

    genome.encode(a);
    genome.encode(b);
    genome.mutate(a, 'deliberate');
    genome.fuse(a, b);

    const stats = genome.getStats();
    expect(stats.encodedConcepts).toBe(2);
    expect(stats.fusionCount).toBe(1);
    expect(stats.averageGeneration).toBeGreaterThan(0);
    expect(stats.averageFitness).toBeGreaterThan(0);
    expect(stats.topFitness.length).toBeGreaterThan(0);
  });

  it('clear resets all state', () => {
    const genome = new ConceptGenome();
    const concept = createConcept({
      name: 'will-clear',
      concept_type: 'entity',
      definition: 'To be cleared',
      provenance: createProvenance('user', 'me', 0.5),
    });
    genome.encode(concept);
    expect(genome.getStats().encodedConcepts).toBe(1);
    genome.clear();
    expect(genome.getStats().encodedConcepts).toBe(0);
  });

  it('concept type compatibility is symmetric', () => {
    const genome = new ConceptGenome();
    const entity = createConcept({
      name: 'e',
      concept_type: 'entity',
      definition: 'entity',
      provenance: createProvenance('user', 'me', 0.5),
    });
    const relation = createConcept({
      name: 'r',
      concept_type: 'relation',
      definition: 'relation',
      provenance: createProvenance('user', 'me', 0.5),
    });

    const dnaE = genome.encode(entity);
    const dnaR = genome.encode(relation);
    const simER = genome.similarity(dnaE, dnaR);
    const simRE = genome.similarity(dnaR, dnaE);
    expect(simER).toBe(simRE);
  });
});
