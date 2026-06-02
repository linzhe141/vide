.vide\skills\anthropics-skills-pptx\SKILL.md
该skill里面对应的js和python相关依赖已经安装完毕，当生成的ppt需要js脚本时，可以将其拆分esm模块(必须是es module代码)防止上下文太短导致中断，并且每个js脚本不超过300行

我要去川西给我几个推荐，然后根据我所选择的，输出一个ppt文件,大概6页内容，最好支持图片

.vide\skills\anthropics-skills-pptx\SKILL.md
该skill里面对应的js和python相关依赖已经安装完毕，当生成的ppt需要js脚本时，可以将其拆分esm模块(必须是es module代码)防止上下文太短导致中断，并且每个js脚本不超过300行

再根据这个plan的内容再，输出一个ppt文件,大概6页内容，最好支持图片

this is your runtime workflow code `agent\core\workflow.ts`, basic on this code need to generate a pptx file with 7 pages

给我三个选项， only for testing

输出一个plan 大概三个step,然后依次自动执行这几个mock plan step，并mock几个输出的文本，only for test

使用BUILDIN_ARTIFACT_NAMESPACE_CREATE_WORKSPACE，在这个workspace下面传教一个vue v-for的示例代码(sfc + setup + ts)，大概30行

你先从 react重复渲染的角度去分析，我哪里有问题，是不是太多额外的重新渲染了,首先是这个文件
是不是要加useMemo useCall 等去优化，memo组件，还要解释为什么又重新渲染了，不要考虑代码高亮的耗时，分析后要给我优化后完整的代码 ，只分析react代码

创建一个pptx文件，一共有7页，每一页就主标题和副标题，js代码用esm，然后一共有7个文件依次slide1.mjs~slide7.mjs和一个index.mjs去整合，用于生成pptx文件的main入口，整个过程不需要安装npm package！
