// rules/no-prop-types.js
module.exports = {
  meta: {
    type: "problem", // It's about potentially incorrect or outdated practices.
    docs: {
      description: "Disallow the use of propTypes in React components",
      // url: "URL-to-documentation" // Provide URL to your rule documentation if available
    },
    messages: {
      propTypesDisallowed:
        "'propTypes' should not be used in '{{name}}' as they are no longer supported in React 19.",
    },
    schema: [], // No configuration options for this rule
    ruleId: "no-prop-types",
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type === "MemberExpression" &&
          node.left.property.name === "propTypes" &&
          node.left.object.type === "Identifier" &&
          /^[A-Z]/.test(node.left.object.name)
        ) {
          // Check if the object name starts with an uppercase letter
          context.report({
            node: node,
            messageId: "propTypesDisallowed",
            data: { name: node.left.object.name },
          });
        }
      },
    };
  },
};
