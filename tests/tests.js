const assert = require("assert");
const { RuleTester } = require("eslint");
const babelParser = require("@babel/eslint-parser");

const plugin = require("../index.js");
const ruleNoDefaultProps = require("../rules/no-default-props");
const ruleNoPropTypes = require("../rules/no-prop-types");
const ruleNoLegacyContext = require("../rules/no-legacy-context");
const ruleNoStringRefs = require("../rules/no-string-refs");
const ruleNoFactories = require("../rules/no-factories");
const ruleNoLegacyReactDom = require("../rules/no-legacy-react-dom");
const ruleNoLegacyReactDomServer = require("../rules/no-legacy-react-dom-server");
const ruleNoLegacyTestUtilsAct = require("../rules/no-legacy-test-utils-act");

// --- minimal describe/it harness (mirrors prior style, prints a tree) ---

const stats = { passed: 0, failed: 0 };
let currentSuite = null;

function describe(text, method) {
  const parent = currentSuite;
  const suite = { text, depth: parent ? parent.depth + 1 : 0 };
  currentSuite = suite;
  const indent = "  ".repeat(suite.depth);
  console.log(`${indent}${text}`);
  try {
    method();
  } finally {
    currentSuite = parent;
  }
}

function it(text, method) {
  const indent = "  ".repeat((currentSuite ? currentSuite.depth : 0) + 1);
  const label = text.length > 80 ? `${text.slice(0, 77)}...` : text;
  try {
    method();
    stats.passed += 1;
    console.log(`${indent}\u2713 ${label}`);
  } catch (err) {
    stats.failed += 1;
    console.log(`${indent}\u2717 ${label}`);
    console.log(`${indent}  ${err.message.split("\n").join(`\n${indent}  `)}`);
  }
}

// RuleTester wires up to the same harness so its runs appear in the tree
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it;

const ruleTester = new RuleTester({
  files: ["**/*.js", "**/*.mjs"],
  languageOptions: {
    parser: babelParser,
    parserOptions: {
      requireConfigFile: false,
      babelOptions: {
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ["jsx", "classProperties"] },
      },
      ecmaFeatures: { jsx: true },
    },
  },
});

// -----------------------------------------------------------------------
// 1. Plugin API surface
// -----------------------------------------------------------------------

describe("plugin api surface", () => {
  it("exports a rules object", () => {
    assert.ok(plugin && typeof plugin === "object", "plugin is an object");
    assert.ok(plugin.rules && typeof plugin.rules === "object", "plugin.rules exists");
  });

  it("registers all eight canonical rules", () => {
    for (const name of [
      "no-default-props",
      "no-prop-types",
      "no-legacy-context",
      "no-string-refs",
      "no-factories",
      "no-legacy-react-dom",
      "no-legacy-react-dom-server",
      "no-legacy-test-utils-act",
    ]) {
      assert.ok(plugin.rules[name], `rule ${name} is registered`);
    }
  });

  it("exposes no-defaultprops / no-proptypes aliases pointing to the same rule", () => {
    assert.strictEqual(plugin.rules["no-defaultprops"], plugin.rules["no-default-props"]);
    assert.strictEqual(plugin.rules["no-proptypes"], plugin.rules["no-prop-types"]);
  });

  it("every rule has meta.type, meta.docs.url, meta.messages, and schema", () => {
    for (const [name, rule] of Object.entries(plugin.rules)) {
      assert.ok(rule.meta, `${name}.meta`);
      assert.ok(
        ["problem", "suggestion", "layout"].includes(rule.meta.type),
        `${name}.meta.type is valid`,
      );
      assert.ok(rule.meta.docs && typeof rule.meta.docs.url === "string", `${name}.docs.url`);
      assert.ok(rule.meta.messages && Object.keys(rule.meta.messages).length > 0, `${name}.messages`);
      assert.ok(Array.isArray(rule.meta.schema), `${name}.schema is array`);
      assert.strictEqual(typeof rule.create, "function", `${name}.create is function`);
    }
  });

  it("every message template is a non-empty string", () => {
    for (const [name, rule] of Object.entries(plugin.rules)) {
      for (const [id, tpl] of Object.entries(rule.meta.messages)) {
        assert.strictEqual(typeof tpl, "string", `${name}.${id}`);
        assert.ok(tpl.length > 0, `${name}.${id} not empty`);
      }
    }
  });

  it("rule.create returns an object of AST visitors", () => {
    const fakeContext = {
      report: () => {},
      getSourceCode: () => ({ getScope: () => ({ variables: [], upper: null }) }),
      sourceCode: { getScope: () => ({ variables: [], upper: null }), getText: () => "" },
      getFilename: () => "<input>",
      filename: "<input>",
      getScope: () => ({ variables: [], upper: null }),
    };
    for (const [name, rule] of Object.entries(plugin.rules)) {
      const visitors = rule.create(fakeContext);
      assert.ok(visitors && typeof visitors === "object", `${name}.create returns object`);
      for (const fn of Object.values(visitors)) {
        assert.strictEqual(typeof fn, "function", `${name} visitor is function`);
      }
    }
  });
});

