// rules/no-prop-types.js
module.exports = {
  meta: {
    type: "problem", // It's about potentially incorrect or outdated practices.
    docs: {
      description: "Disallow the use of propTypes in React components",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-proptypes-and-defaultprops",
    },
    messages: {
      propTypesDisallowed:
        "'propTypes' should not be used in '{{name}}' as they are no longer supported in React 19.",
      propTypesImportDisallowed:
        "'prop-types' should not be imported in '{{name}}' as they are no longer supported in React 19.",
    },
    schema: [], // No configuration options for this rule
    ruleId: "no-prop-types",
    hasSuggestions: true,
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "prop-types") {
          node.specifiers.forEach((specifier) => {
            if (specifier.local && specifier.local.name === "PropTypes") {
              const filename = context.filename ?? context.getFilename();
              const name = filename
                .split("/") // unix file paths
                .pop()
                .split("\\") // windows file paths
                .pop()
                .split(".")[0]; // remove extension
              context.report({
                node: specifier,
                messageId: "propTypesImportDisallowed",
                data: {
                  name,
                },
              });
            }
          });
        }
      },
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
