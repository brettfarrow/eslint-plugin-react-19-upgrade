module.exports = {
  meta: {
    type: "problem",
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
    schema: [],
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
                return null;
              }

              const componentDefinition = componentVariable.defs[0].node;
              const componentNode = componentDefinition.init || componentDefinition;

              // Check if it's neither a function component nor a const arrow function
              if (!componentNode || 
                  !(componentNode.type === 'FunctionDeclaration' || 
                    (componentNode.type === 'ArrowFunctionExpression' && 
                     componentNode.params && 
                     componentNode.params.length > 0))) {
                return null; // Return null to indicate that no fix should be attempted
              }

              const fixes = [];

              if (
                componentNode &&
                componentNode.params &&
                componentNode.params[0] &&
                componentNode.params[0].type === "ObjectPattern"
              ) {
                const params = componentNode.params[0];
                const firstProp = params.properties[0];
                const lastProp =
                  params.properties[params.properties.length - 1];

                // Check if props are on multiple lines
                const isMultiline =
                  firstProp.loc.start.line !== lastProp.loc.end.line;

                const newParams = params.properties
                  .map((prop) => {
                    const propName = prop.key.name;
                    const defaultValue = defaultProps[propName]
                      ? ` = ${defaultProps[propName]}`
                      : "";
                    return `${propName}${defaultValue}`;
                  })
                  .join(isMultiline ? ",\n" : ", ");

                const newParamsText = isMultiline
                  ? `{\n${newParams}\n}`
                  : `{ ${newParams} }`;
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

              const semicolonToken = sourceCode.getTokenAfter(node);
              if (
                semicolonToken &&
                semicolonToken.type === "Punctuator" &&
                semicolonToken.value === ";"
              ) {
                fixes.push(fixer.remove(semicolonToken));
              }

              fixes.push(fixer.remove(node));
              return fixes;
            },
          });
        }
      },
    };
  },
};