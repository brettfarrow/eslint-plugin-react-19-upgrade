function findVariable(scope, name) {
  let currentScope = scope;

  while (currentScope) {
    const variable = currentScope.variables.find((item) => item.name === name);

    if (variable) {
      return variable;
    }

    currentScope = currentScope.upper;
  }

  return null;
}

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

function resolvesToReactCreateFactory(context, node) {
  if (node.callee.type !== "Identifier") {
    return false;
  }

  const sourceCode = context.sourceCode ?? context.getSourceCode();
  const scope = sourceCode.getScope
    ? sourceCode.getScope(node)
    : context.getScope();
  const variable = findVariable(scope, node.callee.name);

  if (!variable || variable.defs.length === 0) {
    return false;
  }

  const definitionNode = variable.defs[0].node;

  if (!definitionNode || definitionNode.type !== "VariableDeclarator") {
    return false;
  }

  if (
    definitionNode.id.type === "Identifier" &&
    isReactCreateFactoryMemberExpression(definitionNode.init)
  ) {
    return true;
  }

  if (
    definitionNode.id.type === "ObjectPattern" &&
    isReactLikeObject(definitionNode.init)
  ) {
    return definitionNode.id.properties.some((property) => {
      if (property.type !== "Property" || property.computed) {
        return false;
      }

      const keyName =
        property.key.type === "Identifier" ? property.key.name : property.key.value;
      const localName =
        property.value.type === "Identifier"
          ? property.value.name
          : property.value.left && property.value.left.type === "Identifier"
            ? property.value.left.name
            : null;

      return keyName === "createFactory" && localName === node.callee.name;
    });
  }

  return false;
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
      CallExpression(node) {
        if (
          isReactCreateFactoryMemberExpression(node.callee) ||
          resolvesToReactCreateFactory(context, node)
        ) {
          context.report({
            node,
            messageId: "noCreateFactory",
          });
        }
      },
    };
  },
};
