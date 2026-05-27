# Investigation Report

## Error Analysis

### Exact Error
```
{quoted error message — complete, not summarized}
```

### Stack Trace
```
{full stack trace if applicable}
```

### Error Location
- File: {path}
- Line: {number}
- Function: {name}

## Failure Point

### Immediate Cause
{what code directly causes the error}

### Data State at Failure
{what values were present when it broke}

## Data Flow Trace

### Call Chain
```
{entry point}
  → {function A}
  → {function B}
  → {failure point}
```

### Bad Value Origin
- Value: {what value is wrong}
- First appears: {where it originates}
- Passed through: {intermediate points}

## Recent Changes

### Relevant Commits
{commits that could affect this code path}

### Related Modifications
{files changed recently that touch the failure path}

## Working Comparison

### Similar Working Code
{working examples of similar patterns in the codebase}

### Key Differences
| Aspect | Working | Broken |
|--------|---------|--------|
| {aspect} | {value} | {value} |

## Evidence Summary

| Question | Answer |
|----------|--------|
| What fails? | {specific} |
| Where exactly? | {file:line} |
| What data is wrong? | {value} |
| Where does bad data originate? | {origin} |
| What changed recently? | {relevant changes} |

## Open Questions

{things that couldn't be determined — explicit unknowns}
