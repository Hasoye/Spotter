---
trigger: always_on
---


# Design System & Project Source of Truth

## Job of this file

Ensure every UI implementation uses the project's existing design system, Figma-derived assets, components, and documented rules without requiring the user to repeat these requirements for each task.

## Mandatory sources before UI work

Before creating or modifying any UI, the agent MUST inspect and follow:

1. `AGENTS.md`
2. Applicable files in `.agent/rules/`
3. `app/design-tokens.css`
4. The original Figma-derived design token/source files available in the project
5. Existing reusable components in `components/`
6. Existing styles relevant to the feature
7. Any applicable design documentation or Figma guide imported into the project

These are project source-of-truth files.

## Design token rule

`app/design-tokens.css` is the authoritative implementation of the existing Figma design tokens.

When a token exists, use it.

Do not replace an existing token with:
- hardcoded colors
- arbitrary typography values
- arbitrary shadows
- arbitrary spacing values
- arbitrary border values
- arbitrary visual styles

Do not recreate values that already exist in the design system.

## Typography rule

Always use the existing typography system.

The agent must:
- use the existing typography variables
- preserve the defined font family
- preserve the defined font sizes
- preserve font weights
- preserve line heights
- preserve letter spacing
- ensure the actual configured font is loaded correctly when required

Do not substitute a browser default font or introduce another font without an explicit project requirement.

## Color rule

Always use the existing color system from the design tokens.

Do not invent new colors when an appropriate project token already exists.

## Components rule

Before creating a new UI component, inspect `components/` and reuse an existing component when one already satisfies the requirement.

Do not duplicate existing components unnecessarily.

## Existing implementation rule

Before modifying a feature, inspect its existing:
- JSX/TSX
- CSS
- components
- tokens
- API behavior
- validation
- tests

Modify the existing implementation rather than rebuilding working functionality unnecessarily.

## Figma guide rule

If a Figma-derived guide, JSON, design specification, or other design reference exists in the repository, treat it as project design guidance.

Do not ignore it simply because the implementation already exists.

Use it to determine:
- typography
- color
- spacing
- hierarchy
- component behavior
- visual relationships
- layout rules

## No repeated instruction requirement

The user should not need to repeatedly tell the agent to use the project's design system, rules, Figma assets, or existing components.

These requirements apply automatically to every UI task.

## Before declaring completion

Verify that:

1. Existing design tokens were reused.
2. Existing components were reused where appropriate.
3. Existing project rules were followed.
4. No unnecessary hardcoded design values were introduced.
5. The implementation matches the available Figma/design documentation.
6. The relevant tests/build still pass.