// -----------------------------------------------------------------------
// 2. no-default-props
// -----------------------------------------------------------------------

ruleTester.run("no-default-props", ruleNoDefaultProps, {
  valid: [
    // --- baseline shapes that should not fire ---
    `const Component = ({ name }) => <div>{name}</div>;`,
    `const Component = ({ name = 'x' }) => <div>{name}</div>;`,
    `function Component({ name }) { return <div>{name}</div>; }`,

    // class components — defaultProps is still legal on classes in React 19
    `
      import { PureComponent } from 'react';
      class ClassComponent extends PureComponent {
        render() { const { propKey } = this.props; return propKey; }
      }
      ClassComponent.defaultProps = { propKey: 'propValue' };
    `,
    `
      class C extends React.Component {
        static defaultProps = { a: 1 };
        render() { return null; }
      }
    `,

    // assignment shapes the rule deliberately ignores
    `foo.bar.defaultProps = { a: 1 };`,          // object not an Identifier
    `Component.propTypes = { a: 1 };`,            // different property name
    `Component.defaultProps = otherDefaults;`,    // right is not ObjectExpression
    `Component["defaultProps"] = { a: 1 };`,      // computed member
  ],
  invalid: [
    // --- simple arrow FC, single key, destructured + shorthand ---
    {
      code: `const Component = ({ name }) => <div>{name}</div>; Component.defaultProps = { name: 'Test' };`,
      errors: [{ messageId: "defaultPropsDisallowed", data: { name: "Component" } }],
      output: `const Component = ({ name = 'Test' }) => <div>{name}</div>; `,
    },
    // function declaration
    {
      code: `function Component({name}) { return <div>{name}</div>; } Component.defaultProps = { name: 'Test' };`,
      errors: 1,
      output: `function Component({ name = 'Test' }) { return <div>{name}</div>; } `,
    },
    // non-destructured (props) — reports, but no fix
    {
      code: `const Component = (props) => <div>{props.name}</div>; Component.defaultProps = { name: 'Test' };`,
      errors: 1,
      output: null,
    },
    // rest spread preserved
    {
      code: `const Component = ({ name, ...rest }) => <div>{name}</div>; Component.defaultProps = { name: 'Test' };`,
      errors: 1,
      output: `const Component = ({ name = 'Test', ...rest }) => <div>{name}</div>; `,
    },
    // renamed destructure
    {
      code: `const Component = ({ name: displayName }) => <div>{displayName}</div>; Component.defaultProps = { name: 'Test' };`,
      errors: 1,
      output: `const Component = ({ name: displayName = 'Test' }) => <div>{displayName}</div>; `,
    },
    // aliased via const
    {
      code: `const Component = ({ name }) => <div>{name}</div>; const Component2 = Component; Component2.defaultProps = { name: 'Test' };`,
      errors: [{ messageId: "defaultPropsDisallowed", data: { name: "Component2" } }],
      output: `const Component = ({ name = 'Test' }) => <div>{name}</div>; const Component2 = Component; `,
    },
    // aliased to an imported component — reports, but no fix (can't reach definition)
    {
      code: `import Component from './Component'; const Component2 = Component; Component2.defaultProps = { name: 'Test' };`,
      errors: 1,
    },
    // wrapped by styled() — not a function component, reports without fix
    {
      code: "import Component from './Component'; const Component2 = styled(Component)``; Component2.defaultProps = { name: 'Test' };",
      errors: 1,
    },
    // forwardRef wrapping — same: call expression, not a function/class node we can edit
    {
      code: `const C = React.forwardRef((props, ref) => <div />); C.defaultProps = { a: 1 };`,
      errors: 1,
      output: null,
    },

    // --- multi-key behavior ---
    {
      code: `const C = ({ a, b }) => <div>{a}{b}</div>; C.defaultProps = { a: 1, b: 2 };`,
      errors: 1,
      output: `const C = ({ a = 1, b = 2 }) => <div>{a}{b}</div>; `,
    },
    // key in defaults but not in destructure — appended to destructure
    {
      code: `const C = ({ a }) => <div />; C.defaultProps = { a: 1, b: 2 };`,
      errors: 1,
      output: `const C = ({ a = 1, b = 2 }) => <div />; `,
    },
    // key in destructure but not in defaults — left untouched
    {
      code: `const C = ({ a, b }) => <div />; C.defaultProps = { a: 1 };`,
      errors: 1,
      output: `const C = ({ a = 1, b }) => <div />; `,
    },

    // --- preservation of existing defaults ---
    {
      code: `const C = ({ a = 'keep' }) => <div />; C.defaultProps = { a: 'ignored' };`,
      errors: 1,
      output: `const C = ({ a = 'keep' }) => <div />; `,
    },

    // --- complex default expressions ---
    {
      code: `const C = ({ onClick }) => <button onClick={onClick} />; C.defaultProps = { onClick: () => {} };`,
      errors: 1,
      output: `const C = ({ onClick = () => {} }) => <button onClick={onClick} />; `,
    },
    {
      code: `const DEFAULT = 'hi'; const C = ({ name }) => <div>{name}</div>; C.defaultProps = { name: DEFAULT };`,
      errors: 1,
      output: `const DEFAULT = 'hi'; const C = ({ name = DEFAULT }) => <div>{name}</div>; `,
    },

    // --- non-fixable due to unsafe key shape ---
    {
      code: "const C = ({ a }) => <div />; C.defaultProps = { a: 1, 'data-x': 2 };",
      errors: 1,
      output: null,
    },

    // --- empty defaults — reports, fix collapses the assignment ---
    {
      code: `const C = ({ a }) => <div />; C.defaultProps = {};`,
      errors: 1,
      output: `const C = ({ a }) => <div />; `,
    },
  ],
});

