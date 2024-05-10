# eslint-plugin-react-19-upgrade

An ESLint plugin to identify and fix breaking changes when upgrading React 18 to React 19

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-react-19-upgrade`:

```
$ npm install eslint-plugin-react-19-upgrade --save-dev
```

## Usage

Add `react-19-upgrade` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
  "plugins": ["react-19-upgrade"]
}
```

Then configure the rules you want to use under the rules section.

```json
{
  "rules": {
    "react-19-upgrade/no-default-props": "error"
  }
}
```

## Supported Rules

- `no-default-props`: only available as `error`. Move defaultProps to default parameters in the destructured props.

## Coming Soon

- `no-prop-types`: available as `error` or `warn`. Avoid using `propTypes` as they are now ignored in React 19.
- other [breaking changes](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#breaking-changes)
