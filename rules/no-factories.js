module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow module pattern factories and React.createFactory",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-module-pattern-factories",
    },
    messages: {
      noModulePattern:
        "Module pattern factories are removed in React 19. Use regular functions instead.",
      noCreateFactory:
        "React.createFactory is removed in React 19. Use JSX instead.",
    },
    schema: [],
    ruleId: "no-factories",
    hasSuggestions: true,
  },
  create(context) {
    return {
      // Match function returns object with a render method
      ReturnStatement: function (node) {
        if (node.argument && node.argument.type === "ObjectExpression") {
          const hasRenderMethod = node.argument.properties.some(
            (prop) =>
              prop.type === "Property" &&
              prop.key.name === "render" &&
              prop.value.type === "FunctionExpression",
          );
          if (hasRenderMethod) {
            context.report({
              node,
              messageId: "noModulePattern",
            });
          }
        }
      },
      // Match import or require of React.createFactory
      "ImportDeclaration[source.value='react'], VariableDeclarator[init.callee.name='require'][init.arguments.0.value='react']"(
        node,
      ) {
        node.specifiers.forEach((spec) => {
          if (spec.imported && spec.imported.name === "createFactory") {
            context.report({
              node: spec,
              messageId: "noCreateFactory",
            });
          }
        });
      },
      "CallExpression[callee.object.name='React'][callee.property.name='createFactory']"(
        node,
      ) {
        context.report({
          node,
          messageId: "noCreateFactory",
        });
      },
    };
  },
};
