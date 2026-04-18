// rules/no-legacy-react-dom.js

const SOURCE = "react-dom";

const REMOVED_APIS = {
  render: "noRender",
  hydrate: "noHydrate",
  unmountComponentAtNode: "noUnmountComponentAtNode",
  findDOMNode: "noFindDOMNode",
};

function findVariable(scope, name) {
  let currentScope = scope;

  while (currentScope) {
    const variable = currentScope.variables.find((item) => item.name === name);

    if (variable) {
      return variable;
    }

    currentScope = currentScope.upper;
  }

  return null;
}

function isRequireReactDom(node) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments.length === 1 &&
    node.arguments[0].type === "Literal" &&
    node.arguments[0].value === SOURCE
  );
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ReactDOM.render, hydrate, unmountComponentAtNode, and findDOMNode (removed in React 19)",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-deprecations",
    },
    messages: {
      noRender:
        "'ReactDOM.render' is removed in React 19. Import 'createRoot' from 'react-dom/client' and call 'createRoot(container).render(element)' instead.",
      noHydrate:
        "'ReactDOM.hydrate' is removed in React 19. Import 'hydrateRoot' from 'react-dom/client' and call 'hydrateRoot(container, element)' instead.",
      noUnmountComponentAtNode:
        "'ReactDOM.unmountComponentAtNode' is removed in React 19. Hold on to the root returned by 'createRoot' and call 'root.unmount()' instead.",
      noFindDOMNode:
        "'ReactDOM.findDOMNode' is removed in React 19. Attach a ref to the DOM node you need instead.",
    },
    schema: [],
    ruleId: "no-legacy-react-dom",
    hasSuggestions: true,
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const namespaceVariables = new Set();

    function reportApi(node, apiName) {
      const messageId = REMOVED_APIS[apiName];
      if (!messageId) return;
      context.report({ node, messageId });
    }

    function trackNamespace(node) {
      const [variable] = sourceCode.getDeclaredVariables(node);

      if (variable) {
        namespaceVariables.add(variable);
      }
    }

    function isTrackedNamespaceIdentifier(node) {
      const scope = sourceCode.getScope
        ? sourceCode.getScope(node)
        : context.getScope();
      const variable = findVariable(scope, node.name);

      return Boolean(variable && namespaceVariables.has(variable));
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== SOURCE) return;

        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier") {
            if (spec.imported && REMOVED_APIS[spec.imported.name]) {
              context.report({
                node: spec,
                messageId: REMOVED_APIS[spec.imported.name],
              });
            }
          } else if (
            spec.type === "ImportDefaultSpecifier" ||
            spec.type === "ImportNamespaceSpecifier"
          ) {
            trackNamespace(spec);
          }
        }
      },

      VariableDeclarator(node) {
        if (!isRequireReactDom(node.init)) return;

        if (node.id.type === "Identifier") {
          trackNamespace(node);
          return;
        }

        if (node.id.type === "ObjectPattern") {
          for (const property of node.id.properties) {
            if (property.type !== "Property" || property.computed) continue;

            const keyName =
              property.key.type === "Identifier"
                ? property.key.name
                : property.key.value;

            if (!REMOVED_APIS[keyName]) continue;
            context.report({ node: property, messageId: REMOVED_APIS[keyName] });
          }
        }
      },

      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier") {
          return;
        }

        const apiName = node.property.name;
        if (!REMOVED_APIS[apiName]) return;

        if (
          node.object.type === "Identifier" &&
          isTrackedNamespaceIdentifier(node.object)
        ) {
          reportApi(node, apiName);
          return;
        }

        if (isRequireReactDom(node.object)) {
          reportApi(node, apiName);
        }
      },
    };
  },
};
