<template>
  <div id="app-root">
    <router-view />
  </div>
</template>

<script setup>
</script>

<style>
html, body, #app-root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  font-family: var(--reader-font-family);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}
</style>
