import adapter from '@sveltejs/adapter-cloudflare';

const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $lib: 'src/lib'
    }
  }
};

export default config;
