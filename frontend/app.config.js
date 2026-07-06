/**
 * Dynamic app config. Reads `app.json` as the base and overrides a few
 * fields based on the EAS build profile (passed via env var APP_VARIANT).
 *
 * Profiles:
 *  - "development" → side-by-side dev client APK with its own name, icon,
 *    and android.package, so it can coexist on-device with the preview build
 *  - anything else (preview / production / undefined) → use the base config
 *
 * To add a new variant: extend the `variants` map below.
 */

const variants = {
  development: {
    name: 'InvaderHunter Dev',
    androidPackage: 'com.invaderhunter.app.dev',
    icon: './assets/images/InvaderHunterIcon-dev.png',
  },
  staging: {
    name: 'InvaderHunter Stag',
    androidPackage: 'com.invaderhunter.app.stag',
    icon: './assets/images/InvaderHunterIcon-stag.png',
  },
};

module.exports = ({ config }) => {
  const variantKey = process.env.APP_VARIANT;
  const variant = variantKey ? variants[variantKey] : null;
  if (!variant) return config;

  return {
    ...config,
    name: variant.name,
    icon: variant.icon,
    android: {
      ...(config.android ?? {}),
      package: variant.androidPackage,
      icon: variant.icon,
      adaptiveIcon: {
        ...(config.android?.adaptiveIcon ?? {}),
        foregroundImage: variant.icon,
      },
    },
  };
};
