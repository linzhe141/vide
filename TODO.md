- [x] 所有的http:// 或者 https:// （外链，正则匹配）都使用外部浏览器打开
- [x] 完善 electron builder 配置（保持当前基础配置也可以）
- [x] 支持 electron updater（github workflow？）
- [x] 支持 protocol 等electron基础功能
- [x] 支持 workspace 选择（默认在 ~/.vide），当选择了workspace 在workspace下生成.vide目录

  大概思路：在app\src\pages\welcome\index.tsx实现一个 select workspace 的功能，需要复用app\src\components\chat\ChatInput\index.tsx， 所以也可以在app\src\components\chat\ChatInput\index.tsx实现，workspace select的功能，只是这个只在welcome 页面才有这个选项， 已经开启对话的页面就没有这个功能了，表示选择了那个文件夹作为工作目录，如果没选择工作目录，那么所有的artifacts，都在 ~/.vide/artifacts下，并且agent 层不能耦合 electron 层代码

- [x] 支持更多的 buildin skills，都放在~/.vide/skills下面，并且有一个展示页面，design token 在app\index.css
- [x] artifacts 能通过 explorer 快速打开
