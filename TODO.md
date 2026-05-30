- [x] 所有的http:// 或者 https:// （外链，正则匹配）都使用外部浏览器打开
- [x] 完善 electron builder 配置（保持当前基础配置也可以）
- [x] 支持 electron updater（github workflow？）
- [x] 支持 protocol 等electron基础功能
- [x] 支持 workspace 选择（默认在 ~/.vide），当选择了workspace 在workspace下生成.vide目录

  大概思路：在app\src\pages\welcome\index.tsx实现一个 select workspace 的功能，需要复用app\src\components\chat\ChatInput\index.tsx， 所以也可以在app\src\components\chat\ChatInput\index.tsx实现，workspace select的功能，只是这个只在welcome 页面才有这个选项， 已经开启对话的页面就没有这个功能了，表示选择了那个文件夹作为工作目录，如果没选择工作目录，那么所有的artifacts，都在 ~/.vide/artifacts下，并且agent 层不能耦合 electron 层代码

- [x] 支持更多的 buildin skills，都放在~/.vide/skills下面，并且有一个展示页面，design token 在app\index.css
- [x] artifacts 能通过 explorer 快速打开

- [ ] 实现abort 功能，ui 在app\src\components\chat\ChatInput\index.tsx 这里实现一个abort的图标，点击就abort 这个 workflow，并且要给 workflow 加一个abort 的status，并且持久化存储下来，而且现在是mvp阶段，整个 db 数据都能删除，不需要兼容 老数据，并且为这个 abort 加一个 ui， 而且这个abort 的workflow ，我自己任务不需要 发送到llm，需要过滤掉这个 abort workflow的所有message
- [ ] 实现 workflow-wait-human-approve 这个功能，在bash tool 执行前需要human resolve或者reject，并且不能用promise 的机制去实现，而是 agent/core/workflow.ts 的状态机去实现，并且在 app\src\components\chat\ChatInput\index.tsx 是一个 “auto approve” 的快捷设置入口，这是一个workflow级别的设置，不是session级别
- [ ] bash tool 如果启动一个（vite dev）pnpm dev，这种“不会关闭”的进程，也需要考虑，否则会卡住状态机，可以加个参数去区分，llm 只会启动这种进程，而不用太关注结果，而是用户自己观察和反馈
- [ ] app\src\components\chat\messages\UserInputMessage.tsx这个用户输出组件能edit，触发 regenerate功能（这个regenerate已经实现），你只需要实现 edit 的ui，并触发 regenerate ；可以参考app\src\components\chat\SessionActions.tsx
