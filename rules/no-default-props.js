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

function getComponentNode(context, assignmentNode, identifierName, seen = new Set()) {
  if (seen.has(identifierName)) {
    return null;
  }

  seen.add(identifierName);

  const sourceCode = context.sourceCode ?? context.getSourceCode();
  const scope = sourceCode.getScope
    ? sourceCode.getScope(assignmentNode)
    : context.getScope();
  const variable = findVariable(scope, identifierName);

  if (!variable || variable.defs.length === 0) {
    return null;
  }

  const definition = variable.defs[0];
  const definitionNode = definition.node;

  if (!definitionNode) {
    return null;
  }

  if (definitionNode.type === "VariableDeclarator") {
    if (!definitionNode.init) {
      return null;
    }

    if (definitionNode.init.type === "Identifier") {
      return getComponentNode(
        context,
        assignmentNode,
        definitionNode.init.name,
        seen,
      );
    }

    return definitionNode.init;
  }

  return definitionNode;
}

function isFunctionComponentNode(node) {
  return (
    node &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression")
  );
}

function isClassComponentNode(node) {
  return node && (node.type === "ClassDeclaration" || node.type === "ClassExpression");
}

function isSafeProperty(node) {
  return node.type === "Property" && !node.computed && node.kind === "init";
}

function getPropertyKeyName(node) {
  if (!isSafeProperty(node)) {
    return null;
  }

  if (node.key.type === "Identifier") {
    return node.key.name;
  }

  if (node.key.type === "Literal") {
    return String(node.key.value);
  }

  return null;
}

function getDefaultPropsMap(node, sourceCode) {
  const defaultProps = {};

  for (const property of node.right.properties) {
    const keyName = getPropertyKeyName(property);

    if (!keyName) {
      return null;
    }

    defaultProps[keyName] = sourceCode.getText(property.value);
  }

  return defaultProps;
}

function buildPropertyText(property, defaultValue, sourceCode) {
  if (!isSafeProperty(property)) {
    return null;
  }

  const keyText = sourceCode.getText(property.key);
  const value = property.value;

  if (value.type === "AssignmentPattern") {
    return sourceCode.getText(property);
  }

  if (property.shorthand && value.type === "Identifier") {
    return `${keyText} = ${defaultValue}`;
  }

  if (value.type === "Identifier") {
    return `${keyText}: ${sourceCode.getText(value)} = ${defaultValue}`;
  }

  return null;
}

function isValidIdentifierName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

function buildObjectPatternText(pattern, defaultProps, sourceCode) {
  const existingKeys = new Set();
  const propertyTexts = [];
  let restIndex = null;

  for (const property of pattern.properties) {
    if (property.type === "RestElement") {
      restIndex = propertyTexts.length;
      propertyTexts.push(sourceCode.getText(property));
      continue;
    }

    const keyName = getPropertyKeyName(property);

    if (!keyName) {
      return null;
    }

    existingKeys.add(keyName);

    if (Object.hasOwn(defaultProps, keyName)) {
      const propertyText = buildPropertyText(
        property,
        defaultProps[keyName],
        sourceCode,
      );

      if (!propertyText) {
        return null;
      }

      propertyTexts.push(propertyText);
      continue;
    }

    propertyTexts.push(sourceCode.getText(property));
  }

  const missingProps = Object.entries(defaultProps)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => {
      if (!isValidIdentifierName(key)) {
        return null;
      }

      return `${key} = ${value}`;
    });

  if (missingProps.some((property) => property === null)) {
    return null;
  }

  if (missingProps.length > 0) {
    const insertIndex = restIndex ?? propertyTexts.length;
    propertyTexts.splice(insertIndex, 0, ...missingProps);
  }

  return `{ ${propertyTexts.join(", ")} }`;
}

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
    fixable: "code",
    schema: [],
    ruleId: "no-default-props",
    hasSuggestions: true,
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type !== "MemberExpression" ||
          node.left.property.name !== "defaultProps" ||
          node.left.object.type !== "Identifier" ||
          node.right.type !== "ObjectExpression"
        ) {
          return;
        }

        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const defaultProps = getDefaultPropsMap(node, sourceCode);
        const componentNode = getComponentNode(
          context,
          node,
          node.left.object.name,
        );

        if (isClassComponentNode(componentNode)) {
          return;
        }

        context.report({
          node,
          messageId: "defaultPropsDisallowed",
          data: { name: node.left.object.name },
          fix(fixer) {
            if (!defaultProps || !isFunctionComponentNode(componentNode)) {
              return null;
            }

            if (
              componentNode.params.length !== 1 ||
              !componentNode.params[0] ||
              componentNode.params[0].type !== "ObjectPattern"
            ) {
              return null;
            }

            const paramsText = buildObjectPatternText(
              componentNode.params[0],
              defaultProps,
              sourceCode,
            );

            if (!paramsText) {
              return null;
            }

            const targetNode =
              node.parent && node.parent.type === "ExpressionStatement"
                ? node.parent
                : node;

            return [
              fixer.replaceText(componentNode.params[0], paramsText),
              fixer.remove(targetNode),
            ];
          },
        });
      },
    };
  },
};
