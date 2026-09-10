const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidSplits(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('splits {')) {
      config.modResults.contents = config.modResults.contents.replace(
        /android\s*\{/,
        `android {
    splits {
        abi {
            reset()
            enable true
            include "armeabi-v7a", "arm64-v8a"
        }
    }`
      );
    }
    return config;
  });
};
