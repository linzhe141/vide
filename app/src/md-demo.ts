export const md = `
\`\`\`vue
<script setup>
import { ref, computed, onClickOutside } from 'vue'

const props = defineProps({
  modelValue: [String, Number],
  options: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)

const selectedLabel = computed(() =>
  props.options.find(o => o.value === props.modelValue)?.label ?? '请选择'
)

function select(option) {
  emit('update:modelValue', option.value)
  open.value = false
}

onClickOutside(root, () => (open.value = false))
</script>

<template>
  <div ref="root" class="select">
    <div class="select-trigger" @click="open = !open">
      {{ selectedLabel }}
    </div>

    <ul v-if="open" class="select-menu">
      <li
        v-for="opt in options"
        :key="opt.value"
        @click="select(opt)"
        class="select-item"
      >
        {{ opt.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.select { position: relative; width: 160px; }
.select-trigger {
  padding: 6px 10px;
  border: 1px solid #ccc;
  cursor: pointer;
}
.select-menu {
  position: absolute;
  width: 100%;
  border: 1px solid #ccc;
  background: #fff;
}
.select-item {
  padding: 6px 10px;
}
.select-item:hover {
  background: #f5f5f5;
}
</style>
\`\`\`

`
