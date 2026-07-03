// rules/no-implicit-ref-callback-return.js

function isAllowedBody(body) {
  if (body.type === "Identifier" && body.name === "undefined") {
    return true;
  }

  if (body.type === "UnaryExpression" && body.operator === "void") {
    return true;
  }

  return false;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow implicit returns in JSX ref callbacks; React 19 treats the returned value as a cleanup function",
      url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide#cleanup-functions-for-refs",
    },
    messages: {
      noImplicitRefCallbackReturn:
        "Ref callbacks must not implicitly return a value; React 19 treats it as a cleanup function. Wrap the body in braces.",
    },
    fixable: "code",
    schema: [],
    ruleId: "no-implicit-ref-callback-return",
    hasSuggestions: true,
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      "JSXAttribute[name.name='ref']"(node) {
        const value = node.value;

        if (
          !value ||
          value.type !== "JSXExpressionContainer" ||
          !value.expression ||
          value.expression.type !== "ArrowFunctionExpression"
        ) {
          return;
        }

        const arrowFn = value.expression;

        if (!arrowFn.expression) {
          return;
        }

        const body = arrowFn.body;

        if (isAllowedBody(body)) {
          return;
        }

        // Comments between the arrow token and the end of the function (but
        // outside the body itself) would be swallowed by the rewrite; report
        // without a fix in that case.
        const hasAdjacentComments = sourceCode
          .getCommentsInside(arrowFn)
          .some(
            (comment) =>
              comment.range[0] < body.range[0] ||
              comment.range[1] > body.range[1],
          );

        context.report({
          node: body,
          messageId: "noImplicitRefCallbackReturn",
          fix: hasAdjacentComments
            ? undefined
            : (fixer) => {
                const arrowToken = sourceCode.getTokenBefore(
                  body,
                  (token) =>
                    token.type === "Punctuator" && token.value === "=>",
                );

                // The replaced range ends at the arrow function's end, which
                // includes any parentheses wrapping the expression body.
                return fixer.replaceTextRange(
                  [arrowToken.range[1], arrowFn.range[1]],
                  ` { ${sourceCode.getText(body)}; }`,
                );
              },
        });
      },
    };
  },
};
