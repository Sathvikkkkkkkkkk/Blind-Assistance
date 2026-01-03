export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        app: './index.html', // Ensure index.html is entry
      },
    }
  }
})
