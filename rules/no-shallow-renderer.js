// rules/no-shallow-renderer.js

const SOURCE = "react-test-renderer/shallow";
const REPLACEMENT = "react-shallow-renderer";

function isRequireShallowRenderer(node) {
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

function quoteFromSource(sourceNode) {
  const raw = sourceNode && sourceNode.raw;
  if (typeof raw === "string" && raw.length >= 1) {
    const first = raw[0];
    if (first === "'" || first === '"') return first;
  }
  return '"';
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing 'react-test-renderer/shallow' (removed in React 19); install and import 'react-shallow-renderer' directly",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-deprecations",
    },
    messages: {
      noShallowRenderer:
        "'react-test-renderer/shallow' is removed in React 19. Install 'react-shallow-renderer' and import it directly.",
    },
    fixable: "code",
    schema: [],
    ruleId: "no-shallow-renderer",
    hasSuggestions: true,
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== SOURCE) return;

        const quote = quoteFromSource(node.source);
        context.report({
          node,
          messageId: "noShallowRenderer",
          fix(fixer) {
            return fixer.replaceText(
              node.source,
              `${quote}${REPLACEMENT}${quote}`,
            );
          },
        });
      },

      CallExpression(node) {
        if (!isRequireShallowRenderer(node)) return;

        const sourceNode = node.arguments[0];
        const quote = quoteFromSource(sourceNode);
        context.report({
          node,
          messageId: "noShallowRenderer",
          fix(fixer) {
            return fixer.replaceText(
              sourceNode,
              `${quote}${REPLACEMENT}${quote}`,
            );
          },
        });
      },
    };
  },
};
