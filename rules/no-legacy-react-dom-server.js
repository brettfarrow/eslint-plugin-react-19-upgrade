// rules/no-legacy-react-dom-server.js

const SOURCE = "react-dom/server";

const REMOVED_APIS = {
  renderToNodeStream: "noRenderToNodeStream",
  renderToStaticNodeStream: "noRenderToStaticNodeStream",
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

function isRequireSource(node) {
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
        "Disallow 'renderToNodeStream' and 'renderToStaticNodeStream' from 'react-dom/server' (removed in React 19)",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-deprecations",
    },
    messages: {
      noRenderToNodeStream:
        "'renderToNodeStream' is removed in React 19. Use 'renderToPipeableStream' from 'react-dom/server' (note: different signature).",
      noRenderToStaticNodeStream:
        "'renderToStaticNodeStream' is removed in React 19. Use 'renderToPipeableStream' from 'react-dom/server' (note: different signature).",
    },
    schema: [],
    ruleId: "no-legacy-react-dom-server",
    hasSuggestions: true,
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const namespaceVariables = new Set();

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
            const imported = spec.imported && spec.imported.name;
            const messageId = REMOVED_APIS[imported];
            if (messageId) {
              context.report({ node: spec, messageId });
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
        if (!isRequireSource(node.init)) return;

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

            const messageId = REMOVED_APIS[keyName];
            if (messageId) {
              context.report({ node: property, messageId });
            }
          }
        }
      },

      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier") return;

        const messageId = REMOVED_APIS[node.property.name];
        if (!messageId) return;

        if (
          node.object.type === "Identifier" &&
          isTrackedNamespaceIdentifier(node.object)
        ) {
          context.report({ node, messageId });
          return;
        }

        if (isRequireSource(node.object)) {
          context.report({ node, messageId });
        }
      },
    };
  },
};
