// rules/no-legacy-react-is.js

const SOURCE = "react-is";

const REMOVED_APIS = {
  isConcurrentMode: "noIsConcurrentMode",
  isAsyncMode: "noIsAsyncMode",
};

function isRequireReactIs(node) {
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
        "Disallow 'isConcurrentMode' and 'isAsyncMode' from 'react-is' (removed in React 19)",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-deprecations",
    },
    messages: {
      noIsConcurrentMode:
        "'isConcurrentMode' from 'react-is' is removed in React 19 without a replacement.",
      noIsAsyncMode:
        "'isAsyncMode' from 'react-is' is removed in React 19 without a replacement.",
    },
    schema: [],
    ruleId: "no-legacy-react-is",
    hasSuggestions: true,
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function reportApi(node, apiName) {
      const messageId = REMOVED_APIS[apiName];
      if (!messageId) return;
      context.report({ node, messageId });
    }

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
          reportApi(parent, parent.property.name);
        }
      }
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
        if (!isRequireReactIs(node.init)) return;

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

        if (isRequireReactIs(node.object)) {
          reportApi(node, apiName);
        }
      },
    };
  },
};
