# eslint-plugin-react-19-upgrade

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
    "react-19-upgrade/no-factories": "error"
  }
}
```

## Supported Rules

- `no-default-props`: Move `defaultProps` to default parameters in the destructured props. Fixable by ESLint.
- `no-prop-types`: Avoid using `propTypes` as they are now ignored in React 19.
- `no-legacy-context`: Disallow the use of legacy context APIs in React class components.
- `no-string-refs`: Disallow the use of string refs in React components.
- `no-factories`: Disallow module pattern factories and React.createFactory.