// -----------------------------------------------------------------------
// 3. no-prop-types
// -----------------------------------------------------------------------

ruleTester.run("no-prop-types", ruleNoPropTypes, {
  valid: [
    `const Component = ({ name }) => <div>{name}</div>;`,
    `import Something from 'not-prop-types';`,
    `const other = require('not-prop-types');`,              // different module
    `foo.propTypes = { a: 1 };`,                             // lowercase identifier guarded
    `this.propTypes = { a: 1 };`,                            // ThisExpression, not Identifier
    `class C { propTypes = { a: 1 }; }`,                     // instance field, not static
  ],
  invalid: [
    {
      code: `
        import PropTypes from 'prop-types';
        const Component = ({ name }) => <div>{name}</div>;
        Component.propTypes = { name: PropTypes.string };
      `,
      errors: [
        { messageId: "propTypesImportDisallowed" },
        { messageId: "propTypesDisallowed", data: { name: "Component" } },
      ],
    },
    {
      code: `
        import PT from 'prop-types';
        const Component = ({ name }) => <div>{name}</div>;
        Component.propTypes = { name: PT.string };
      `,
      errors: [
        { messageId: "propTypesImportDisallowed" },
        { messageId: "propTypesDisallowed" },
      ],
    },
    {
      code: `import { bool, string } from 'prop-types';`,
      errors: [
        { messageId: "propTypesImportDisallowed" },
        { messageId: "propTypesImportDisallowed" },
      ],
    },
    {
      code: `import * as PT from 'prop-types';`,
      errors: [{ messageId: "propTypesImportDisallowed" }],
    },
    // propTypes assignment without any import — still flagged
    {
      code: `Component.propTypes = { a: 1 };`,
      errors: [{ messageId: "propTypesDisallowed" }],
    },
    // CommonJS require of prop-types
    {
      code: `const PropTypes = require('prop-types');`,
      errors: [{ messageId: "propTypesImportDisallowed" }],
    },
    // static propTypes class field on a class declaration
    {
      code: `class Component { static propTypes = { a: 1 }; }`,
      errors: [{ messageId: "propTypesDisallowed", data: { name: "Component" } }],
    },
    // static propTypes on a class expression (uses binding name)
    {
      code: `const Component = class { static propTypes = { a: 1 }; };`,
      errors: [{ messageId: "propTypesDisallowed", data: { name: "Component" } }],
    },
    // multiple components in one file
    {
      code: `
        import PropTypes from 'prop-types';
        const A = () => null;
        const B = () => null;
        A.propTypes = { x: PropTypes.string };
        B.propTypes = { y: PropTypes.number };
      `,
      errors: [
        { messageId: "propTypesImportDisallowed" },
        { messageId: "propTypesDisallowed", data: { name: "A" } },
        { messageId: "propTypesDisallowed", data: { name: "B" } },
      ],
    },
  ],
});

