const { withGradleProperties } = require("expo/config-plugins");

// Release builds compile native code for every ABI by default; react-native-reanimated fails to build
// armeabi-v7a on Windows (ninja loops on re-running CMake). The phone is arm64-v8a, so build only that.
// ponytail: add the other ABIs back if the app ever has to run on a 32-bit or x86 device.
module.exports = (config) =>
  withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => p.key !== "reactNativeArchitectures");
    c.modResults.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
    return c;
  });
