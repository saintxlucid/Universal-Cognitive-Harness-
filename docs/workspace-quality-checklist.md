# Workspace Quality Checklist

## Required before merge
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm test`
- [ ] `npm run doctor`
- [ ] Update docs when new shared conventions are introduced

## Required at workspace root
- [ ] `.nvmrc` pinned to project Node version
- [ ] `.editorconfig` for cross-IDE consistency
- [ ] `.prettierrc` and `.prettierignore`
- [ ] `.gitignore` and `.gitattributes`
- [ ] `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- [ ] `.env.example` for root-level variables
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] `.github/dependabot.yml` for automated dependency updates
- [ ] `.vscode/extensions.json`, `.vscode/settings.json`, `.vscode/launch.json`

## Recommended for every new project
- [ ] Add a README
- [ ] Add `.env.example`
- [ ] Add a basic test or smoke check
- [ ] Keep product code isolated under `projects/`
