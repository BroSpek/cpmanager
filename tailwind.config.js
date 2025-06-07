/** @type {import('tailwindcss').Config} */
module.exports = {
  // Add 'dark' mode strategy here. This was previously in your index.html
  // but should be part of the build configuration.
  darkMode: "class",
  content: [
    "./index.html", // Scans the main HTML file in the root
    "./js/**/*.js", // Scans all .js files inside the 'js' folder and any sub-folders
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
