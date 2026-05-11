module.exports = {
  apps: [
    {
      name: "gpt-image-studio",
      cwd: "/Users/bahe/Desktop/Private/AI中台/gpt-image-studio",
      script: "node_modules/.bin/next",
      args: "start -p 9827",
      env: {
        NODE_ENV: "production",
        PORT: "9827",
      },
    },
  ],
};
