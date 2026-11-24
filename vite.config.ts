import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  if (command === 'build' && !/^[0-9a-f]{64}$/.test(env.VITE_WALLETA_INVITE_SHA256 ?? '')) {
    throw new Error('Configurá VITE_WALLETA_INVITE_SHA256 antes de compilar Walleta.');
  }
  return { base: './' };
});
