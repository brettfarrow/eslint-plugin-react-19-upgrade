// rules/no-prop-types.js

function getFilenameBase(context) {
  const filename = context.filename ?? context.getFilename();
  return filename
    .split("/")
    .pop()
    .split("\\")
    .pop()
    .split(".")[0];
}

function getEnclosingClassName(node) {
  let current = node.parent;

  while (current) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") {
      if (current.id && current.id.type === "Identifier") {
        return current.id.name;
      }

      if (
        current.parent &&
        current.parent.type === "VariableDeclarator" &&
        current.parent.id.type === "Identifier"
      ) {
        return current.parent.id.name;
      }

      return "<anonymous>";
    }

    current = current.parent;
  }

  return "<anonymous>";
}

function isPropTypesKey(key) {
  if (!key) return false;
  if (key.type === "Identifier") return key.name === "propTypes";
  if (key.type === "Literal") return key.value === "propTypes";
  return false;
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow the use of propTypes in React components",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-proptypes-and-defaultprops",
    },
    messages: {
      propTypesDisallowed:
        "'propTypes' should not be used in '{{name}}' as they are no longer supported in React 19.",
      propTypesImportDisallowed:
        "'prop-types' should not be imported in '{{name}}' as they are no longer supported in React 19.",
    },
    schema: [],
    ruleId: "no-prop-types",
    hasSuggestions: true,
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "prop-types") {
          const name = getFilenameBase(context);
          node.specifiers.forEach((specifier) => {
            context.report({
              node: specifier,
              messageId: "propTypesImportDisallowed",
              data: { name },
            });
          });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length === 1 &&
          node.arguments[0].type === "Literal" &&
          node.arguments[0].value === "prop-types"
        ) {
          context.report({
            node,
            messageId: "propTypesImportDisallowed",
            data: { name: getFilenameBase(context) },
          });
        }
      },
      AssignmentExpression(node) {
        if (
          node.left.type === "MemberExpression" &&
          !node.left.computed &&
          node.left.property.name === "propTypes" &&
          node.left.object.type === "Identifier" &&
          /^[A-Z]/.test(node.left.object.name)
        ) {
          context.report({
            node,
            messageId: "propTypesDisallowed",
            data: { name: node.left.object.name },
          });
        }
      },
      "ClassBody > PropertyDefinition, ClassBody > ClassProperty"(node) {
        if (node.static && !node.computed && isPropTypesKey(node.key)) {
          context.report({
            node,
            messageId: "propTypesDisallowed",
            data: { name: getEnclosingClassName(node) },
          });
        }
      },
    };
  },
};
