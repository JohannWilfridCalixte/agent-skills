# Investigation Report

## Identity and source

Bug source, repository/base/head or snapshot, investigated paths, known environment and relevant knowledge records with freshness/status.

## Error Analysis

Complete relevant error/stack structure, redacting secret/personal values. Mark redactions and omitted irrelevant portions. Exact file, line, function and observation revision. Distinguish assertion failure from setup/import/environment failure.

## Failure Point

Immediate observed cause and minimal diagnostic data state. Do not persist full sensitive payloads merely to fill this section.

## Data Flow Trace

Entry → intermediate transformations → failure. Describe the bad value/state, first observed origin and propagation, with file/revision evidence.

## Recent Changes

Relevant commits/modifications and why they could affect this path. Treat temporal correlation separately from causation.

## Working Comparison

Similar working code and meaningful differences in behavior/contracts/state.

## Evidence Summary

| Question | Observation / evidence | Confidence |
|---|---|---|
| What fails and where? | {specific file/revision/output} | {supported / uncertain} |
| Where does bad data arise? | {trace} | {supported / uncertain} |
| What recently changed? | {relevant diff} | {supported / uncertain} |
| Reproduction conditions? | {deterministic/intermittent/environmental evidence} | {supported / uncertain} |

## Open Questions and constraints

Explicit unknowns, unavailable evidence, environment/setup limitations, knowledge conflicts and second-order effects. Populate only applicable sections; absence of evidence is not a diagnosis.
