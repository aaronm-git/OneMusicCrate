# Repository Instructions

- `AGENTS.md` and `CLAUDE.md` must always contain the same content.
- Whenever you edit one of these files, update the other file in the same change so they stay fully synced.
- Do not start development servers.
- Skip build and test runs unless the user explicitly asks for them.
- Treat this app as fully in dev mode.
- Do not preserve backwards compatibility or add legacy support unless the user explicitly asks for it.
- If the user asks for a breaking change, make the breaking change directly without compatibility layers.
- Use shadcn components only. Do not introduce other UI component libraries.
- Do not edit or update installed shadcn components (the files under the shadcn `ui` directory). If a primitive needs different behavior, compose around it or create a new component instead of modifying the installed source.
- All styling is handled through `src/app/globals.css` (theme tokens, CSS variables, base layer). Extend the design system there rather than hardcoding colors, fonts, or radii in components.
- Use the shadcn MCP to research, select, and install the correct shadcn components for each user request. Prefer MCP-driven discovery over guessing component names; install missing primitives via the MCP rather than hand-writing equivalents.
- UI copy must be user-facing, plain-language, and product-oriented. Avoid developer-facing labels or implementation terms like "cached locally", "DB", "sync status", or other internal jargon unless the user explicitly asks for technical detail.
