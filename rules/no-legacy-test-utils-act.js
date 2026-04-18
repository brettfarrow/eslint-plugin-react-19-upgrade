// rules/no-legacy-test-utils-act.js

const SOURCE = "react-dom/test-utils";

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

function isRequireTestUtils(node) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments.length === 1 &&
    node.arguments[0].type === "Literal" &&
    node.arguments[0].value === SOURCE
  );
}

function specifierToText(spec) {
  if (spec.type !== "ImportSpecifier") return null;
  if (spec.local.name === spec.imported.name) {
    return spec.imported.name;
  }
  return `${spec.imported.name} as ${spec.local.name}`;
}

function rebuildImport(specs, source, quote) {
  const defaults = specs.filter((s) => s.type === "ImportDefaultSpecifier");
  const namespaces = specs.filter((s) => s.type === "ImportNamespaceSpecifier");
  const named = specs.filter((s) => s.type === "ImportSpecifier");

  const parts = [];
  if (defaults.length) parts.push(defaults[0].local.name);
  if (namespaces.length) parts.push(`* as ${namespaces[0].local.name}`);
  if (named.length) {
    parts.push(`{ ${named.map(specifierToText).join(", ")} }`);
  }

  return `import ${parts.join(", ")} from ${quote}${source}${quote};`;
}

function quoteFromSource(sourceNode) {
  const raw = sourceNode && sourceNode.raw;
  if (typeof raw === "string" && raw.length >= 1) {
    const first = raw[0];
    if (first === "'" || first === '"') return first;
  }
  return '"';
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing 'act' from 'react-dom/test-utils'; import it from 'react' instead",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-deprecations",
    },
    messages: {
      noTestUtilsAct:
        "'act' must be imported from 'react' in React 19, not 'react-dom/test-utils'.",
    },
    fixable: "code",
    schema: [],
    ruleId: "no-legacy-test-utils-act",
    hasSuggestions: true,
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const testUtilsNamespaceVariables = new Set();

    function trackNamespace(node) {
      const [variable] = sourceCode.getDeclaredVariables(node);

      if (variable) {
        testUtilsNamespaceVariables.add(variable);
      }
    }

    function isTrackedNamespaceIdentifier(node) {
      const scope = sourceCode.getScope
        ? sourceCode.getScope(node)
        : context.getScope();
      const variable = findVariable(scope, node.name);

      return Boolean(variable && testUtilsNamespaceVariables.has(variable));
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== SOURCE) return;

        const actSpecs = [];
        const otherSpecs = [];

        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported &&
            spec.imported.name === "act"
          ) {
            actSpecs.push(spec);
          } else {
            otherSpecs.push(spec);
            if (
              spec.type === "ImportDefaultSpecifier" ||
              spec.type === "ImportNamespaceSpecifier"
            ) {
              trackNamespace(spec);
            }
          }
        }

        if (actSpecs.length === 0) return;

        const quote = quoteFromSource(node.source);
        const actText = actSpecs.map(specifierToText).join(", ");
        const newReactImport = `import { ${actText} } from ${quote}react${quote};`;

        const reportTarget = actSpecs.length === 1 ? actSpecs[0] : node;

        context.report({
          node: reportTarget,
          messageId: "noTestUtilsAct",
          fix(fixer) {
            if (otherSpecs.length === 0) {
              return fixer.replaceText(node, newReactImport);
            }
            const rebuilt = rebuildImport(otherSpecs, SOURCE, quote);
            return fixer.replaceText(node, `${newReactImport}\n${rebuilt}`);
          },
        });
      },

      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          isRequireTestUtils(node.init)
        ) {
          trackNamespace(node);
          return;
        }

        if (
          node.id.type === "ObjectPattern" &&
          isRequireTestUtils(node.init)
        ) {
          for (const property of node.id.properties) {
            if (property.type !== "Property" || property.computed) continue;

            const keyName =
              property.key.type === "Identifier"
                ? property.key.name
                : property.key.value;

            if (keyName === "act") {
              context.report({
                node: property,
                messageId: "noTestUtilsAct",
              });
            }
          }
        }
      },

      MemberExpression(node) {
        if (
          node.computed ||
          node.property.type !== "Identifier" ||
          node.property.name !== "act"
        ) {
          return;
        }

        if (
          node.object.type === "Identifier" &&
          isTrackedNamespaceIdentifier(node.object)
        ) {
          context.report({ node, messageId: "noTestUtilsAct" });
          return;
        }

        if (isRequireTestUtils(node.object)) {
          context.report({ node, messageId: "noTestUtilsAct" });
        }
      },
    };
  },
};
