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
    return {
      // JSX attribute inside a JSX element
      "JSXAttribute[name.name='ref'][value.type='Literal']"(node) {
        if (typeof node.value.value === "string") {
          context.report({
            node: node,
            messageId: "noStringRefs",
          });
        }
      },
    };
  },
};
