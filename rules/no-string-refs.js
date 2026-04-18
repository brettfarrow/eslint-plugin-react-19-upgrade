module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the use of string refs in React components",
      recommended: true,
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-string-refs",
    },
    messages: {
      noStringRefs:
        "String refs are deprecated and will be removed in React 19. Use callback refs instead.",
    },
    schema: [], // No options for this rule
    ruleId: "no-string-refs",
    hasSuggestions: true,
  },
  create(context) {
    function report(node) {
      context.report({ node, messageId: "noStringRefs" });
    }

    return {
      "JSXAttribute[name.name='ref']"(node) {
        const value = node.value;

        if (!value) {
          return;
        }

        if (value.type === "Literal" && typeof value.value === "string") {
          report(node);
          return;
        }

        if (
          value.type === "JSXExpressionContainer" &&
          value.expression &&
          value.expression.type === "Literal" &&
          typeof value.expression.value === "string"
        ) {
          report(node);
        }
      },
    };
  },
};
