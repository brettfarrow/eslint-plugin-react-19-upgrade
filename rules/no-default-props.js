// rules/no-default-props.js
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Move defaultProps to default function parameters in destructured props",
      // url: "", // TODO: Add docs URL
    },
    fixable: "code", // Allows the rule to be automatically fixed
    schema: [], // No configuration options for this rule
    ruleId: "no-default-props",
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type === "MemberExpression" &&
          node.left.property.name === "defaultProps" &&
          node.left.object.type === "Identifier" &&
          node.right.type === "ObjectExpression"
        ) {
          context.report({
            node,
            message:
              "Move defaultProps to default parameters in the destructured props.",
            fix(fixer) {
              const sourceCode = context.getSourceCode();
              const defaults = node.right.properties
                .map((prop) => {
                  const key = prop.key.name;
                  const value = sourceCode.getText(prop.value);
                  return `${key} = ${value}`;
                })
                .join(", ");

              // Locate the functional component
              const componentDeclaration = sourceCode.ast.body.find(
                (n) =>
                  (n.type === "FunctionDeclaration" ||
                    n.type === "VariableDeclaration") &&
                  n.id &&
                  n.id.name === node.left.object.name,
              );

              if (!componentDeclaration) {
                return null; // Component definition not found
              }

              const componentNode =
                componentDeclaration.type === "VariableDeclaration"
                  ? componentDeclaration.declarations[0].init
                  : componentDeclaration;

              // Assuming the first parameter is destructured
              const params = componentNode.params[0];

              if (params && params.type === "ObjectPattern") {
                const existingDefaults = params.properties.map((prop) => {
                  if (prop.value && prop.value.type === "AssignmentPattern") {
                    return `${prop.key.name} = ${sourceCode.getText(
                      prop.value.right,
                    )}`;
                  }
                  return prop.key.name;
                });

                const newParams = `{ ${existingDefaults.join(
                  ", ",
                )}, ${defaults} }`;
                return fixer.replaceText(params, newParams);
              } else {
                // If there are no parameters or they are not destructured
                const newParams = `{ ${defaults} }`;
                return fixer.insertTextBefore(
                  componentNode.body,
                  `(${newParams}) => `,
                );
              }
            },
          });
        }
      },
    };
  },
};
