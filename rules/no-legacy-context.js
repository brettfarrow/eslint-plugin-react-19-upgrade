module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the use of legacy context APIs in React components",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-removing-legacy-context",
    },
    messages: {
      noLegacyContext:
        "'{{name}}' uses a legacy context API that is no longer supported in React 19. Use 'React.createContext()' instead.",
      noLegacyContextTypes:
        "'{{name}}' uses a legacy contextTypes API that is no longer supported in React 19. Use 'contextType' instead.",
    },
    schema: [], // No options for this rule
    ruleId: "no-legacy-context",
    hasSuggestions: true,
  },
  create(context) {
    return {
      "ClassDeclaration:exit"(node) {
        node.body.body.forEach((member) => {
          if (member.type === "ClassProperty") {
            if (
              member.key.name === "childContextTypes" ||
              member.key.name === "contextTypes"
            ) {
              context.report({
                node: member,
                message: `'${member.key.name}' uses a legacy context API that is no longer supported in React 19. Use 'contextType' instead.`,
              });
            }
          }
          if (
            member.type === "MethodDefinition" &&
            member.key.name === "getChildContext"
          ) {
            context.report({
              node: member,
              message:
                "'getChildContext' uses a legacy context API that is no longer supported in React 19. Use 'React.createContext()' instead.",
            });
          }
        });
      },
    };
  },
};
