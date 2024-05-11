const { RuleTester } = require("eslint");
const babelParser = require("@babel/eslint-parser");
const ruleNoDefaultProps = require("../rules/no-default-props");
const ruleNoPropTypes = require("../rules/no-prop-types");

const ruleTester = new RuleTester({
  files: ["**/*.js", "**/*.mjs"],
  languageOptions: {
    parser: babelParser,
    parserOptions: {
      requireConfigFile: false,
      babelOptions: {
        babelrc: false,
        configFile: false,
        parserOpts: {
          plugins: ["jsx"],
        },
      },
    },
  },
});

try {
  // Test for "no-default-props"
  ruleTester.run("no-default-props", ruleNoDefaultProps, {
    valid: [`const Component = ({ name }) => <div>{name}</div>;`],
    invalid: [
      {
        code: `const Component = ({ name }) => <div>{name}</div>; Component.defaultProps = { name: 'Test' };`,
        errors: [
          {
            message:
              "Move defaultProps to default parameters in the destructured props.",
          },
        ],
        output: `const Component = ({ name = 'Test' }) => <div>{name}</div>; `,
      },
    ],
  });

  // Test for "no-prop-types"
  ruleTester.run("no-prop-types", ruleNoPropTypes, {
    valid: [`const Component = ({ name }) => <div>{name}</div>;`],
    invalid: [
      {
        code: `const Component = ({ name }) => <div>{name}</div>; Component.propTypes = { name: PropTypes.string };`,
        errors: [
          {
            message:
              "'propTypes' should not be used in 'Component' as they are no longer supported in React 19.",
            type: "AssignmentExpression",
          },
        ],
      },
    ],
  });
  console.log("All tests passed!");
} catch (error) {
  console.error(error);
  console.error("One or more tests failed!");
}
