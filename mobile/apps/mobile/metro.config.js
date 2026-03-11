const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Racine du monorepo
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Support monorepo: surveiller packages/ et node_modules racine
config.watchFolders = [monorepoRoot];

// Résoudre les modules depuis la racine ET depuis l'app
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
