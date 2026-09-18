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
Not every class needs a matching behavioral interface. Introduce behavioral ports at architectural boundaries; structural data-shape interfaces still follow the selected language's type rules.

**Anemic domain**
Entities with only getters while application services hold every business rule can displace domain behavior. Put those rules in domain entities or pure domain operations according to the selected language/model style; the smell does not justify rewriting unrelated code.

**Framework annotations in domain**
`@Entity`, `@Column`, `@JsonProperty` in domain class = infrastructure leak. Map at adapter boundary.