// -----------------------------------------------------------------------
// 4. no-legacy-context
// -----------------------------------------------------------------------

ruleTester.run("no-legacy-context", ruleNoLegacyContext, {
  valid: [
    `
      class MyComponent extends React.Component {
        render() { return <div>{this.props.children}</div>; }
      }
    `,
    // modern context API
    `
      const MyContext = React.createContext();
      class MyComponent extends React.Component {
        static contextType = MyContext;
        render() { return <div>{this.context}</div>; }
      }
    `,
    // similarly-named, unrelated members
    `
      class C extends React.Component {
        static myContextTypes = { a: 1 };
        getContext() { return {}; }
        render() { return null; }
      }
    `,
  ],
  invalid: [
    // the full triple from the original suite
    {
      code: `
        import PropTypes from 'prop-types';
        class Parent extends React.Component {
          static childContextTypes = { foo: PropTypes.string.isRequired };
          getChildContext() { return { foo: 'bar' }; }
          render() { return <Child />; }
        }
        class Child extends React.Component {
          static contextTypes = { foo: PropTypes.string.isRequired };
          render() { return <div>{this.context.foo}</div>; }
        }
      `,
      errors: [
        { message: "'childContextTypes' uses a legacy context API that is no longer supported in React 19. Use 'contextType' instead." },
        { message: "'getChildContext' uses a legacy context API that is no longer supported in React 19. Use 'React.createContext()' instead." },
        { message: "'contextTypes' uses a legacy context API that is no longer supported in React 19. Use 'contextType' instead." },
      ],
    },
    // contextTypes alone
    {
      code: `
        class C extends React.Component {
          static contextTypes = { a: 1 };
          render() { return null; }
        }
      `,
      errors: 1,
    },
    // childContextTypes alone
    {
      code: `
        class C extends React.Component {
          static childContextTypes = { a: 1 };
          render() { return null; }
        }
      `,
      errors: 1,
    },
    // getChildContext alone
    {
      code: `
        class C extends React.Component {
          getChildContext() { return {}; }
          render() { return null; }
        }
      `,
      errors: 1,
    },
    // instance (non-static) class field — rule still catches these
    {
      code: `
        class C extends React.Component {
          contextTypes = { a: 1 };
          render() { return null; }
        }
      `,
      errors: 1,
    },
    // class expression with legacy context — also caught
    {
      code: `
        const C = class extends React.Component {
          static contextTypes = { a: 1 };
          getChildContext() { return {}; }
          render() { return null; }
        };
      `,
      errors: 2,
    },
  ],
});

// -----------------------------------------------------------------------
// 5. no-string-refs
// -----------------------------------------------------------------------

