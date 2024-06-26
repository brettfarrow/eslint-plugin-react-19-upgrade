// index.js
module.exports = {
  rules: {
    "no-default-props": require("./rules/no-default-props"),
    "no-prop-types": require("./rules/no-prop-types"),
    "no-legacy-context": require("./rules/no-legacy-context"),
    "no-string-refs": require("./rules/no-string-refs"),
    "no-factories": require("./rules/no-factories"),
    // equivalent but without the extra dash
    "no-defaultprops": require("./rules/no-default-props"),
    "no-proptypes": require("./rules/no-prop-types"),
  },
};
