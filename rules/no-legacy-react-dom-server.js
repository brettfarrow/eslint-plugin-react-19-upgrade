// rules/no-legacy-react-dom-server.js

const SOURCE = "react-dom/server";

const REMOVED_APIS = {
  renderToNodeStream: "noRenderToNodeStream",
  renderToStaticNodeStream: "noRenderToStaticNodeStream",
};

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

    function trackNamespace(node) {
      const [variable] = sourceCode.getDeclaredVariables
        ? sourceCode.getDeclaredVariables(node)
        : context.getDeclaredVariables(node);

      if (!variable) return;

      // Check member accesses through the namespace's references rather than
      // resolving scope per MemberExpression; this also catches uses that
      // appear above the declaration.
      for (const { identifier } of variable.references) {
        const parent = identifier.parent;

        if (
          parent &&
          parent.type === "MemberExpression" &&
          parent.object === identifier &&
          !parent.computed &&
          parent.property.type === "Identifier"
        ) {
          const messageId = REMOVED_APIS[parent.property.name];
          if (messageId) {
            context.report({ node: parent, messageId });
          }
        }
      }
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

        if (isRequireSource(node.object)) {
          context.report({ node, messageId });
        }
      },
    };
  },
};