ruleTester.run("no-string-refs", ruleNoStringRefs, {
  valid: [
    // callback ref
    { code: `<input ref={(input) => this.input = input} />` },
    // object ref from useRef
    { code: `const r = useRef(null); return <input ref={r} />;` },
    // null ref
    { code: `<input ref={null} />` },
    // numeric in expression container
    { code: `<input ref={42} />` },
    // no ref attribute at all
    { code: `<input type="text" />` },
    // template literal (not a Literal node) — bypasses the rule by design
    { code: "<input ref={`dyn`} />" },
  ],
  invalid: [
    {
      code: `<input ref='input' />`,
      errors: [{ messageId: "noStringRefs", type: "JSXAttribute" }],
    },
    // double-quoted
    {
      code: `<input ref="input" />`,
      errors: [{ messageId: "noStringRefs" }],
    },
    // empty string literal in attribute position
    {
      code: `<input ref="" />`,
      errors: [{ messageId: "noStringRefs" }],
    },
    // string literal wrapped in a JSXExpressionContainer
    {
      code: `<input ref={"input"} />`,
      errors: [{ messageId: "noStringRefs" }],
    },
    {
      code: `<input ref={""} />`,
      errors: [{ messageId: "noStringRefs" }],
    },
    // nested JSX
    {
      code: `<div><input ref="inner" /></div>`,
      errors: [{ messageId: "noStringRefs" }],
    },
    // inside a map
    {
      code: `items.map(i => <input key={i} ref="x" />);`,
      errors: [{ messageId: "noStringRefs" }],
    },
    // multiple string refs in one file — each reported
    {
      code: `<div><input ref="a" /><input ref="b" /></div>`,
      errors: [
        { messageId: "noStringRefs" },
        { messageId: "noStringRefs" },
      ],
    },
  ],
});

// -----------------------------------------------------------------------
// 6. no-factories
// -----------------------------------------------------------------------

