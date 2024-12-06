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
                const keyName = prop.key.name || prop.key.value;
                acc[keyName] = sourceCode.getText(prop.value);
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
              const componentNode =
                componentDefinition.init || componentDefinition;
              const fixes = [];

              if (
                componentNode.type === "FunctionDeclaration" ||
                componentNode.type === "FunctionExpression" ||
                componentNode.type === "ArrowFunctionExpression"
              ) {
                // Handle functional component
                if (
                  componentNode.params &&
                  componentNode.params[0] &&
                  componentNode.params[0].type === "ObjectPattern"
                ) {
                  const params = componentNode.params[0];
                  const properties = params.properties;

                  const existingProps = properties.reduce((acc, prop) => {
                    acc[prop.key.name || prop.key.value] = prop;
                    return acc;
                  }, {});

                  for (const [key, value] of Object.entries(defaultProps)) {
                    if (existingProps[key]) {
                      // Update existing property
                      const prop = existingProps[key];
                      const propText = sourceCode.getText(prop.key);
                      const newPropText = `${propText} = ${value}`;
                      fixes.push(fixer.replaceText(prop, newPropText));
                    } else {
                      // Add new property
                      const newPropText = `${key} = ${value}`;
                      const lastProp = properties[properties.length - 1];
                      fixes.push(
                        fixer.insertTextAfter(lastProp, `, ${newPropText}`),
                      );
                    }
                  }
                } else {
                  // Insert new parameter
                  const newParamsText = `{ ${Object.entries(defaultProps)
                    .map(([key, value]) => `${key} = ${value}`)
                    .join(", ")} }`;
                  if (componentNode.params.length > 0) {
                    fixes.push(
                      fixer.replaceText(componentNode.params[0], newParamsText),
                    );
                  } else {
                    fixes.push(
                      fixer.insertTextBefore(
                        componentNode.body,
                        `(${newParamsText}) => `,
                      ),
                    );
                  }
                }
              } else if (
                componentNode.type === "ClassDeclaration" ||
                componentNode.type === "ClassExpression"
              ) {
                // Handle class component
                const body = componentNode.body.body;
                const renderMethod = body.find(
                  (method) =>
                    method.type === "MethodDefinition" &&
                    method.kind === "method" &&
                    method.key.name === "render",
                );

                if (
                  !renderMethod ||
                  !renderMethod.value ||
                  !renderMethod.value.body
                ) {
                  return null;
                }

                const renderBody = renderMethod.value.body.body;

                // Find existing destructuring of this.props
                let destructuringDeclarator = null;
                for (const statement of renderBody) {
                  if (statement.type === "VariableDeclaration") {
                    for (const declarator of statement.declarations) {
                      if (
                        declarator.init &&
                        declarator.init.type === "MemberExpression" &&
                        declarator.init.object.type === "ThisExpression" &&
                        declarator.init.property.name === "props" &&
                        declarator.id.type === "ObjectPattern"
                      ) {
                        destructuringDeclarator = declarator;
                        break;
                      }
                    }
                    if (destructuringDeclarator) {
                      break;
                    }
                  }
                }

                if (destructuringDeclarator) {
                  // Modify existing destructuring
                  const properties = destructuringDeclarator.id.properties;
                  const existingProps = properties.reduce((acc, prop) => {
                    acc[prop.key.name || prop.key.value] = prop;
                    return acc;
                  }, {});

                  for (const [key, value] of Object.entries(defaultProps)) {
                    if (existingProps[key]) {
                      // Update existing property
                      const prop = existingProps[key];
                      const propText = sourceCode.getText(prop.key);
                      const newPropText = `${propText} = ${value}`;
                      fixes.push(fixer.replaceText(prop, newPropText));
                    } else {
                      // Add new property
                      const newPropText = `${key} = ${value}`;
                      const lastProp = properties[properties.length - 1];
                      fixes.push(
                        fixer.insertTextAfter(lastProp, `, ${newPropText}`),
                      );
                    }
                  }
                } else {
                  // Insert new destructuring
                  const newDestructuringText = `const { ${Object.entries(
                    defaultProps,
                  )
                    .map(([key, value]) => `${key} = ${value}`)
                    .join(", ")} } = this.props;`;
                  const firstStatement = renderBody[0];
                  if (firstStatement) {
                    fixes.push(
                      fixer.insertTextBefore(
                        firstStatement,
                        `${newDestructuringText}\n`,
                      ),
                    );
                  } else {
                    fixes.push(
                      fixer.insertTextAfter(
                        renderMethod.value.body.openingBrace,
                        `\n${newDestructuringText}\n`,
                      ),
                    );
                  }
                }
              } else {
                // Component type not recognized
                return null;
              }

              // Remove the defaultProps assignment
              fixes.push(fixer.remove(node));

              // Remove semicolon if necessary
              const semicolonToken = sourceCode.getTokenAfter(node);
              if (
                semicolonToken &&
                semicolonToken.type === "Punctuator" &&
                semicolonToken.value === ";"
              ) {
                fixes.push(fixer.remove(semicolonToken));
              }

              return fixes;
            },
          });
        }
      },
    };
  },
};
