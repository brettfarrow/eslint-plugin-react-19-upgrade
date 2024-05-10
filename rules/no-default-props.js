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
        // Ensure that this assignment is for defaultProps of a component
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
              const defaultProps = node.right.properties.reduce((acc, prop) => {
                acc[prop.key.name] = sourceCode.getText(prop.value);
                return acc;
              }, {});

              // Locate the variable declaration of the component
              const componentVariable = context
                .getScope()
                .variables.find((v) => v.name === node.left.object.name);

              if (!componentVariable || componentVariable.defs.length === 0) {
                return null; // Component definition not found
              }

              const componentDefinition = componentVariable.defs[0].node;
              const componentNode =
                componentDefinition.init || componentDefinition;

              // Prepare fixes to replace function parameters and remove defaultProps
              const fixes = [];

              if (
                componentNode &&
                componentNode.params &&
                componentNode.params[0] &&
                componentNode.params[0].type === "ObjectPattern"
              ) {
                const params = componentNode.params[0];
                const existingParams = params.properties
                  .map((prop) => {
                    const propName = prop.key.name;
                    if (prop.value && prop.value.type === "AssignmentPattern") {
                      // Leave existing defaults as is
                      return `${propName} = ${sourceCode.getText(
                        prop.value.right,
                      )}`;
                    } else if (defaultProps[propName]) {
                      // Add default from defaultProps
                      return `${propName} = ${defaultProps[propName]}`;
                    }
                    return propName; // No default to add
                  })
                  .join(", ");

                const newParamsText = `{ ${existingParams} }`;
                fixes.push(fixer.replaceText(params, newParamsText));
              } else {
                // If no parameters, create new destructured object with defaults
                const newParams = Object.entries(defaultProps)
                  .map(([key, value]) => `${key} = ${value}`)
                  .join(", ");
                const newParamsText = `{ ${newParams} }`;
                fixes.push(
                  fixer.insertTextBefore(
                    componentNode.body,
                    `(${newParamsText}) => `,
                  ),
                );
              }

              // Remove the defaultProps assignment more cleanly
              const start = node.range[0];
              const end = sourceCode.getTokenAfter(node).range[1];
              fixes.push(fixer.removeRange([start, end]));

              return fixes;
            },
          });
        }
      },
    };
  },
};
