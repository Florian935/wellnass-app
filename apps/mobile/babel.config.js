// Requis par @powersync/react-native : support des async generators (watched queries).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-async-generator-functions'],
  };
};
