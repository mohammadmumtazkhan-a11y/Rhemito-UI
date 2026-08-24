# NON-REGRESSION DEVELOPMENT RULE — MANDATORY

Treat all existing working functionality as **protected functionality**.

Whenever I ask you to add, modify, improve, fix, refactor, or extend any functionality, follow these rules:

## 1. Do Not Break Existing Functionality

You must NOT:

* Remove existing functionality.
* Change existing business logic unless explicitly requested.
* Change existing behaviour just because you think another approach is better.
* Rename or remove existing APIs, methods, fields, database columns, routes, components, configuration, events, or contracts unless required by my request.
* Refactor unrelated working code unnecessarily.
* Change existing UI/UX behaviour outside the requested scope.
* Change existing validations, permissions, calculations, workflows, integrations, or status rules unless explicitly required.
* Fix unrelated issues automatically.
* Introduce breaking changes to existing API consumers, database structures, integrations, or user journeys.

Assume that existing functionality is intentional unless I explicitly state otherwise.

## 2. Make the Smallest Necessary Change

Implement only what is required for the requested functionality.

Prefer:

**Extend > Modify > Replace**

Reuse existing architecture, components, services, APIs, models, utilities, and patterns wherever practical.

Do not rewrite working areas merely to implement a new feature.

## 3. Check for Impact Before Changing Code

Before implementation, analyse how the requested change may affect:

* Existing functionality.
* Existing user journeys.
* Business rules.
* APIs and API contracts.
* Database schema and stored data.
* Integrations.
* Authentication and authorization.
* Validation.
* Calculations.
* Status transitions.
* Notifications.
* Background processes.
* Existing frontend components.
* Existing tests.

Identify dependencies before making changes.

## 4. If There Is a Conflict — STOP AND SUGGEST

If my new requirement conflicts with existing functionality, architecture, business rules, or previously implemented behaviour:

**DO NOT silently resolve the conflict yourself.**

Instead:

1. Explain the conflict clearly.
2. Explain which existing functionality may be affected.
3. Explain why the conflict exists.
4. Suggest the safest practical solution.
5. Suggest alternatives where appropriate.
6. Wait for my approval before changing the protected existing behaviour.

Use this format:

**Conflict detected**

Existing behaviour:
[Describe it]

New requirement:
[Describe it]

Conflict/impact:
[Explain what could break or change]

Recommended solution:
[Your recommended approach]

Alternative:
[Optional alternative]

**Do not implement the conflicting change until I approve the approach.**

## 5. Preserve Backward Compatibility

Where technically practical, new functionality must be added in a backward-compatible manner.

Existing users, APIs, transactions, stored records, integrations, and workflows must continue working as before unless the requirement explicitly states otherwise.

## 6. Do Not Assume Permission

My request to change **Feature B** does not give you permission to change **Feature A**.

If another area needs modification to support the requested feature, explain the dependency first.

Minor internal implementation changes that do not alter existing behaviour are allowed, but unnecessary changes should still be avoided.

## 7. Protect Existing Business Rules

Do not reinterpret existing business rules.

If the new requirement appears inconsistent with an existing rule, raise it as a conflict rather than choosing which rule should win.

## 8. Avoid Unnecessary Refactoring

Do not perform opportunistic refactoring while implementing another requirement.

If you notice code that could be improved, you may suggest it separately:

**Optional improvement:** [suggestion]

But do not implement it unless I approve it.

## 9. Protect Existing UI

When changing a screen or component:

* Preserve existing actions.
* Preserve existing fields unless explicitly changed.
* Preserve existing validations.
* Preserve existing navigation.
* Preserve existing responsive behaviour.
* Preserve existing working integrations.

Add the requested functionality without redesigning unrelated areas.

You may suggest UX improvements separately, but do not implement them automatically.

## 10. Protect Existing APIs and Integrations

Do not change existing:

* Endpoint URLs.
* Request structures.
* Response structures.
* Field names.
* Data types.
* Status codes.
* Authentication methods.
* Webhook contracts.
* Integration mappings.

unless the requested requirement explicitly requires the change.

If a change would create a breaking API or integration change, notify me before implementation.

## 11. Protect Existing Database Behaviour

Do not delete, rename, reinterpret, or destructively migrate existing data without explicit approval.

Prefer additive schema changes wherever possible.

Any potentially destructive migration must be highlighted before implementation.

## 12. Verify Non-Regression

After implementing the requested change:

1. Verify the new functionality.
2. Verify the existing related functionality still works.
3. Run relevant existing tests where available.
4. Add or update tests for the new behaviour where appropriate.
5. Check for unintended side effects.

Do not consider the task complete merely because the new feature works.

The task is complete only when:

**New functionality works + existing functionality continues to work.**

## 13. Report What Changed

After implementation, give me a concise summary:

**Implemented:**
[New functionality]

**Existing functionality changed:**
None

or, if I previously approved a change:

**Existing functionality changed:**
[Clearly state what changed]

**Regression checks:**
[What existing functionality was verified]

**Suggestions not implemented:**
[Any improvements or conflicts you noticed]

## GOLDEN RULE

> **Never break, replace, remove, or alter existing working functionality simply to make a new requirement easier to implement. Preserve it by default. If a conflict exists, explain it and suggest a solution to me first. I decide whether the existing functionality may be changed.**

## Project Conventions (also apply)

This project has an established conventions file: `CLAUDE.md` in the repo root.

Before starting any work, read `CLAUDE.md` and follow it alongside this rule. It defines the product context, UX-first workflow, git workflow, tech stack, coding conventions, theme, and testing requirements for this repository.

If `CLAUDE.md` ever appears to conflict with this non-regression rule, treat it as a conflict under section 4 (STOP AND SUGGEST) — do not resolve it silently.
