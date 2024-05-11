// rules/no-default-props.js
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Move defaultProps to default function parameters in destructured props",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-proptypes-and-defaultprops",
    },
    messages: {
      defaultPropsDisallowed:
        "'defaultProps' should not be used in '{{name}}' as they are no longer supported in React 19. Use default parameters instead.",
    },
    fixable: "code", // Allows the rule to be automatically fixed
    schema: [], // No configuration options for this rule
    ruleId: "no-default-props",
    hasSuggestions: true,
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
            messageId: "defaultPropsDisallowed",
            data: { name: node.left.object.name },
            fix(fixer) {
              const sourceCode = context.sourceCode ?? context.getSourceCode();
              const defaultProps = node.right.properties.reduce((acc, prop) => {
                acc[prop.key.name] = sourceCode.getText(prop.value);
                return acc;
              }, {});

              // Locate the variable declaration of the component
              const scope = sourceCode.getScope
                ? sourceCode.getScope(node)
                : context.getScope();
              const componentVariable = scope.variables.find(
                (v) => v.name === node.left.object.name,
              );

              if (!componentVariable || componentVariable.defs.length === 0) {
                return null; // Component definition not found
              }

              const componentDefinition = componentVariable.defs[0].node;
              const componentNode =
                componentDefinition.init || componentDefinition;

              const fixes = [];

              // Update or create function parameters with defaults
              if (
                componentNode &&
                componentNode.params &&
                componentNode.params[0] &&
                componentNode.params[0].type === "ObjectPattern"
              ) {
                const params = componentNode.params[0];
                const newParams = params.properties
                  .map((prop) => {
                    const propName = prop.key.name;
                    const defaultValue = defaultProps[propName]
                      ? ` = ${defaultProps[propName]}`
                      : "";
                    return `${propName}${defaultValue}`;
                  })
                  .join(", ");
                const newParamsText = `{ ${newParams} }`;
                fixes.push(fixer.replaceText(params, newParamsText));
              } else {
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

              // Conditionally remove semicolon after defaultProps
              const semicolonToken = sourceCode.getTokenAfter(node);
              if (
                semicolonToken &&
                semicolonToken.type === "Punctuator" &&
                semicolonToken.value === ";"
              ) {
                fixes.push(fixer.remove(semicolonToken));
              }

              // Remove the defaultProps assignment
              fixes.push(fixer.remove(node));

              return fixes;
            },
          });
        }
      },
    };
  },
};
