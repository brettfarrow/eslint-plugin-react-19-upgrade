// rules/no-legacy-test-utils.js

const SOURCE = "react-dom/test-utils";

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

function importedName(spec) {
  if (!spec.imported) return null;
  return spec.imported.name ?? spec.imported.value;
}

function specifierToText(spec) {
  if (spec.type !== "ImportSpecifier") return null;
  if (spec.local.name === importedName(spec)) {
    return importedName(spec);
  }
  return `${importedName(spec)} as ${spec.local.name}`;
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
        "Disallow importing from 'react-dom/test-utils' (removed in React 19); import 'act' from 'react' and use '@testing-library/react' for other utilities",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-deprecations",
    },
    messages: {
      noTestUtilsAct:
        "'act' must be imported from 'react' in React 19, not 'react-dom/test-utils'.",
      noTestUtilsRemoved:
        "'{{name}}' from 'react-dom/test-utils' is removed in React 19. Use '@testing-library/react' or another modern testing utility instead.",
      noTestUtilsModule:
        "'react-dom/test-utils' is removed in React 19. Import 'act' from 'react'; use '@testing-library/react' for other utilities.",
    },
    fixable: "code",
    schema: [],
    ruleId: "no-legacy-test-utils",
    hasSuggestions: true,
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== SOURCE) return;

        if (node.specifiers.length === 0) {
          context.report({ node, messageId: "noTestUtilsModule" });
          return;
        }

        const actSpecs = [];
        const otherSpecs = [];

        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier" && importedName(spec) === "act") {
            actSpecs.push(spec);
          } else {
            otherSpecs.push(spec);
            if (spec.type === "ImportSpecifier") {
              context.report({
                node: spec,
                messageId: "noTestUtilsRemoved",
                data: { name: importedName(spec) },
              });
            } else {
              context.report({ node: spec, messageId: "noTestUtilsModule" });
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
        if (!isRequireTestUtils(node.init)) return;

        if (node.id.type === "Identifier") {
          context.report({ node, messageId: "noTestUtilsModule" });
          return;
        }

        if (node.id.type === "ObjectPattern") {
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
            } else {
              context.report({
                node: property,
                messageId: "noTestUtilsRemoved",
                data: { name: keyName },
              });
            }
          }
        }
      },

      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier") {
          return;
        }

        if (!isRequireTestUtils(node.object)) return;

        if (node.property.name === "act") {
          context.report({ node, messageId: "noTestUtilsAct" });
        } else {
          context.report({
            node,
            messageId: "noTestUtilsRemoved",
            data: { name: node.property.name },
          });
        }
      },
    };
  },
};
