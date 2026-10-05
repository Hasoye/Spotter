name: audit-rules-file
description: Use when adding a new rules file or changing an existing one, so every file gets the same five-point audit, naming check, and activation trigger before it's added to .agent/rules.
---
Job

Check one rules file against five fixed criteria, confirm its cross-references, and set its activation trigger, before it goes into .agent\rules.

Procedure
Confirm the file states exactly one job. If it covers more than one unrelated concern, split it before continuing.
Confirm every rule in the file states a reason. If a rule has no reason, add one or remove the rule.
Search the rest of .agent\rules for any sentence that restates this file's content. If found, remove the duplicate from whichever file is not the rule's rightful owner.
Check every cross-reference in the file against the actual filenames in .agent\rules, per structure.md's naming convention. Confirm no reference uses a docs/ prefix, an underscore, or uppercase letters that no longer match a real file.
Confirm nothing an agent would need to build correctly is missing. If something is missing and the answer isn't already known, name it as an open item instead of inventing one.
Confirm no rule is vague enough to be read two different ways. If one is, reword it to a single reading.
Choose the file's activation trigger: always_on if the rule applies regardless of what's being built, glob if it's tied to a specific real file path, model_decision if its relevance depends on the task rather than the file being touched. Add the frontmatter block with that trigger before saving the file.