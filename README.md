# eslint-plugin-react-19-upgrade

[![npm version](https://img.shields.io/npm/v/eslint-plugin-react-19-upgrade.svg)](https://www.npmjs.com/package/eslint-plugin-react-19-upgrade)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-react-19-upgrade.svg)](https://www.npmjs.com/package/eslint-plugin-react-19-upgrade)
[![license](https://img.shields.io/npm/l/eslint-plugin-react-19-upgrade.svg)](https://github.com/brettfarrow/eslint-plugin-react-19-upgrade/blob/main/LICENSE)
[![CI](https://github.com/brettfarrow/eslint-plugin-react-19-upgrade/actions/workflows/ci.yml/badge.svg)](https://github.com/brettfarrow/eslint-plugin-react-19-upgrade/actions/workflows/ci.yml)

An ESLint plugin to identify and fix breaking changes when upgrading React 18 to React 19

## Installation

You'll first need to install [ESLint](https://eslint.org):

```
$ npm install eslint --save-dev
```

Next, install `eslint-plugin-react-19-upgrade`:

```
$ npm install eslint-plugin-react-19-upgrade --save-dev
```

## Usage

Add `react-19-upgrade` to the plugins section of your `.eslintrc` or equivalent configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
  "plugins": ["react-19-upgrade"]
}
```

Then configure the rules you want to use under the rules section.

```json
{
  "rules": {
    "react-19-upgrade/no-default-props": "error",
    "react-19-upgrade/no-prop-types": "warn",
    "react-19-upgrade/no-legacy-context": "error",
    "react-19-upgrade/no-string-refs": "error",
    "react-19-upgrade/no-factories": "error",
    "react-19-upgrade/no-legacy-react-dom": "error",
    "react-19-upgrade/no-legacy-react-dom-server": "error",
    "react-19-upgrade/no-legacy-test-utils": "error",
    "react-19-upgrade/no-legacy-react-is": "error",
    "react-19-upgrade/no-shallow-renderer": "error",
    "react-19-upgrade/no-implicit-ref-callback-return": "error"
  }
}
```

## Supported Rules

- `no-default-props`: Move `defaultProps` to default parameters in the destructured props. Fixable by ESLint.
- `no-prop-types`: Avoid using `propTypes` as they are now ignored in React 19.
- `no-legacy-context`: Disallow the use of legacy context APIs in React class components.
- `no-string-refs`: Disallow the use of string refs in React components.
- `no-factories`: Disallow module pattern factories and React.createFactory.
- `no-legacy-react-dom`: Disallow removed `react-dom` APIs (`render`, `hydrate`, `unmountComponentAtNode`, `findDOMNode`, plus the removed `unstable_flushControlled`, `unstable_createEventHandle`, `renderSubtreeIntoContainer`/`unstable_renderSubtreeIntoContainer`, and `unstable_runWithPriority`). Use `createRoot`/`hydrateRoot` from `react-dom/client`, or refs, instead.
- `no-legacy-react-dom-server`: Disallow `renderToNodeStream` and `renderToStaticNodeStream` from `react-dom/server`. Use `renderToPipeableStream` instead (note: different signature).
- `no-legacy-test-utils`: Disallow importing from `react-dom/test-utils`, which is removed entirely in React 19. `act` imports are rewritten to import from `react` (Fixable by ESLint); the other utilities (`Simulate`, `renderIntoDocument`, etc.) are reported with a pointer to `@testing-library/react`. Supersedes `no-legacy-test-utils-act` — enable one or the other, not both.
- `no-legacy-test-utils-act`: Import `act` from `react`, not `react-dom/test-utils`. Fixable by ESLint. Narrower than `no-legacy-test-utils` (only flags `act`); kept for backwards compatibility.
- `no-legacy-react-is`: Disallow `isConcurrentMode` and `isAsyncMode` from `react-is`, removed in React 19 without a replacement.
- `no-shallow-renderer`: Disallow importing `react-test-renderer/shallow`, removed in React 19. Rewritten to `react-shallow-renderer` (install it first). Fixable by ESLint.
- `no-implicit-ref-callback-return`: Disallow implicit returns in JSX ref callbacks (`ref={el => (this.el = el)}`) — React 19 treats the returned value as a cleanup function. The body is wrapped in braces (Fixable by ESLint). Only arrow expression bodies are flagged, matching the official `react/19` codemod; explicit `return` statements and function-expression refs are left alone.

### `element.ref` access

React 19 makes `ref` a regular prop, so `element.ref` becomes `element.props.ref`. This plugin does not lint for it — any sound static heuristic either misses real cases or produces false positives on valid code. Use the official React codemod instead: `npx codemod@latest react/19/replace-ref-access`.
