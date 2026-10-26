---
title: Common Mistakes
impact: MEDIUM
tags: anti-patterns, anemic-domain, over-engineering, framework-leak
---

## Common Mistakes

**Impact: MEDIUM**

**Premature abstraction**
Don't create `IUserMapper`, `ICacheService` for simple CRUD. Add abstractions when real requirements demand them.

**Interface per class**
Not every class needs an interface. Only create interfaces at architectural boundaries (ports).

**Anemic domain**
Entities with only getters + services with all logic = procedural code in OO clothing. Put behavior in entities.

**Framework annotations in domain**
`@Entity`, `@Column`, `@JsonProperty` in domain class = infrastructure leak. Map at adapter boundary.
