<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createMarkdownRenderer } from 'vue-mdr'
import { md } from './src/md-demo'

const MarkdownRenderer = createMarkdownRenderer()
const source = ref('')
let index = 0
onMounted(() => {
  window.setInterval(() => {
    const size = 40
    source.value = md.slice(0, index + size)
    index = index + size
  }, 50)
})
</script>

<template>
  <MarkdownRenderer :source="source" theme="light"></MarkdownRenderer>
</template>
