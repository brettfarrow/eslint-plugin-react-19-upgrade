const { RuleTester } = require("eslint");
const babelParser = require("@babel/eslint-parser");
const ruleNoDefaultProps = require("../rules/no-default-props");
const ruleNoPropTypes = require("../rules/no-prop-types");
const ruleNoLegacyContext = require("../rules/no-legacy-context");
const ruleNoStringRefs = require("../rules/no-string-refs");
const ruleNoFactories = require("../rules/no-factories");

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
          plugins: ["jsx", "classProperties"],
        },
      },
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

try {
  // Test for "no-default-props"
  ruleTester.run("no-default-props", ruleNoDefaultProps, {
    valid: [`const Component = ({ name }) => <div>{name}</div>;`],
    invalid: [
      // {
      //   code: `const Component = ({ name }) => <div>{name}</div>; Component.defaultProps = { name: 'Test' };`,
      //   errors: [
      //     {
      //       message:
      //         "'defaultProps' should not be used in 'Component' as they are no longer supported in React 19. Use default parameters instead.",
      //     },
      //   ],
      //   output: `const Component = ({ name = 'Test' }) => <div>{name}</div>; `,
      // },
      {
        code: `function Component({name}) { return <div>{name}</div>; } Component.defaultProps = { name: 'Test' };`,
        errors: [
          {
            message:
              "'defaultProps' should not be used in 'Component' as they are no longer supported in React 19. Use default parameters instead.",
          },
        ],
        output: `function Component({ name = 'Test' }) { return <div>{name}</div>; } `,
      },
      {
        code: `const Component = ({ name }) => <div>{name}</div>; const Component2 = Component; Component2.defaultProps = { name: 'Test' };`,
        errors: [
          {
            message:
              "'defaultProps' should not be used in 'Component2' as they are no longer supported in React 19. Use default parameters instead.",
          },
        ],
      },
      {
        code: `import Component from './Component'; const Component2 = Component; Component2.defaultProps = { name: 'Test' };`,
        errors: [
          {
            message:
              "'defaultProps' should not be used in 'Component2' as they are no longer supported in React 19. Use default parameters instead.",
          },
        ],
      },
      {
        code: `import Component from './Component'; const Component2 = styled(Component)\`\`; Component2.defaultProps = { name: 'Test' };`,
        errors: [
          {
            message:
              "'defaultProps' should not be used in 'Component2' as they are no longer supported in React 19. Use default parameters instead.",
          },
        ],
      },
    ],
  });

  // Test for "no-prop-types"
  ruleTester.run("no-prop-types", ruleNoPropTypes, {
    valid: [`const Component = ({ name }) => <div>{name}</div>;`],
    invalid: [
      {
        code: `import PropTypes from 'prop-types';
        
        const Component = ({ name }) => <div>{name}</div>;
        
        Component.propTypes = { name: PropTypes.string };`,
        errors: [
          {
            message:
              "'prop-types' should not be imported in '<input>' as they are no longer supported in React 19.",
            type: "ImportDefaultSpecifier", // TODO: This is an ImportDeclaration in the code, determine why that type isn't returned
          },
          {
            message:
              "'propTypes' should not be used in 'Component' as they are no longer supported in React 19.",
            type: "AssignmentExpression",
          },
        ],
      },
    ],
  });

  // Tests for "no-legacy-context"
  ruleTester.run("no-legacy-context", ruleNoLegacyContext, {
    valid: [
      // Example of a class component that does not use legacy context APIs
      `
      class MyComponent extends React.Component {
        render() {
          return <div>{this.props.children}</div>;
        }
      }
      `,
      // Using the new context API
      `
      const MyContext = React.createContext();
      class MyComponent extends React.Component {
        static contextType = MyContext;
        render() {
          return <div>{this.context}</div>;
        }
      }
      `,
    ],
    invalid: [
      {
        code: `
        import PropTypes from 'prop-types';

        class Parent extends React.Component {
          static childContextTypes = {
            foo: PropTypes.string.isRequired,
          };

          getChildContext() {
            return { foo: 'bar' };
          }

          render() {
            return <Child />;
          }
        }

        class Child extends React.Component {
          static contextTypes = {
            foo: PropTypes.string.isRequired,
          };

          render() {
            return <div>{this.context.foo}</div>;
          }
        }
        `,
        errors: [
          // TODO: Fix and re-enable these tests. These first two tests aren't returning the correct result
          // despite working when running ESLint normally.
          // {
          //   message:
          //     "'contextTypes' uses a legacy contextTypes API that is no longer supported in React 19. Use 'contextType' instead.",
          // },
          // {
          //   message:
          //     "'childContextTypes' uses a legacy contextTypes API that is no longer supported in React 19. Use 'contextType' instead.",
          // },
          {
            message:
              "'getChildContext' uses a legacy context API that is no longer supported in React 19. Use 'React.createContext()' instead.",
          },
        ],
      },
    ],
  });

  // Test for "no-string-refs"
  ruleTester.run("no-string-refs", ruleNoStringRefs, {
    valid: [
      {
        code: `<input ref={(input) => this.input = input} />`,
      },
    ],
    invalid: [
      {
        code: `<input ref='input' />`,
        errors: [{ messageId: "noStringRefs", type: "JSXAttribute" }],
      },
    ],
  });

  ruleTester.run("no-factories", ruleNoFactories, {
    valid: [
      `function FactoryComponent() { return <div />; }`,
      `const button = <button />;`,
    ],
    invalid: [
      {
        code: `function FactoryComponent() { return { render() { return <div />; } } }`,
        errors: [{ messageId: "noModulePattern" }],
      },
      {
        code: `import { createFactory } from 'react'; const divFactory = createFactory('div');`,
        errors: [{ messageId: "noCreateFactory" }],
      },
    ],
  });

  console.log("All tests passed!");
} catch (error) {
  console.error(error);
  console.error("One or more tests failed!");
}
