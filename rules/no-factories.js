function isUppercaseName(name) {
  return typeof name === "string" && /^[A-Z]/.test(name);
}

function getEnclosingFunction(node) {
  let current = node.parent;

  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function isLikelyReactModuleFactory(node) {
  const enclosingFunction = getEnclosingFunction(node);

  if (!enclosingFunction) {
    return false;
  }

  if (enclosingFunction.id && isUppercaseName(enclosingFunction.id.name)) {
    return true;
  }

  if (
    enclosingFunction.parent &&
    enclosingFunction.parent.type === "VariableDeclarator" &&
    enclosingFunction.parent.id.type === "Identifier"
  ) {
    return isUppercaseName(enclosingFunction.parent.id.name);
  }

  return false;
}

function isRequireReact(node) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments.length === 1 &&
    node.arguments[0].type === "Literal" &&
    node.arguments[0].value === "react"
  );
}

function isReactLikeObject(node) {
  if (!node) return false;
  if (node.type === "Identifier" && node.name === "React") return true;
  return isRequireReact(node);
}

function isReactCreateFactoryMemberExpression(node) {
  return (
    node &&
    node.type === "MemberExpression" &&
    !node.computed &&
    isReactLikeObject(node.object) &&
    node.property.type === "Identifier" &&
    node.property.name === "createFactory"
  );
}

function getLocalName(property) {
  if (property.value.type === "Identifier") {
    return property.value.name;
  }

  if (property.value.left && property.value.left.type === "Identifier") {
    return property.value.left.name;
  }

  return null;
}

// Local names bound to React.createFactory by this declarator, e.g.
// `const cf = React.createFactory` or `const { createFactory: cf } = React`.
function getCreateFactoryAliasNames(node) {
  const names = new Set();

  if (node.id.type === "Identifier") {
    if (isReactCreateFactoryMemberExpression(node.init)) {
      names.add(node.id.name);
    }
    return names;
  }

  if (node.id.type !== "ObjectPattern" || !isReactLikeObject(node.init)) {
    return names;
  }

  for (const property of node.id.properties) {
    if (property.type !== "Property" || property.computed) continue;

    const keyName =
      property.key.type === "Identifier" ? property.key.name : property.key.value;

    if (keyName === "createFactory") {
      const localName = getLocalName(property);
      if (localName) names.add(localName);
    }
  }

  return names;
}

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
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function getDeclaredVariables(node) {
      return sourceCode.getDeclaredVariables
        ? sourceCode.getDeclaredVariables(node)
        : context.getDeclaredVariables(node);
    }

    return {
      ReturnStatement(node) {
        if (
          node.argument &&
          node.argument.type === "ObjectExpression" &&
          isLikelyReactModuleFactory(node)
        ) {
          const hasRenderMethod = node.argument.properties.some(
            (property) =>
              property.type === "Property" &&
              property.key.type === "Identifier" &&
              property.key.name === "render" &&
              property.value.type === "FunctionExpression",
          );

          if (hasRenderMethod) {
            context.report({
              node,
              messageId: "noModulePattern",
            });
          }
        }
      },
      ImportDeclaration(node) {
        if (node.source.value === "react" && node.specifiers) {
          node.specifiers.forEach((spec) => {
            if (spec.imported && spec.imported.name === "createFactory") {
              context.report({
                node: spec,
                messageId: "noCreateFactory",
              });
            }
          });
        }
      },
      VariableDeclarator(node) {
        const aliasNames = getCreateFactoryAliasNames(node);
        if (aliasNames.size === 0) return;

        // Report calls through the alias from its references, so ordinary
        // calls elsewhere in the file never need a scope lookup.
        for (const variable of getDeclaredVariables(node)) {
          if (!aliasNames.has(variable.name)) continue;

          for (const reference of variable.references) {
            const { identifier } = reference;
            const parent = identifier.parent;

            if (parent && parent.type === "CallExpression" && parent.callee === identifier) {
              context.report({ node: parent, messageId: "noCreateFactory" });
            }
          }
        }
      },
      CallExpression(node) {
        if (isReactCreateFactoryMemberExpression(node.callee)) {
          context.report({
            node,
            messageId: "noCreateFactory",
          });
        }
      },
    };
  },
};
