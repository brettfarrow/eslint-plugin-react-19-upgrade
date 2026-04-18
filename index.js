// index.js
module.exports = {
  rules: {
    "no-default-props": require("./rules/no-default-props"),
    "no-prop-types": require("./rules/no-prop-types"),
    "no-legacy-context": require("./rules/no-legacy-context"),
    "no-string-refs": require("./rules/no-string-refs"),
    "no-factories": require("./rules/no-factories"),
    "no-legacy-react-dom": require("./rules/no-legacy-react-dom"),
    "no-legacy-react-dom-server": require("./rules/no-legacy-react-dom-server"),
    "no-legacy-test-utils-act": require("./rules/no-legacy-test-utils-act"),
    // equivalent but without the extra dash
    "no-defaultprops": require("./rules/no-default-props"),
    "no-proptypes": require("./rules/no-prop-types"),
  },
};