ruleTester.run("no-factories", ruleNoFactories, {
  valid: [
    `function FactoryComponent() { return <div />; }`,
    `const button = <button />;`,
    // lowercase function returning an object with render — not a React factory
    `
      function notReact() {
        return { render: function() { return value; } };
      }
    `,
    // lowercase const assigned a factory-like object — not flagged
    `
      const helper = function() {
        return { render: function() { return null; } };
      };
    `,
    // uppercase but no render method — not the module-factory pattern
    `
      function Config() {
        return { foo: 1, bar: 2 };
      }
    `,
    // createFactory imported from a different package — not flagged
    `import { createFactory } from 'other'; const d = createFactory('div');`,
    // destructure from a require() of a different package
    `const { createFactory } = require('other'); const d = createFactory('div');`,
  ],
  invalid: [
    // classic module-pattern factory
    {
      code: `function FactoryComponent() { return { render() { return <div />; } } }`,
      errors: [{ messageId: "noModulePattern" }],
    },
    // uppercase arrow / function expression assigned to const
    {
      code: `const Foo = function() { return { render: function() { return null; } }; };`,
      errors: [{ messageId: "noModulePattern" }],
    },
    // named import of createFactory from react
    {
      code: `import { createFactory } from 'react'; const divFactory = createFactory('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // aliased React.createFactory
    {
      code: `const createFactory = React.createFactory; const divFactory = createFactory('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // destructured from React (identifier, not via require)
    {
      code: `const { createFactory } = React; const d = createFactory('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // renamed destructure — tracked via property key matching
    {
      code: `const { createFactory: cf } = React; const d = cf('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // direct React.createFactory call without any alias
    {
      code: `const d = React.createFactory('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // destructure from require('react')
    {
      code: `const { createFactory } = require('react'); const d = createFactory('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // renamed destructure from require('react')
    {
      code: `const { createFactory: cf } = require('react'); const d = cf('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
    // direct require('react').createFactory(...) call
    {
      code: `const d = require('react').createFactory('div');`,
      errors: [{ messageId: "noCreateFactory" }],
    },
  ],
});

// -----------------------------------------------------------------------
// 7. no-legacy-react-dom
// -----------------------------------------------------------------------

ruleTester.run("no-legacy-react-dom", ruleNoLegacyReactDom, {
  valid: [
    // surviving react-dom APIs
    `import ReactDOM from 'react-dom'; ReactDOM.flushSync(() => {});`,
    `import { createPortal } from 'react-dom'; createPortal(child, container);`,
    // different module
    `const other = require('not-react-dom'); other.render(x, y);`,
    // locally-defined render, no react-dom import
    `const render = () => {}; render();`,
    // the correct R19 replacement code
    `import { createRoot } from 'react-dom/client'; createRoot(el).render(<App />);`,
    `import { hydrateRoot } from 'react-dom/client'; hydrateRoot(el, <App />);`,
    // react-dom/client is a different module
    `import ReactDOMClient from 'react-dom/client'; ReactDOMClient.createRoot(el);`,
    // shadowed local is not the imported namespace
    `import ReactDOM from 'react-dom'; function useLocal(ReactDOM) { ReactDOM.render(<App />, root); }`,
  ],
  invalid: [
    {
      code: `import ReactDOM from 'react-dom'; ReactDOM.render(<App />, root);`,
      errors: [{ messageId: "noRender" }],
    },
    {
      code: `import { render } from 'react-dom'; render(<App />, root);`,
      errors: [{ messageId: "noRender" }],
    },
    // removed import should fail even if unused
    {
      code: `import { render } from 'react-dom';`,
      errors: [{ messageId: "noRender" }],
    },
    // aliased named import
    {
      code: `import { render as r } from 'react-dom'; r(<App />, root);`,
      errors: [{ messageId: "noRender" }],
    },
    // removed member reference should fail even if not called
    {
      code: `import ReactDOM from 'react-dom'; const legacyRender = ReactDOM.render;`,
      errors: [{ messageId: "noRender" }],
    },
    {
      code: `import ReactDOM from 'react-dom'; ReactDOM.hydrate(<App />, root);`,
      errors: [{ messageId: "noHydrate" }],
    },
    {
      code: `import { hydrate } from 'react-dom'; hydrate(<App />, root);`,
      errors: [{ messageId: "noHydrate" }],
    },
    {
      code: `import ReactDOM from 'react-dom'; ReactDOM.unmountComponentAtNode(root);`,
      errors: [{ messageId: "noUnmountComponentAtNode" }],
    },
    {
      code: `const { unmountComponentAtNode } = require('react-dom'); unmountComponentAtNode(root);`,
      errors: [{ messageId: "noUnmountComponentAtNode" }],
    },
    // destructured require should fail even if unused
    {
      code: `const { render } = require('react-dom');`,
      errors: [{ messageId: "noRender" }],
    },
    {
      code: `import ReactDOM from 'react-dom'; ReactDOM.findDOMNode(instance);`,
      errors: [{ messageId: "noFindDOMNode" }],
    },
    {
      code: `const { findDOMNode } = require('react-dom'); findDOMNode(instance);`,
      errors: [{ messageId: "noFindDOMNode" }],
    },
    // renamed destructure from require
    {
      code: `const { render: r } = require('react-dom'); r(<App />, root);`,
      errors: [{ messageId: "noRender" }],
    },
    // namespace import
    {
      code: `import * as RD from 'react-dom'; RD.findDOMNode(i);`,
      errors: [{ messageId: "noFindDOMNode" }],
    },
    // inline require
    {
      code: `require('react-dom').render(<App />, root);`,
      errors: [{ messageId: "noRender" }],
    },
    // CommonJS namespace var
    {
      code: `const ReactDOM = require('react-dom'); ReactDOM.hydrate(<App />, root);`,
      errors: [{ messageId: "noHydrate" }],
    },
  ],
});

// -----------------------------------------------------------------------
// 8. no-legacy-react-dom-server
// -----------------------------------------------------------------------

ruleTester.run("no-legacy-react-dom-server", ruleNoLegacyReactDomServer, {
  valid: [
    // surviving exports
    `import { renderToString } from 'react-dom/server'; renderToString(<App />);`,
    `import { renderToStaticMarkup } from 'react-dom/server'; renderToStaticMarkup(<App />);`,
    `import { renderToPipeableStream } from 'react-dom/server';`,
    `import { renderToReadableStream } from 'react-dom/server';`,
    `import Server from 'react-dom/server'; Server.renderToString(<App />);`,
    // different module
    `import { renderToNodeStream } from 'not-react-dom-server';`,
    `const { renderToNodeStream } = require('something-else');`,
    // shadowed local is not the imported namespace
    `import Server from 'react-dom/server'; function useLocal(Server) { Server.renderToNodeStream(<App />); }`,
  ],
  invalid: [
    {
      code: `import { renderToNodeStream } from 'react-dom/server'; renderToNodeStream(<App />);`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
    {
      code: `import { renderToStaticNodeStream } from 'react-dom/server';`,
      errors: [{ messageId: "noRenderToStaticNodeStream" }],
    },
    // mixed import: allowlist proves surviving export is ignored
    {
      code: `import { renderToString, renderToNodeStream } from 'react-dom/server';`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
    // namespace access
    {
      code: `import Server from 'react-dom/server'; Server.renderToNodeStream(<App />);`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
    // removed member reference should fail even if not called
    {
      code: `import Server from 'react-dom/server'; const legacy = Server.renderToNodeStream;`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
    {
      code: `import Server from 'react-dom/server'; Server.renderToStaticNodeStream(<App />);`,
      errors: [{ messageId: "noRenderToStaticNodeStream" }],
    },
    // namespace * as
    {
      code: `import * as Server from 'react-dom/server'; Server.renderToNodeStream(<App />);`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
    // destructure from require
    {
      code: `const { renderToNodeStream } = require('react-dom/server');`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
    // CommonJS namespace var
    {
      code: `const Server = require('react-dom/server'); Server.renderToStaticNodeStream(<App />);`,
      errors: [{ messageId: "noRenderToStaticNodeStream" }],
    },
    // inline require
    {
      code: `require('react-dom/server').renderToNodeStream(<App />);`,
      errors: [{ messageId: "noRenderToNodeStream" }],
    },
  ],
});

// -----------------------------------------------------------------------
// 9. no-legacy-test-utils-act
// -----------------------------------------------------------------------

ruleTester.run("no-legacy-test-utils-act", ruleNoLegacyTestUtilsAct, {
  valid: [
    // correct R19 import
    `import { act } from 'react'; act(() => {});`,
    // unrelated test-utils export still legal
    `import { Simulate } from 'react-dom/test-utils'; Simulate.click(node);`,
    `const TestUtils = require('react-dom/test-utils'); TestUtils.Simulate.click(node);`,
    // different module
    `import TestUtils from 'other/test-utils'; TestUtils.act(() => {});`,
    // local identifier coincidentally named act, no test-utils binding
    `const act = (fn) => fn(); act(() => {});`,
    // shadowed local is not the imported namespace
    `import TestUtils from 'react-dom/test-utils'; function useLocal(TestUtils) { TestUtils.act(() => {}); }`,
  ],
  invalid: [
    // simple named import — fixable
    {
      code: `import { act } from 'react-dom/test-utils'; act(() => {});`,
      errors: [{ messageId: "noTestUtilsAct" }],
      output: `import { act } from 'react'; act(() => {});`,
    },
    // aliased named import — alias preserved
    {
      code: `import { act as a } from 'react-dom/test-utils'; a(() => {});`,
      errors: [{ messageId: "noTestUtilsAct" }],
      output: `import { act as a } from 'react'; a(() => {});`,
    },
    // mixed — split into two imports
    {
      code: `import { act, Simulate } from 'react-dom/test-utils';`,
      errors: [{ messageId: "noTestUtilsAct" }],
      output: `import { act } from 'react';\nimport { Simulate } from 'react-dom/test-utils';`,
    },
    // default + named — default stays, act moves
    {
      code: `import TestUtils, { act } from 'react-dom/test-utils'; TestUtils.Simulate.click(node);`,
      errors: [{ messageId: "noTestUtilsAct" }],
      output: `import { act } from 'react';\nimport TestUtils from 'react-dom/test-utils'; TestUtils.Simulate.click(node);`,
    },
    // namespace + act via member access — reported, not fixed
    {
      code: `import TestUtils from 'react-dom/test-utils'; TestUtils.act(() => {});`,
      errors: [
        { messageId: "noTestUtilsAct" },
      ],
    },
    {
      code: `import * as TestUtils from 'react-dom/test-utils'; TestUtils.act(() => {});`,
      errors: [
        { messageId: "noTestUtilsAct" },
      ],
    },
    // CommonJS destructure — reported, not fixed
    {
      code: `const { act } = require('react-dom/test-utils'); act(() => {});`,
      errors: [{ messageId: "noTestUtilsAct" }],
    },
    // CommonJS namespace var + member access
    {
      code: `const TestUtils = require('react-dom/test-utils'); TestUtils.act(() => {});`,
      errors: [{ messageId: "noTestUtilsAct" }],
    },
    // inline require
    {
      code: `require('react-dom/test-utils').act(() => {});`,
      errors: [{ messageId: "noTestUtilsAct" }],
    },
  ],
});

// -----------------------------------------------------------------------
// summary
// -----------------------------------------------------------------------

console.log(`\n${stats.passed} passed, ${stats.failed} failed`);
if (stats.failed > 0) {
  process.exitCode = 1;
}
