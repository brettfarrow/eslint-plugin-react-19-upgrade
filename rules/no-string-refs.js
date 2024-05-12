module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the use of string refs in React components",
      category: "Best Practices",
      recommended: true,
      url: "https://reactjs.org/docs/refs-and-the-dom.html#creating-refs",
    },
    messages: {
      noStringRefs:
        "String refs are deprecated and will be removed in React 19. Use callback refs instead.",
    },
    schema: [], // No options for this rule
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
