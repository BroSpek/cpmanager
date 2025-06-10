// cpmanager/webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    mode: isProduction ? "production" : "development",
    entry: {
      main: "./src/js/main.js",
      sw: "./src/sw.js", // Service worker as its own entry point
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "js/[name].[contenthash].js", // Standard filename for other bundles (like main.js)
      chunkFilename: "js/chunks/[id].[contenthash].js", // For async chunks
      assetModuleFilename: "assets/[name].[contenthash][ext]",
      clean: true, // Clean the output directory before each build
    },
    devServer: {
      static: {
        directory: path.join(__dirname, "dist"),
      },
      compress: true,
      port: 8080,
      hot: true,
      open: true,
      historyApiFallback: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/, // sw.js is handled by its entry point, so no need to exclude here
          use: {
            loader: "swc-loader",
            options: {
              jsc: {
                parser: {
                  ecmaVersion: "es2020",
                  jsx: false,
                },
                target: "es2020",
              },
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  config: path.resolve(__dirname, "postcss.config.js"),
                },
              },
            },
          ],
        },
        {
          test: /\.html$/,
          use: [
            {
              loader: "html-loader",
              options: {
                minimize: isProduction,
                sources: {
                  list: [
                    {
                      tag: "img",
                      attribute: "src",
                      type: "src",
                    },
                    {
                      tag: "link",
                      attribute: "href",
                      type: "src",
                      filter: (tag, attribute, attributes) => {
                        return attributes.rel === "stylesheet";
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif|ico|woff|woff2|eot|ttf|otf)$/i,
          type: "asset/resource",
        },
        {
          test: /\.json$/,
          type: "json",
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: "./src/index.html",
        filename: "index.html",
        inject: "body",
        minify: isProduction
          ? {
              removeComments: true,
              collapseWhitespace: true,
            }
          : false,
        excludeChunks: ["sw"], // Exclude 'sw' from being injected as a script tag
      }),
      new MiniCssExtractPlugin({
        filename: "css/[name].[contenthash].css",
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "src/icons", to: "icons" },
          { from: "src/manifest.json", to: "manifest.json" },
          { from: "src/app-config.json", to: "app-config.json" },
        ],
      }),
      // NEW: Custom plugin to ensure 'sw.js' is output as 'sw.js' at the root
      new (class FixedServiceWorkerOutputPlugin {
        apply(compiler) {
          compiler.hooks.emit.tap(
            "FixedServiceWorkerOutputPlugin",
            (compilation) => {
              const swChunk = compilation.chunks.find(
                (chunk) => chunk.name === "sw",
              );
              if (swChunk) {
                // Find the generated asset for the 'sw' chunk (it will likely have a hash)
                const swAsset = Array.from(swChunk.files).find((file) =>
                  file.endsWith(".js"),
                );
                if (swAsset) {
                  // Rename the asset in the output to 'sw.js'
                  compilation.assets["sw.js"] = compilation.assets[swAsset];
                  delete compilation.assets[swAsset]; // Remove the old hashed asset
                }
              }
            },
          );
        }
      })(),
    ],
    resolve: {
      extensions: [".js", ".css", ".json"],
    },
    optimization: {
      minimize: isProduction,
      // Ensure 'sw' chunk is a single file and not split by others
      splitChunks: {
        cacheGroups: {
          sw: {
            name: "sw",
            test: /[\\/]src[\\/]sw\.js$/, // Match the sw.js source
            chunks: "initial", // Only initial chunks
            enforce: true, // Force it to be a separate chunk
            priority: 100, // High priority
            reuseExistingChunk: false, // Don't reuse existing chunks
            minSize: 0, // Allow even small files to be separate
            maxInitialRequests: 1, // Ensure it's not split into multiple files
          },
        },
        chunks: "all", // Apply splitting to all chunks by default, but 'sw' is handled above
      },
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
  };
};
