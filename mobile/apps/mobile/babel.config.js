module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Activer la transformation des require.context et env vars pour expo-router
          // @see https://docs.expo.dev/router/installation/
          lazyImports: true,
        },
      ],
    ],
  };
};
