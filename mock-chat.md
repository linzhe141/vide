# Mock Chat Data (Example)

This is a concrete example of rows that would be stored for a single session that uses a planner and an ask-user question.

**Scenario**
User asks: "帮我写一个 TODO App 的需求拆解". The agent creates a plan, runs step 1, and then asks the user a clarifying question.

## threads

| id | title | created_at | updated_at |
| --- | --- | --- | --- |
| `sess_1` | `TODO App 需求拆解` | `1742131200000` | `1742131230000` |

## workflow_blocks

| id | session_id | input | status | created_at | finished_at | active_plan_id | active_question_id | runtime_snapshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `wf_1` | `sess_1` | `帮我写一个 TODO App 的需求拆解` | `running` | `1742131205000` |  | `plan_1` | `q_1` | `{"isStreaming":false,"streamingReason":false,"streamingText":false,"runningToolId":null,"waitingHuman":true}` |

## messages

| id | block_id | role | content | payload | created_at |
| --- | --- | --- | --- | --- | --- |
| `m_1` | `wf_1` | `user` | `帮我写一个 TODO App 的需求拆解` |  | `1742131205000` |
| `m_2` | `wf_1` | `assistant-text` | `好的，我先给一个拆解计划。` |  | `1742131207000` |
| `m_3` | `wf_1` | `tool-call` |  | `{"tool_calls":[{"id":"tc_1","type":"function","function":{"name":"BUILDIN_PLANNER_NAMESPACE_START_PLAN_GENERATE","arguments":"{}"}}]}` | `1742131207500` |
| `m_4` | `wf_1` | `tool-result` |  | `{"toolCallId":"tc_1","result":{"content":"Has marked plan is generating"}}` | `1742131207600` |
| `m_5` | `wf_1` | `assistant-text` | `计划已生成，开始执行第 1 步。` |  | `1742131208000` |
| `m_6` | `wf_1` | `tool-call` |  | `{"tool_calls":[{"id":"tc_2","type":"function","function":{"name":"BUILDIN_ASK_USER_NAMESPACE_START_GENERATE","arguments":"{\"type\":\"single\"}"}}]}` | `1742131209000` |
| `m_7` | `wf_1` | `tool-result` |  | `{"toolCallId":"tc_2","result":{"content":"Started generating ask user question"}}` | `1742131209100` |

## plans

| id | session_id | block_id | status | created_at | updated_at |
| --- | --- | --- | --- | --- | --- |
| `plan_1` | `sess_1` | `wf_1` | `executing` | `1742131207400` | `1742131210000` |

## plan_steps

| id | plan_id | seq | status | description | created_at | updated_at |
| --- | --- | --- | --- | --- | --- | --- |
| `step_1` | `plan_1` | `1` | `completed` | `列出 MVP 的核心模块与功能清单` | `1742131207600` | `1742131209800` |
| `step_2` | `plan_1` | `2` | `running` | `补充非功能性需求和边界条件` | `1742131207700` | `1742131210000` |
| `step_3` | `plan_1` | `3` | `pending` | `输出最终结构化需求文档` | `1742131207800` | `1742131207800` |

## ask_user_questions

| id | session_id | block_id | status | type | title | description | created_at | updated_at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `q_1` | `sess_1` | `wf_1` | `draft` | `single` | `你更关注哪一类用户场景？` | `我会用你的选择来调整需求拆解的侧重点。` | `1742131209000` | `1742131210200` |

## ask_user_options

| id | question_id | idx | label | value | description |
| --- | --- | --- | --- | --- | --- |
| `q_1_opt_1` | `q_1` | `1` | `个人日常任务` | `personal` | `强调轻量、快捷、移动端使用` |
| `q_1_opt_2` | `q_1` | `2` | `团队协作` | `team` | `强调共享、权限、同步` |
| `q_1_opt_3` | `q_1` | `3` | `学习/复盘` | `study` | `强调标签、统计、复盘` |

## ask_user_answers

| id | question_id | session_id | block_id | values_json | submitted_at |
| --- | --- | --- | --- | --- | --- |
| `a_1` | `q_1` | `sess_1` | `wf_1` | `["personal"]` | `1742131215000` |
