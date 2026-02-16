// ============================================================
// 捨てショ - Expo Config Plugin
// Prebuild 時に native module ファイルを ios/ にコピー
// ============================================================

const {
  withXcodeProject,
  withInfoPlist,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withPhotoSimilarityScanner(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSPhotoLibraryUsageDescription =
      '写真を端末内で解析し、似ている写真を見つけます。外部送信は一切行いません。';
    config.modResults.NSPhotoLibraryAddUsageDescription =
      '写真の整理に必要です。';
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName || 'sutesho';

    const modulesGroup = project.addPbxGroup(
      [],
      'NativeModules',
      'NativeModules'
    );

    const sourceFiles = [
      'PhotoSimilarityScanner.swift',
      'PhotoSimilarityScanner.m',
    ];

    const mainGroupKey = project.getFirstProject().firstProject.mainGroup;

    for (const file of sourceFiles) {
      const filePath = `NativeModules/${file}`;
      if (file.endsWith('.swift')) {
        project.addSourceFile(filePath, {}, modulesGroup.uuid);
      } else {
        project.addSourceFile(filePath, {}, modulesGroup.uuid);
      }
    }

    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key in buildConfigs) {
      const config = buildConfigs[key];
      if (config.buildSettings) {
        config.buildSettings.SWIFT_OBJC_BRIDGING_HEADER =
          `${projectName}/sutesho-Bridging-Header.h`;
      }
    }

    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const iosPath = path.join(config.modRequest.platformProjectRoot);
      const modulesDir = path.join(iosPath, 'NativeModules');
      const projectDir = path.join(
        iosPath,
        config.modRequest.projectName || 'sutesho'
      );

      if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
      }

      // EAS Build では projectRoot/ios/ がアップロードされないことがあるため、
      // プラグイン内の ios-modules を優先してコピーする
      const pluginModulesDir = path.join(__dirname, 'ios-modules');
      const projectModulesDir = path.join(
        config.modRequest.projectRoot,
        'ios',
        'Modules'
      );
      const sourceDir = fs.existsSync(pluginModulesDir)
        ? pluginModulesDir
        : projectModulesDir;

      const files = [
        'PhotoSimilarityScanner.swift',
        'PhotoSimilarityScanner.m',
      ];

      for (const file of files) {
        const src = path.join(sourceDir, file);
        const dest = path.join(modulesDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      const pluginBridging = path.join(__dirname, 'sutesho-Bridging-Header.h');
      const projectBridging = path.join(
        config.modRequest.projectRoot,
        'ios',
        'sutesho-Bridging-Header.h'
      );
      const bridgingSrc = fs.existsSync(pluginBridging)
        ? pluginBridging
        : projectBridging;
      const bridgingDest = path.join(projectDir, 'sutesho-Bridging-Header.h');
      if (fs.existsSync(bridgingSrc)) {
        fs.copyFileSync(bridgingSrc, bridgingDest);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withPhotoSimilarityScanner;
