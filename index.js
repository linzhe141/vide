const abortc = new AbortController()

async function main() {
  try {
    abortc.abort()

    // 检查 signal 状态并抛出错误
    if (abortc.signal.aborted) {
      throw new Error('Operation aborted: 123')
    }

    await foo() // 不会执行
  } catch (e) {
    console.log('aaaaaaaaaaaaaaaaaaaaaaaaaafdas', e) // 输出: error Error: Operation aborted: 123
  }
  console.log('end')
}

async function foo() {
  console.log(1)
  await new Promise((resolve) => setTimeout(resolve, 100))
  console.log(2)
}

main()
